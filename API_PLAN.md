# Public API — Build Plan (Slyde HQ)

Status: **planning** · Date: 2026-06-30 · Gamma-style deck generation over REST.
Pro-gated · async (poll) · API-key auth · per-key budgets · same credit billing.

---

## 0. Decisions (confirmed)
- **Auth:** API key, `Authorization: Bearer sk_live_…`. Pro workspaces only. Shown once, stored hashed.
- **Flow:** **async** — `POST /v1/generations` → `{ generationId, status }`; client **polls**
  `GET /v1/generations/:id` until `completed`/`failed`. (No webhooks in v1.)
- **Response:** always `deckId` + a **view/share URL**. Caller may request **exports** (pdf/pptx/png)
  → we render + return file URLs. **Full slide JSON** also available on request.
- **Budgets:** optional **per-key credit cap** + the shared workspace wallet. Blocked if EITHER the
  key's remaining budget OR the wallet is insufficient.
- **Rate limits:** generations **20/min & 200/hour per key**; status polls **60/min per generation**;
  `429` + `Retry-After` on exceed.
- **Billing:** same as manual — flat **200 cr/deck** (+ export render if requested). Insufficient → `402`.
- **API decks** get `source:"api"` → shown in the **"API generated"** sidebar tab.
- **Docs:** a **public** antd page (docs-style), same design system.

## 1. Data model
- **ApiKey** (extend existing): add `budgetCredits?: number|null` (per-key cap, null = uncapped),
  `spentCredits: number` (running), `enabled: boolean`. Keep `hashedKey`(sha-256), `prefix`
  (e.g. `sk_live_ab12…` shown in UI), `scopes`, `lastUsedAt`, `revokedAt`, `createdBy`.
- **Deck**: add `source: "app" | "api"` (default "app"); set "api" for API-created decks.
- **Generation job**: reuse the existing `Job` model; tag `Job.via = "api"` + `apiKeyId` for audit.
  Status maps: queued/streaming → `pending`/`processing`, done → `completed`, error → `failed`.
- (Rate-limit counters live in-memory per process for v1; note: multi-instance later → Redis.)

## 2. Auth + security
- `middleware/apiAuth.ts`: read bearer key → sha-256 → look up `ApiKey` by hash (not revoked, enabled)
  → attach `req.apiKey` + resolve its `workspaceId`. 401 on missing/invalid/revoked.
- **Pro gate:** the key's workspace must be on Pro at request time (plan can lapse) → else 403.
- Keys generated with CSPRNG (`crypto.randomBytes`), format `sk_live_<32+ chars>`; only the hash +
  a short prefix stored. Returned in full **once** on creation.
- Constant-time compare not needed (hash lookup), but never log raw keys.
- CORS: the API is server-to-server → no browser CORS needed; docs "try it" calls go through core.

## 3. Rate limiting (anti-spam)
- `middleware/rateLimit.ts`: token-bucket per `(apiKeyId, bucket)`. Buckets: `generate` (20/min,
  200/hr) and `status` (60/min, keyed by generationId). On exceed → `429` + `Retry-After` + a JSON
  body `{ error, retryAfter }`. Cheap in-memory Map with timestamps; swept periodically.

## 4. Generation pipeline (reuse, don't duplicate)
- The API does NOT stream SSE. Instead:
  - `POST /v1/generations` validates params, runs the **pre-flight credit + budget check**, creates
    Deck(generating, source:api) + Job(via:api), charges credits upfront (refund on failure), and
    kicks off `runGeneration` in the **background** (no client connection; `isClientGone` always
    false). Returns `{ generationId: job._id, status: "pending" }` immediately.
  - Background run persists slides exactly like the app path. On done → deck ready. On error →
    job error + **refund** + (if requested exports) skip.
  - `GET /v1/generations/:id` returns status; when completed, returns deckId, share URL, and any
    requested exports/slide JSON.
- Exports requested in the body are rendered after generation (engine `/export`), uploaded to R2,
  and their URLs attached to the result.

## 5. REST surface (`/api/v1`, API-key auth)
| Method | Path | Notes |
|---|---|---|
| POST | `/v1/generations` | Start a deck. Body below. → `{ generationId, status }` (202). |
| GET | `/v1/generations/:id` | Poll status/result. (rate-limited, scoped to the key's workspace) |
| GET | `/v1/decks/:id` | Fetch a finished deck (meta + optional slide JSON). |
| GET | `/v1/credits` | `{ balance, keyBudgetRemaining }` — so callers can check before spending. |

**POST /v1/generations body:**
```json
{
  "prompt": "string (required)",
  "noOfSlides": 12,
  "deckType": "general|pitch_deck|proposal|...",
  "theme": "corporate|funky|minimal|academic",
  "canvas": "widescreen_16_9|square_1_1|vertical_9_16",
  "accentColor": "blue|green|...",
  "outline": { ... optional approved outline ... },
  "exports": ["pdf","pptx"],     // optional → returned as URLs
  "includeSlides": false          // optional → include full slide JSON in result
}
```
**Completed GET result:**
```json
{
  "generationId": "...", "status": "completed",
  "deckId": "...", "url": "https://app.../share/<token>",
  "exports": { "pdf": "https://...", "pptx": "https://..." },
  "slides": [ ... ]   // only if includeSlides
}
```
Errors: 401 (bad key) · 403 (not Pro) · 402 (insufficient credits / key budget) · 422 (validation)
· 429 (rate limit) · 404 (unknown generation/deck).

## 6. Key management (app side — authenticated, Pro only)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/keys` | List keys (prefix, name, budget, spent, lastUsed, revoked). Never the secret. |
| POST | `/api/keys` | Create → returns the full key ONCE. `{ name, budgetCredits? }`. |
| PATCH | `/api/keys/:id` | Update name / budget / enabled. |
| DELETE | `/api/keys/:id` | Revoke (soft — `revokedAt`). |
- All behind `requireAuth` + `requirePro("api")`.

## 7. Frontend
- **Settings → "My API keys"** (the existing stub becomes real): create/list/revoke keys, set per-key
  budget, copy-once secret modal, show spent/remaining. Pro-gated (free sees upgrade card).
- **Sidebar "API generated"** tab → a deck list filtered to `source:"api"` (reuse the dashboard grid;
  drop the "Soon" badge). Route `/api-generated`.
- **Public API docs page** (`/docs`, no auth): antd docs layout — left `Menu` nav (Overview, Auth,
  Generate, Poll status, Errors, Rate limits, Examples), right content with `Typography` + code
  blocks (`<pre>` styled) + copyable cURL/JS snippets. Same theme/look.

## 8. Build order (milestones)
1. Model changes (ApiKey budget/spent/enabled, Deck.source, Job.via/apiKeyId) + `apiAuth` +
   `requirePro("api")` + rate-limit middleware.
2. Key management service + routes + Settings UI (create/list/revoke/budget).
3. `/api/v1/generations` (POST async + GET poll) reusing `runGeneration` in background; credit +
   per-key budget charge/refund; exports + includeSlides on result.
4. `/v1/credits`, `/v1/decks/:id`; mark decks `source:api`; "API generated" tab + route.
5. Public `/docs` page (antd).
6. Verify: core tsc+conventions, fe tsc+oxlint+vite; manual test with a real key in test mode.

## 9. Open knobs
- Rate-limit numbers, credit cost (shared with `pricing.ts`), key prefix format, export TTL.
- Later: webhooks (callbackUrl + HMAC), Redis-backed limits for multi-instance, usage analytics per key.
