# Billing & Credits — Build Plan (Slyde HQ)

Status: **planning** · Date: 2026-06-30 · Gateway: **Razorpay** · Models: **OpenAI (GPT)**.
Pure pay-as-you-go credits + one optional monthly Pro subscription. Profit target: **5×**
(sell a credit for ~5× its true serving cost). Currency is **modular: INR + USD**.

---

## ✅ Confirmed model (2026-06-30)
- **Free / Basic = pay-as-you-go, NO monthly fee.** Recharge your wallet, spend credits to make PPTs.
- **Pro = ONE monthly subscription** that unlocks workspace members + API generation + email
  generation, includes a monthly credit bundle, removes the watermark.

---

## 1. The model (decided)
- **Credits are the only currency.** Every AI action spends credits. Credits are bought
  (recharge) or granted (signup / new-day top-up / Pro monthly bundle).
- **Credits are NOT per-slide.** A deck costs a **flat** credit amount regardless of card count.
  → retire `CREDITS_PER_SLIDE` / `creditCostForSlides`.
- **"Cards per prompt" is a plan cap**, not a credit multiplier.
- **AI images are NOT gated/compromised** — every deck keeps the AI + Unsplash image blend.
  The flat deck cost already accounts for the in-generation AI images.
- **Modular currency:** each workspace has `currency: "INR" | "USD"`, chosen at signup
  (detect from browser timezone/locale → India = INR, else USD; user can't change after).

## 2. Credit economics (starting numbers — tune later via the ledger)
True serving cost per action (OpenAI; **verify on the OpenAI usage dashboard**):
- Deck (text + ~2 gpt-image-1 + Unsplash) ≈ **₹15 / $0.18**
- Each extra AI illustration ≈ **₹5 / $0.06**
- AI text edit ≈ **₹0.5**

| Action | Credits | Cost | Revenue @ price | Margin |
|---|---|---|---|---|
| **Generate a deck** (flat, any cards up to cap) | **40** | ~₹15 | ₹80 | ~5.3× |
| **AI image** regen (editor) | **15** | ~₹5 | ₹30 | ~6× |
| **AI edit / layout change** | **3** | ~₹0.5 | ₹6 | high |
| Stock photo / manual edit / export / share | **0** | ~₹0 | — | — |

**Credit price (recharge): ₹2 / $0.025 per credit.**

**Recharge packs** (bonus grows with size):
| Pack | INR | USD | Credits | ≈ decks |
|---|---|---|---|---|
| Starter | ₹199 | $2.49 | 100 | ~2.5 |
| Popular | ₹499 | $5.99 | 275 (+10%) | ~7 |
| Value | ₹999 | $11.99 | 600 (+20%) | ~15 |
| Bulk | ₹1,999 | $24.99 | 1,300 (+30%) | ~32 |

## 3. Plans / tiers
| | **Free (pay-as-you-go)** | **Pro (monthly)** |
|---|---|---|
| Price | ₹0 / $0 | **₹749/mo · $9.99/mo** |
| Credits | signup grant + new-day top-up + recharge | **400 monthly** + recharge |
| Cards / prompt | 15 | 60 |
| AI image blend | ✅ (never compromised) | ✅ |
| Recharge wallet | ✅ | ✅ |
| Workspace members | ❌ | ✅ |
| API generation | ❌ | ✅ |
| Email generation | ❌ | ✅ |
| Watermark | yes | removed |

- **Signup grant:** 80 credits (= 2 decks).
- **New-day top-up:** on first login of a new calendar day, **top up TO 80** *only if below*
  (never accumulates). ≈ 2 decks/day for returning free users. (Cost exposure ≈ ₹30/day per
  active free user — tunable knob if too high.)
- **Pro monthly credits:** 400/mo (≈10 decks; covers "5 decks for new Pro users"), expire monthly.
  **Purchased (recharge) credits never expire** and stack on top.
- Credit spend order: monthly/granted credits first (expiring), then purchased.

## 4. Data model changes
- **Workspace:** add `currency: "INR"|"USD"` (default by signup region), `plan: "free"|"pro"`
  (already has `plan`), keep credit balance via `CreditLedger` (exists).
- **Plan / Subscription / Payment:** refactor Stripe-named fields → gateway-agnostic:
  - `Plan`: `gatewayPlanId` (was `stripePriceId`), `priceByCurrency: { INR, USD }`, `monthlyCredits`,
    `features` (mixed), `interval`.
  - `Subscription`: `provider:"razorpay"`, `gatewayCustomerId`, `gatewaySubscriptionId`, status,
    `currentPeriodEnd`, `cancelAtPeriodEnd`.
  - `Payment`: `provider`, `gatewayOrderId`, `gatewayPaymentId`, `amount`, `currency`,
    `creditsGranted`, `status`, `idempotencyKey` (unique — guards double-credit on webhook retries).
- **CreditLedger:** extend `reason` enum with `signup`, `daily_topup`, `subscription`, `recharge`
  (keep existing `grant/generation/export/refund/purchase`). Add `expiresAt?` (for expiring
  monthly/granted credits) + `kind: "expiring"|"permanent"`.
- **DailyTopup tracking:** store `lastTopupDate` on the workspace (or a tiny doc) so a new-day
  top-up fires at most once per calendar day.
- **Config:** `config/pricing.ts` — credit costs (`DECK_GENERATION_CREDITS=40`, `AI_IMAGE_CREDITS=15`,
  `AI_EDIT_CREDITS=3`), packs, plan defs, signup grant, daily cap. (Replaces the slide-based consts.)

## 5. Backend services
- **credit.service:** keep append-only ledger. Add `chargeCredits(workspaceId, amount, reason, refId)`
  (spends expiring-first), `grantCredits(...)`, balance read (already there). Negative-balance guard
  stays.
- **Generation charge refactor:** `createGenerationJob` charges flat `DECK_GENERATION_CREDITS`
  (not `creditCostForSlides`). Refund on failure (exists). AI image regen → `AI_IMAGE_CREDITS`,
  AI edit → `AI_EDIT_CREDITS` (already wired, just re-point the constants).
- **topup.service:** `applyNewDayTopupIfDue(workspaceId)` — called on `getCurrentWorkspace` /
  login; tops up to the free cap once per new day.
- **billing.service (Razorpay):**
  - `createRechargeOrder(workspaceId, packId)` → Razorpay Order (amount in workspace currency).
  - `createProSubscription(workspaceId)` → Razorpay Subscription.
  - `handleWebhook(event)` → verify signature → on `payment.captured` (order) grant pack credits +
    `Payment`; on `subscription.charged` grant monthly credits; on `subscription.activated/halted/
    cancelled` flip `workspace.plan`. Idempotent via `idempotencyKey`.
- **gating:** `requirePro` middleware/helper for members-invite, API, email endpoints.

## 6. Razorpay integration
- **Recharge** = Razorpay **Orders** (one-time). **Pro** = Razorpay **Subscriptions** (plan + sub).
- **Webhook**: one endpoint `POST /api/billing/webhook` (raw body, signature verify with
  `RAZORPAY_WEBHOOK_SECRET`). No auth (gateway-called); idempotent.
- **Env (core):** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
- **Frontend:** Razorpay Checkout JS (`checkout.razorpay.com`); open with the order/sub id, on
  success the webhook does the crediting (frontend just shows pending→confirmed).

## 7. API endpoints (core)
- `GET  /api/billing/plans` → plans + recharge packs in the workspace's currency.
- `GET  /api/billing/wallet` → balance + breakdown (expiring vs permanent) + plan + next renewal.
- `GET  /api/billing/ledger?page=` → transaction history (the ledger view).
- `POST /api/billing/recharge` `{ packId }` → `{ orderId, amount, currency, keyId }`.
- `POST /api/billing/subscribe` → `{ subscriptionId, keyId }` (Pro).
- `POST /api/billing/cancel` → cancel at period end.
- `POST /api/billing/webhook` → Razorpay events (no auth, signature-verified).

## 8. Frontend
- **Pricing / Upgrade page** (`/settings/billing` or a modal): Free vs Pro, recharge packs, currency
  auto-shown. "Upgrade to Pro" + "Buy credits" → Razorpay Checkout.
- **Wallet/credits widget** (header already shows credits): click → breakdown + "Buy credits".
- **Recharge modal:** pick a pack → Razorpay Checkout → success state.
- **Transaction ledger view:** list `CreditLedger` entries (date, reason, ±credits, balance) —
  the "initial +80 signup" entry shows first.
- **Gating UI:** invite-members / API / email surfaces show an "Upgrade to Pro" prompt when free.
- **Out-of-credits UX:** generation blocked → "Top up" CTA (and "come back tomorrow" hint for free).

## 9. Migration / cleanup
- Replace `CREDITS_PER_SLIDE`, `creditCostForSlides`, `STARTER_CREDIT_GRANT` with the new
  `config/pricing.ts`. Existing workspaces keep their current balance (no reset).
- Re-tune `AI_EDIT_COST`/`AI_IMAGE_COST` to the new scale.
- Old Stripe field names dropped (no live Stripe data).

## 10. Build order (milestones)
1. `config/pricing.ts` + ledger/reason extensions + workspace `currency`/topup field.
2. Generation charge refactor (flat deck cost) + new-day top-up + signup grant.
3. Razorpay billing.service + endpoints + webhook (recharge first, then Pro subscription).
4. Gating (`requirePro`) on members/API/email.
5. Frontend: wallet + recharge modal + Razorpay Checkout + ledger view + pricing page + gating UI.
6. Verify: tsc/lint/build all services; test recharge + webhook in Razorpay test mode.

## 11. Open knobs (easy to tune later)
- Credit price (₹0.40/$0.005), deck cost (200cr), pack sizes/bonuses, Pro price (₹749/$9.99) +
  bundle (2000cr), free signup (400) + daily cap (400). All live in `config/pricing.ts`.

### Credit display scaling (2026-06-30)
Credits are intentionally shown ~5× the rupee figure (₹199 → 500 credits, deck = 200cr ≈ ₹80) so
the wallet feels generous — a psychological choice. The MONEY economics are unchanged vs the
original ×1 scale; a credit is just a smaller unit (₹0.40). To re-scale: multiply all credit
quantities AND divide CREDIT_UNIT_PRICE by the same factor — the ratio (credits ÷ price) is what
preserves margin.

### Razorpay "Too many requests" (test mode) — NOT a bug
Verified order creation returns 200 with a valid `order_…` id (keys healthy, not rate-limited).
The "Too many requests / Retry payment of ₹X" message appears INSIDE the Razorpay Checkout modal —
it's Razorpay's TEST-MODE throttle on repeated payment attempts (opening checkout / entering test
cards / retrying rapidly). Transient; clears in minutes; far less aggressive in live mode. Mitigate
by spacing out attempts and using the standard test card once.

---

## 12. Razorpay dashboard setup (operational notes — 2026-06-30)
Status: **built; INR live path being configured. USD pending international approval.**

### `.env` keys (in `backend/core/.env`, gitignored)
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
`RAZORPAY_PRO_PLAN_ID_INR`, `RAZORPAY_PRO_PLAN_ID_USD`. All optional — billing throws a clear
"not configured" error if missing; recharge needs only key id + secret.

### Webhook
- Dashboard → Webhooks → Add. **URL** = `https://<public-host>/api/billing/webhook` (localhost is
  unreachable → use ngrok/Cloudflare Tunnel for testing). **Secret** = a string YOU invent (not
  generated by Razorpay); put the SAME value in `RAZORPAY_WEBHOOK_SECRET`.
- **Active events to subscribe:** `payment.captured`, `order.paid`, `subscription.charged`,
  `subscription.activated`, `subscription.cancelled`, `subscription.halted`.

### Pro subscription plans
- Dashboard → Subscriptions → Plans → Create Plan. Monthly, every 1 month.
  INR plan = **₹749**, name "Slyde HQ Pro" → copy the `plan_…` id into `RAZORPAY_PRO_PLAN_ID_INR`.
- **Amount/frequency can't be changed after creation** (make a new test plan to change in test mode).
- USD plan currency is **locked until International Payments are approved** — leave
  `RAZORPAY_PRO_PLAN_ID_USD` blank for now; USD Pro shows a clean "not configured" message, and
  recharge + INR Pro work regardless. When approved, create the $9.99 plan + paste its id (no code change).

### Accepting USD (international) — requires Razorpay approval
- The product to enable is **"International Cards" → "Request for international cards"** (Account &
  Settings → Configuration). This lets overseas customers pay by card on Razorpay Checkout — exactly
  what our integration uses.
- **Do NOT use "International Bank Transfers (MoneySaver)"** — that's for large B2B wire transfers,
  wrong for small recurring card payments / SaaS micro-transactions.
- Approval is manual; may also require an **IEC (Import-Export Code)** from DGFT and a **purpose code**
  (for a SaaS/software product, **P0802 — Software consultancy/implementation** is the standard fit;
  confirm with a CA). Higher fees (~3%+GST), settles in INR.
- **None of this blocks launch** — ship INR-only now; flip USD on later with zero code changes.
