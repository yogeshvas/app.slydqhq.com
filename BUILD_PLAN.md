# Build Plan — AI Proposal Maker (detailed, to completion)

Status: **active** · Date: 2026-06-28 · Frontend: **React 18 + Vite** · Supersedes
`backend/ai-engine/PLAN.md` §8.

The full "how we finish it" spec: topology, the complete REST + SSE API (every
endpoint with payloads), the auth flow end-to-end, engine changes, and the React/Vite
frontend down to folder structure and the generation data-flow.

---

## 0. Topology (confirmed)

```
Browser ─┬─ React 18 + Vite SPA  (frontend)
         │     auth · gallery · live SSE preview · editor · export · billing
         │     talks ONLY to core, sends `Authorization: Bearer <jwt>`
         │
         └─▶ core  (Bun + Express)  ── owns MongoDB ── object storage (S3/R2)
                 auth · workspaces · deck/slide CRUD · generation orchestration · credits
                 │  internal call, header `X-Engine-Key`
                 └─▶ ai-engine  (Bun + Express, internal-only)
                         stateless: /jobs (SSE) · render · /export (PDF)
```

- Frontend → **core only**. The engine is never exposed to the browser.
- core owns all persistence; the engine stays stateless.

### Current state recap
- **ai-engine** — Phase 0 done (`/generate`, `/jobs` SSE, `/export`, staged pipeline).
  In-memory `DECK_STORE`, hardcoded `http://localhost:3000`, images to local disk.
- **core** — Express, Mongoose, Google OAuth (passport, `session:false`) → JWT.
  `auth.controllers` signs `{ id, email }` for 7d. **All DATA_MODEL collections
  modeled + indexed.** Only `/api/auth/google*` wired. `ApiResponse` envelope exists.
- **frontend** — none.

---

## 1. API conventions (apply to all core endpoints)

**Base URL:** `/api`. **Auth:** `Authorization: Bearer <jwt>` on everything except
the auth routes. **Active workspace:** header `X-Workspace-Id: <id>` (defaults to
`user.defaultWorkspaceId` when omitted).

**Success envelope** (existing `ApiResponse`):
```json
{ "statusCode": 200, "data": { ... }, "message": "Success" }
```
**Error envelope** (via `errorHandler` / `AppError`):
```json
{ "statusCode": 404, "data": null, "message": "Deck not found" }
```
**SSE** endpoints stream `event:`/`data:` frames instead (see §6).

---

## 2. Auth flow (Google OAuth → JWT, SPA-friendly) — DETAILED

The SPA can't read passport's redirect JSON, so the callback must **redirect back to
the frontend with the token**, and the SPA exchanges nothing else.

```
1. User clicks "Sign in with Google" in the SPA.
   → window.location = `${API}/api/auth/google`
2. core (passport) redirects to Google consent.
3. Google → `${API}/api/auth/google/callback?code=...`
4. passport verifies, the GoogleStrategy verify-cb upserts the User AND runs
   signup bootstrap (create personal Workspace + owner WorkspaceMember +
   defaultWorkspaceId) if first login.
5. googleCallback signs JWT { id, email } (7d) and REDIRECTS:
   → `${FRONTEND_URL}/auth/callback#token=<jwt>`        ← CHANGE from today's JSON
6. SPA route /auth/callback reads token from the hash, stores it
   (localStorage `apm_token`), clears the hash, calls GET /api/me, redirects to /app.
7. Every later request attaches `Authorization: Bearer <token>`.
   401 anywhere → drop token, redirect to /login.
```

**Token storage decision:** localStorage (simple for an SPA + bearer header). Accept
the XSS tradeoff; mitigate with strict deps + CSP later. (httpOnly cookies would need
core CORS+credentials and CSRF handling — heavier, deferred.)

**Required code changes (Milestone A):**
- `google.controller.ts` → redirect with token in URL hash instead of `ApiResponse`.
- `google.strategy.ts` is a stub (`import st from ...` only) — implement the strategy
  (clientID/secret/callback from `env`, `session:false`, verify-cb upsert+bootstrap).
- `passport.ts` wires the strategy; `env.ts` add `FRONTEND_URL`.
- Add `requireAuth` middleware (verify bearer JWT → `req.user`), `loadWorkspace`
  (resolve `X-Workspace-Id` / default, assert membership), `requireRole(min)`.

---

## 3. Core API — full surface

Legend: 🔒 = requires `requireAuth`. Role = min workspace role for workspace-scoped
routes (`viewer < editor < admin < owner`).

### 3.1 Auth & identity
| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| GET | `/api/auth/google` | — | Starts OAuth redirect. |
| GET | `/api/auth/google/callback` | — | Redirects to `FRONTEND_URL/auth/callback#token=`. |
| GET | `/api/me` | 🔒 | → `{ user, workspaces:[{id,name,role}], defaultWorkspaceId }` |
| POST | `/api/auth/logout` | 🔒 | Client-side token drop; endpoint optional (token blacklist later). |

### 3.2 Workspaces & members
| Method | Path | Auth/Role | Body / Notes |
|---|---|---|---|
| GET | `/api/workspaces/:id` | 🔒 viewer | Workspace + member count + plan. |
| PATCH | `/api/workspaces/:id` | 🔒 admin | `{ name?, avatar? }` |
| GET | `/api/workspaces/:id/members` | 🔒 viewer | List members + roles. |
| POST | `/api/workspaces/:id/invites` | 🔒 admin | `{ email, role }` → creates `invites` (+email later). |
| POST | `/api/invites/accept` | 🔒 | `{ token }` → adds `WorkspaceMember`. |
| PATCH | `/api/workspaces/:id/members/:userId` | 🔒 admin | `{ role }` |
| DELETE | `/api/workspaces/:id/members/:userId` | 🔒 admin | Remove member. |

### 3.3 Templates (gallery)
| Method | Path | Auth/Role | Notes |
|---|---|---|---|
| GET | `/api/templates` | 🔒 viewer | System templates + this workspace's. `?tier=free`. |
| POST | `/api/templates` | 🔒 editor | Save a workspace preset. |

> Seed script inserts system `templates` from the engine's deckType×theme×accent×canvas
> primitives (Milestone B).

### 3.4 Decks
| Method | Path | Auth/Role | Body / Response |
|---|---|---|---|
| GET | `/api/decks` | 🔒 viewer | `?page&limit&status` → list (excludes `deletedAt`), newest first. |
| POST | `/api/decks` | 🔒 editor | `{ title, deckType, theme, accentColor, canvas, templateId? }` (manual/empty). |
| GET | `/api/decks/:id` | 🔒 viewer | → `{ deck, slides:[…ordered by position] }` |
| PATCH | `/api/decks/:id` | 🔒 editor | `{ title?, theme?, accentColor?, status? }` |
| POST | `/api/decks/:id/duplicate` | 🔒 editor | Deep-copy deck + slides. |
| DELETE | `/api/decks/:id` | 🔒 editor | Soft-delete (`deletedAt`). |
| POST | `/api/decks/:id/restore` | 🔒 editor | Clear `deletedAt`. |

### 3.5 Slides & versions
| Method | Path | Auth/Role | Body / Notes |
|---|---|---|---|
| POST | `/api/decks/:id/slides` | 🔒 editor | `{ layout, position?, content? }` → new slide + `slideOrder` update. |
| PATCH | `/api/slides/:id` | 🔒 editor | `{ title?, content?, layout? }` → snapshot to `slide_versions(source:user)`, invalidate `html`. |
| PATCH | `/api/slides/:id/reorder` | 🔒 editor | `{ position }` (fractional — one doc write). |
| DELETE | `/api/slides/:id` | 🔒 editor | Soft-delete + `slideOrder` update. |
| GET | `/api/slides/:id/versions` | 🔒 viewer | History, newest first. |
| POST | `/api/slides/:id/versions/:vid/restore` | 🔒 editor | Restore snapshot (records a new version). |
| POST | `/api/slides/:id/regenerate` | 🔒 editor | AI re-fill one slide (→ engine, §6.2). |

### 3.6 Generation (SSE) — §6
| Method | Path | Auth/Role | Notes |
|---|---|---|---|
| POST | `/api/decks/generate` | 🔒 editor | Opens SSE; creates Deck+Job, proxies engine `/jobs`, persists. |
| GET | `/api/jobs/:id` | 🔒 viewer | Job status/progress (for reconnect/replay). |

### 3.7 Export — §7
| Method | Path | Auth/Role | Body |
|---|---|---|---|
| POST | `/api/decks/:id/export` | 🔒 editor | `{ format:"pdf" }` → `{ exportId, url, status }` |
| GET | `/api/decks/:id/exports` | 🔒 viewer | Export history (reuse stored assets). |

### 3.8 Billing (Milestone F)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/plans` | Catalog. |
| GET | `/api/workspaces/:id/credits` | Balance = sum of `credit_ledger`. |
| POST | `/api/billing/checkout` | Stripe checkout session. |
| POST | `/api/billing/webhook` | Stripe webhook → subscriptions/payments/ledger. |

---

## 4. Engine internal contract (changes in Milestone C1)

- **`PUBLIC_BASE_URL` env** replaces hardcoded `http://localhost:3000`
  (`pipeline.ts`, `index.ts`).
- **`X-Engine-Key` auth** on `/jobs` `/export`; reject without it.
- **`POST /export` accepts `{ slides[], deckTitle, storyTheme, theme, canvas, accent,
  watermark }`** so it needs no in-memory `DECK_STORE` (keep `deckId` as fallback).
- **Images:** engine returns image bytes/URL in the `slide` event; **core** uploads
  to object storage and rewrites the slide `html`/`imageAssetId`. Engine stops writing
  to local disk in prod.
- The existing SSE contract (`outline → slide → slide_error → done → error`) is
  **unchanged** — core consumes it as-is.

---

## 5. Data-flow walkthroughs

### 5.1 Generate a deck (the core loop)
```
SPA  POST /api/decks/generate {prompt,noOfSlides,templateId,overrides}  (SSE open)
core  ├─ create Deck(status:generating) + Job(status:streaming)
      ├─ open SSE → engine POST /jobs  (X-Engine-Key)
      ├─ engine: event outline ─▶ core writes N placeholder Slides + deck.slideOrder
      │                          └─▶ forward `outline` to SPA  (renders N cards ~5s)
      ├─ engine: event slide  ─▶ core: upload image→storage, upsert Slide(content,html,
      │                          imageAssetId,status:ready), job.progress++
      │                          └─▶ forward `slide` to SPA (iframe srcdoc swaps in)
      ├─ engine: slide_error  ─▶ Slide.status:error, forward
      └─ engine: done         ─▶ Deck.status:ready, Job.done, thumbnail, ledger debit,
                                 usage_event, forward `done` (SPA enables Export)
disconnect → Job persists; SPA reconnect → GET /api/decks/:id replays from Mongo.
```

### 5.2 Edit / regenerate a slide
```
PATCH /api/slides/:id → snapshot old into slide_versions(user) → save → html invalidated
POST  /api/slides/:id/regenerate → engine fillSlide(one) → new html+image →
      slide_versions(regenerate) → return updated slide
```

### 5.3 Export
```
POST /api/decks/:id/export {pdf} → core sends stored slides[] → engine /export →
PDF bytes → upload storage → Asset + Export(ready) → { url }
```

---

## 6. Frontend — React 18 + Vite (DETAILED)

### 6.1 Setup
`npm create vite@latest frontend -- --template react-ts`. Add: `react-router-dom`,
`@tanstack/react-query` (server state), `axios`, `zustand` (auth/workspace store),
`tailwindcss`, `@dnd-kit/core` (slide reorder). React 18 (`createRoot`,
`StrictMode`). `.env` → `VITE_API_URL`.

### 6.2 Folder structure
```
frontend/src/
  main.tsx                 # createRoot + Router + QueryClient providers
  app/routes.tsx           # route table + <RequireAuth> guard
  lib/
    api.ts                 # axios instance: baseURL=VITE_API_URL, Bearer + X-Workspace-Id interceptors, 401→logout
    sse.ts                 # POST-based SSE reader (fetch + ReadableStream parser)
  store/
    auth.store.ts          # token, user, workspaces, activeWorkspaceId (zustand, persisted)
  features/
    auth/      LoginPage, AuthCallbackPage (reads #token), useMe()
    dashboard/ DashboardPage (deck grid), useDecks()
    templates/ GalleryPage, TemplateCard
    generate/  GeneratePage (prompt+options form), useGenerateStream()
    editor/    EditorPage, SlideFrame (iframe srcdoc), SlideList (dnd), SlidePanel
               (edit/regenerate/versions), ExportMenu
    billing/   PlansPage, CreditsBadge          # Milestone F
  components/   ui primitives (Button, Modal, Spinner, Toast)
```

### 6.3 Auth handling
- `LoginPage` → button sets `window.location = ${VITE_API_URL}/api/auth/google`.
- `AuthCallbackPage` (route `/auth/callback`) → parse `location.hash` for `token`,
  store in `auth.store` + localStorage, `history.replaceState` to strip it, fetch
  `/api/me`, navigate `/app`.
- `RequireAuth` wrapper → no token ⇒ `<Navigate to="/login">`.
- `api.ts` response interceptor: 401 ⇒ clear store, redirect `/login`.

### 6.4 The streaming preview (the Gamma part)
`useGenerateStream()` POSTs to `/api/decks/generate` and reads the SSE body via
`fetch` + a `ReadableStream` line parser (EventSource can't POST). Reducer state:
```
{ deckTitle, css, slides: Record<slideNumber, {status, layout, html, imageUrl}> }
on outline → seed N slides as {status:'pending'} + store shared css
on slide   → slides[n] = {status:'ready', html, imageUrl}
on slide_error → slides[n].status='error'
on done    → mark complete, capture deckId → enable Export, route to /editor/:deckId
```
Render each slide as a **scaled `<iframe srcdoc>`** = `<style>${css}</style>${html}`,
wrapped in a fixed-aspect box (`transform: scale()` to fit the card). Pixel-identical
to the PDF, **zero re-implementation of the 32 layouts**.

### 6.5 Editor
- `GET /api/decks/:id` → deck + ordered slides; render each via `SlideFrame`.
- `SlideList` with `@dnd-kit` → drop computes a fractional `position` between
  neighbors → `PATCH /api/slides/:id/reorder` (optimistic).
- `SlidePanel`: edit `content` (form per layout, or raw JSON to start) → `PATCH`;
  **Regenerate** → `POST …/regenerate`; **History** → versions list + restore.
- `ExportMenu`: PDF → `POST …/export` → poll/await `{url}` → download.

### 6.6 Server state
React Query for all REST (decks, slides, templates, me); cache invalidation on
mutations. The SSE stream is handled outside Query (manual reducer), then writes the
final deck into the Query cache so the editor loads instantly.

---

## 7. Milestones (ordered, with detail above)

| | Milestone | Exit criterion |
|---|---|---|
| **A** | Auth spine: strategy + bootstrap + redirect-callback + `requireAuth`/`loadWorkspace`, `/api/me` | Google login → SPA holds JWT → `/api/me` returns user+workspace. |
| **B** | Deck/slide CRUD + versions + template seed (no AI) | Full CRUD + reorder + version restore via API, authz enforced. |
| **C** | Engine hardening (C1) + generation orchestration SSE (C2) + credit stub (C3) | Generate streams + persists; deck reloads from Mongo after refresh. |
| **D** | Export pipeline (engine /export + storage + Asset/Export) | Deck → downloadable PDF URL, recorded. |
| **E** | Frontend React/Vite: auth → gallery → stream preview → editor → export | End-to-end in browser, persisted. |
| **F** | Stripe + credit ledger (idempotency keys) + billing UI | Paid plan purchasable, consumes credits. |
| **G** | PPTX (image-per-slide) → Google Slides → sharing → hardening | Export menu offers PDF+PPTX(+Slides); links work. |

**Critical path to usable MVP: A → B → C → D → E.** F and G layer on after.

---

## 8. Env vars per service
- **core:** `MONGOURI, JWT_SECRET, GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL, FRONTEND_URL,
  ENGINE_URL, X_ENGINE_KEY, S3/R2 creds, STRIPE_* (F)`
- **ai-engine:** `OPEN_AI_KEY, UNSPLASH_ACCESS_KEY, PUBLIC_BASE_URL, X_ENGINE_KEY,
  WATERMARK_TEXT`
- **frontend:** `VITE_API_URL`

---

## 9. Decisions (confirmed)
| # | Decision | Choice |
|---|---|---|
| 1 | Topology | Frontend → core → engine (persistence day one). |
| 2 | Frontend stack | **React 18 + Vite** (TS, Router, React Query, zustand, Tailwind, dnd-kit). |
| 3 | Token storage | localStorage + Bearer header; OAuth callback redirects with `#token`. |
| 4 | Object storage | Cloudflare R2 (S3-compatible). |
| 5 | Image upload | Engine returns, core stores. |
| 6 | `slide.html` | Cache; invalidate on edit. |
| 7 | Credit integrity | Idempotency-key guard per ledger write. |
| 8 | Billing timing | After Milestone E. |
```
