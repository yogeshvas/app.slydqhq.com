# Build Log — Slyde HQ (what's actually been built)

Companion to `BUILD_PLAN.md` (the spec). This tracks **implemented** work so a new
session has memory of the current state. Newest section = current truth.

Stack: **core** = Bun + Express + Mongoose (`backend/core`, :3000, `/api`). **ai-engine**
= Bun + Express + OpenAI/Puppeteer (`backend/ai-engine`, :8080). **frontend** = React 19 +
Vite + antd + Tailwind v4 + React Query + zustand (`frontend/slydehq`, :5173).

---

## ▶ RESUME HERE (next session — 2026-06-30)

State: editor (generate → outline → slide-by-slide → **full edit page**) is built across all 3
services and compiles clean (core `tsc`+conventions, fe `tsc`+oxlint+vite). Most recent work =
**Outline studio + AI quality + stock-photo picker** (see latest section below). **Not yet run
live end-to-end** — esp. the new `/decks/outline/*`, `/decks/stock-search`, per-card AI, and the
deck `storyTheme`/image-autofill paths.

**MUST restart both backends** (hot-reload doesn't re-register routes/middleware):
`cd backend/core && bun run dev` (:3000) and `cd backend/ai-engine && bun run dev` (:8080).
Watch the cwd — earlier a stray copy in `~/.Trash/backend/core` was being run; run from Desktop.

Likely-good now, verify after restart:
- Generate a **new** deck (old decks lack structured content + have base64 images → AI edit
  disabled on them, and they're heavy). New decks: small URL images, structured content.
- Editor: inline text edit (autosave), Ask-AI (instruction/layout/image), manual Content tab,
  drag-reorder, ⋯ + right-click menu (Cut/Copy/Paste/Duplicate/Add-below/Delete), shortcuts
  (⌘C/X/V/D, Delete), instant optimistic UI + toasts.

Open follow-ups / ideas:
- **New routes need a backend restart** to register: `GET /decks/outline/latest`,
  `POST /decks/outline/slide`, `PATCH /decks/outline/:id`, `POST /decks/stock-search`, and
  engine `POST /images/search` + `/slide/image` (now accepts `imageUrl`).
- **AI model dropdown is cosmetic** — selection is stored but generation still runs `gpt-5-nano`.
  Thread it through agents if real model switching is wanted.
- **Old decks lack `storyTheme`** (only saved on new generations) → AI edits fall back to deck
  title for context. Optional backfill.
- New-slide / new-image auto-fill uses **stock photos** (free); could switch to AI illustrations.
- **Object storage (S3/R2)** behind `ASSET_BASE_URL` so AI images aren't on engine local disk.
- **Backfill** old decks (base64→files, derive structured content) OR just regenerate them.
- Speed: AI edit/image still ~seconds (OpenAI latency) — that's inherent; the rest is snappy now.
- Image swap currently regenerates via prompt (AI/Unsplash); no direct user file upload yet.
- `/auth/me`, `/auth/logout`, exports, sharing, teams, billing UI still unbuilt (see below).

## Present-mode laser pointer + feature tips + pre-push secret audit (2026-06-30, latest)

Compiles clean (frontend). No backend change.

### Present mode (Google-Slides-style)
- `PresentMode.tsx`: translucent glassy prev/next nav (centered bottom, `bg-white/10` +
  backdrop-blur). **Laser pointer** — toggle via 🎯 button or **L**: hides the cursor and shows a
  red glowing dot that EASES toward the mouse (rAF lerp → lag) with a softer, more-lagging trailing
  glow (comet shadow). Click-zones disabled while laser on so pointing doesn't flip slides.

### Suggesting-man = living "what's new"
- Added a **Feature highlights** section to `features/dashboard/suggestions.ts` (present/laser,
  arrow-nav, speaker notes, share+password, export, trash restore, disable-tips). **RULE (also in
  cloud memory):** every new user-facing feature must get a tip added here.

### Pre-push secret audit (safe to push)
- No secrets in any committable file or in git history; no `.env` tracked. Fixed gaps: added a root
  `.gitignore` (env/node_modules/dist/generated/logs/DS_Store), added `.env` ignore to
  `frontend/slydehq/.gitignore` (was only `*.local`), and **untracked** the committed
  `.DS_Store` + `backend/.DS_Store`. `backend/ai-engine/generated/` (AI images/PDFs) now ignored.

## Dashboard guide + favorites/menu polish + fixes (2026-06-30)

Compiles clean (core + fe). Restart core for the favorite-in-`GET /decks/:id` change.

### Suggesting man (dashboard guide)
- `features/dashboard/components/DashboardGuide.tsx` — `/man/suggesting_man.png` slides up from
  bottom-right with a speech bubble of rotating suggestions (pool in `suggestions.ts`, 15 items;
  actionable ones have a "Try it →" that seeds `/create/generate`). A persisted **seed** (zustand
  `slyde_suggestions`) advances each visit so a different suggestion leads off every login; seed is
  captured once per mount (no flash). ✕ dismisses for the session. **Settings → Overview** toggle
  "Assistant suggestions" disables it entirely (`enabled` flag in the same store).

### Favorites everywhere
- Toggle in the dashboard **⋯ menu** (★ Add/Remove from favorites), the card star, AND the **deck
  editor header** (star button). `getDeckWithSlides` now joins the user's `DeckView.favorite` so the
  editor shows correct state. `useToggleFavorite` shows a **toast** ("Added/Removed from favorites")
  from all call sites.

### Menu UX fixes
- ⋯ menu **"Remove from folder"** now only shows when the deck is actually filed (`deck.folderId`);
  "Move to folder" became a proper **submenu**. Added `folderId` to the deck summary type.
- **Bug fix:** clicking a ⋯-menu item also opened the deck (React portal events bubble through the
  component tree to the Card's onClick). Fixed with `menu.onClick → domEvent.stopPropagation()` on
  the dashboard card + list dropdowns.

### Trash: empty all
- `emptyTrash` service + `DELETE /api/decks/trash` (purges every trashed deck + slides + views).
  TrashPage header **"Empty trash"** button with a "cannot be reversed" confirm.

## Trash (soft-delete → restore → permanent purge) + per-page tab titles (2026-06-30)

Compiles clean (core + fe). Restart core for the new deck routes.

### Trash
- Backend (`deck.service`): `trashDeck` (soft, set `deletedAt`), `restoreDeck`, `purgeDeck`
  (hard-delete deck + slides + DeckViews; only from trash as a guard), `listTrashedDecks`.
  Routes: `GET /decks/trash`, `POST /decks/:id/trash`, `POST /decks/:id/restore`,
  `DELETE /decks/:id`. (`/trash` registered before `/:id`.)
- Frontend: `decksApi` trash/restore/purge/trashList + hooks (`useTrash`, `useTrashDeck`,
  `useRestoreDeck`, `usePurgeDeck`). **Sidebar Trash item** = a drop target (drag a deck card →
  soft delete, reusing `DECK_DRAG_KEY`) + link to `/trash`; highlights red on drag-over. Dashboard
  card/list **⋯ menu** gains a danger "Move to trash". New **`TrashPage`** (`/trash`, antd Table):
  Restore + **Delete permanently** with a confirm modal carrying the **"This action cannot be
  reversed"** disclaimer. Home nav `match` + AppLayout include `/trash`.

### Per-page document titles
- New `lib/use-document-title.ts` → sets `document.title = "<Page> · Slyde HQ"`. Applied to every
  page; deck viewer + public viewer use the **deck's title** (live), settings uses the section,
  auth/landing/create/generate/media/templates/library/payment/trash get descriptive titles.

## Billing/UI polish + antd-only enforcement + toasts (2026-06-30)

Compiles clean (core tsc+conventions, frontend tsc+oxlint+vite). Restart core for the pricing
change + the `/billing/invoices` route.

### Antd-only rule (hard) — `frontend/slydehq/CLAUDE.md`
- Added a HARD rule: **only antd components** — never hand-build a `<div>` that mimics a Card/Tabs/
  Table/etc. Tailwind only for outer layout/spacing/background. (User was emphatic.)
- **BillingSection** fully rebuilt with antd: `Card`/`Statistic`/`Avatar`/`Row`/`Col`/`Flex`/
  `Badge.Ribbon`/`Tag`/`Typography`/`Table`. The coin = `Avatar` (gold gradient + `ThunderboltFilled`).
  Invoices/Credit-activity switch = **`Segmented`** pills (Media-style, per request), not Tabs.
- **ShareExportModal** rebuilt antd: left nav = **`Menu`** (inline, tightened via scoped
  `ConfigProvider` `itemHeight:34/itemMarginBlock:2`); export types = compact antd `Button`s; title
  is now 2 lines (bold "Share" + ellipsised deck name) so long titles don't wrap/overflow.

### Credit display scaling ×5 (psychological)
- Credits now read ~5× the rupee figure (₹199 → **500 credits**; deck = 200cr ≈ ₹80). Money
  economics unchanged — credit unit price dropped to ₹0.40/$0.005. `config/pricing.ts`: deck 40→200,
  ai_image 15→75, ai_edit 3→15, signup/daily 80→400, Pro bundle 400→2000, packs ×5
  (500/1375/3000/6500), unit price ₹2→₹0.40 / $0.025→$0.005.
- **Best-value pack = 3rd card** (₹999/3000cr) with the animated **shimmer-border** (reused
  `index.css` `.shimmer-border`) + primary Buy button.

### Toasts (antd `message`) added across flows
- Outline ready (Generate), deck generated `🎉 Your deck is ready!` + generation-failed
  (OutlineReviewPage status effect), deck-ready when opened mid-generation from dashboard
  (DeckViewerPage). Payment: success (credits added / welcome to Pro), **payment.failed**
  (wired Razorpay event in `lib/razorpay.ts`), and cancelled-on-dismiss (guarded so it never
  double-fires).

### Backend
- `getInvoices` + `GET /api/billing/invoices` (paid Payments → invoice rows). PaymentPage download
  buttons render printable invoices via `lib/print-doc.ts` (browser `window.print()`, no PDF lib).

### Verified
- Razorpay order creation tested directly: `200 OK` + valid `order_…` (keys healthy). The
  "Too many requests" seen in the Checkout modal = Razorpay TEST-MODE attempt throttle, not our bug.

## Billing page redesign — credit-forward + invoices + /payment screen (2026-06-30)

Frontend redesign of Settings → Billing + a new invoices endpoint. Compiles clean (core + fe).
- **Lead with buying credits:** the credit packs are the prominent top section (coin badge, BEST
  VALUE highlight, bonus %); plans (Free/Pro) moved below. Gold **coin** badge (CSS gradient +
  antd icon) on the wallet + packs. Page gets the app **gradient bg** (`-mx-8 -my-6` breakout).
- **Invoices + ledger** in antd **Tabs**: Invoices table (download each as PDF) + Credit-activity
  table with **server pagination** + **Export report (PDF)**. PDF via `lib/print-doc.ts` —
  browser `window.print()` (no extra lib; antd-only honored).
- Backend: `getInvoices` (paid `Payment`s) + `GET /api/billing/invoices`.
- **Dedicated `/payment` page** (`PaymentPage`, registered OUTSIDE `AppLayout` → clean **white**
  background, no sidebar/gradient behind the Razorpay modal). Buy-credits / Upgrade now navigate to
  `/payment?type=pack&pack=…` or `?type=pro`; that page creates the order/sub, opens Checkout, and
  returns to billing on success/cancel.

## Billing & credits (Razorpay) — pay-as-you-go + Pro subscription (2026-06-30)

Implements `BILLING_PLAN.md`. Compiles clean (core tsc+conventions, frontend tsc+oxlint+vite).
**Not yet run live** — needs core restart + Razorpay keys/plan-ids in `backend/core/.env`.

### Model
- Credits = the only currency, **flat per action (NOT per slide)**. `config/pricing.ts` is the single
  source: deck=40cr, AI image=15, AI edit=3; credit price ₹2 / $0.025; recharge packs (100/275/600/
  1300 with bonus); plans Free (pay-as-you-go) + Pro (₹749/$9.99/mo → members/API/email/no-watermark
  +400 monthly cr). Signup grant 80; free **new-day top-up to 80** (never accumulates). Modular
  currency per workspace (INR/USD).

### Backend (core)
- `config/pricing.ts` (knobs). Retired `STARTER_CREDIT_GRANT`/`CREDITS_PER_SLIDE`/`creditCostForSlides`/
  `AI_*_COST` from constants. `CreditLedger` reason enum expanded + `kind`(expiring|permanent)+`expiresAt`.
  Workspace gains `currency` + `lastTopupDate`; `getCurrentWorkspace` returns currency + runs the top-up.
- `credit.service`: `grantCredits`/`chargeCredits` helpers. `topup.service`: `applyNewDayTopupIfDue`.
  Generation now charges flat `DECK_GENERATION_CREDITS`; AI image/edit re-pointed + ledger reasons
  `ai_image`/`ai_edit`.
- **Razorpay** (native fetch + crypto, no SDK): `razorpay.client` (orders, subscriptions, cancel,
  webhook HMAC verify). `billing.service`: catalog/wallet/ledger, `createRecharge` (Order),
  `createProSubscription` (Subscription), idempotent `handleWebhookEvent` (recharge→permanent credits;
  subscription.charged→monthly expiring credits; activated/cancelled/halted→flip `workspace.plan`).
  `Payment`/`Subscription` refactored Stripe→gateway-agnostic (+`idempotencyKey` unique).
- Routes `/api/billing`: `GET plans|wallet|ledger`, `POST recharge|subscribe|cancel`, `POST webhook`
  (no auth, signature-verified; raw body captured in `app.ts`). `middleware/requirePro(feature)` gate
  ready for members/API/email endpoints. Env: `RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET/
  PRO_PLAN_ID_INR/PRO_PLAN_ID_USD` (all optional; billing throws clear error if unset).

### Frontend
- `features/billing/`: api + hooks. `BillingSection` (in Settings → **Billing & credits**): wallet
  balance, Free vs Pro cards (upgrade/cancel), recharge packs, transaction-history table. `lib/razorpay.ts`
  loads Checkout + opens order/subscription; crediting is webhook-driven (UI refreshes after). Header
  credits chip + settings "Upgrade to Pro" buttons now deep-link to `/settings/billing`.

### ⚠ To run live
- Add Razorpay keys + create the **Pro subscription plans** in the Razorpay dashboard (one per currency)
  → put their ids in `RAZORPAY_PRO_PLAN_ID_INR/USD`. Configure the **webhook** (`/api/billing/webhook`)
  with `payment.captured`, `order.paid`, `subscription.charged/activated/cancelled/halted` + the secret.
- Restart core (new routes + raw-body parser). Existing workspaces keep their balance (no reset);
  they default to INR + free until set otherwise.

## Generating decks open a generating view (not the editor) (2026-06-30)

Clicking a deck whose `status === "generating"` (from the dashboard) used to open the editor with
half-baked slides. Now `DeckViewerPage` early-returns a **generating view** for that status: title +
"x/y slides ready" + a grid that shows ready slides (`SlideFrame`) and `SlideSkeleton` shimmers for
pending ones. `useDeck` **polls every 2.5s while generating** and flips to the full editor on ready.
Seeding guard updated so the editor doesn't lock in partial slides captured mid-generation. Frontend
only. (The live SSE streaming view stays on the create flow; this covers opening a generating deck
fresh, where no stream exists to attach to.)

## Fix: outline decks were generic/bullet-heavy + image-expensive (2026-06-30)

Root cause: the **outline path starved the layout selector**. `pipeline.buildOutline` hardcoded
`slideType: "content"` for every non-cover slide (+ bullet-shaped objectives), so the
`layoutSelectorAgent` (which keys its rich slideType→layout affinity table on semantic types) had
no signal → fell back to ~4-5 generic bullet/image layouts. Image layouts then forced lots of
photos (cost). The direct-prompt path didn't have this because the strategist labels real
slideTypes. Compiles clean (all 3 services). Not yet run live (restart engine + core).

Fixes (engine-led + slideType threaded):
- **outlineAgent** now emits a semantic `slideType` per slide (cover, business_impact, comparison,
  methodology…). Threaded fe→core→engine: core zod `outlineSchema` + `Outline` model + fe
  `OutlineSlide` keep it; `buildOutline` uses it instead of "content".
- **layoutSelectorAgent** now also receives each slide's **title + bullets**, and the prompt was
  hardened: infer the slide's role from title/bullets when slideType is missing, **MAXIMIZE
  VARIETY** (use N distinct layouts in an N-slide deck), and **MINIMIZE PHOTOS** (hero on slide 1 +
  at most one other photo layout; everything else data/diagram/text).
- **enforceLayoutVariety** rewritten **unique-first**: each layout used at most once while distinct
  layouts remain (cap rises to 2 only when a deck is longer than the layout supply, ~20+).
- **Photos: AI cost low, Unsplash free & guaranteed.** `IMAGE_BUDGET` (AI gpt-image-1) 4→2; social_post
  6→5. Photo content layouts (image_left/right, quote_image, challenge_grid) allowed up to ~25% of the
  deck (`photoContentCap = clamp(round(n/4), 2, 4)`), and a **minimum is guaranteed** (≥2 for >6-slide
  decks; upgrades plain-text slides to image_left/right if the model picked too few) so **no deck is
  photo-less**. AI budget covers cover + 1; extra photo slides resolve to FREE Unsplash. The layout
  prompt now says "balance photos with structure (~25-30% photos), not minimize." Removed dead
  `DIAGRAM_GROUP`.

## Folders (create/organize + drag-drop) + sidebar cleanup (2026-06-30)

Gamma-style folder flow. Compiles clean (core + frontend). Not yet run live (restart core).

### Backend
- New `Folder` model `{workspaceId, authorId, name, color}`; `Deck.folderId` (optional). `folder.service`:
  `listFolders` (with per-folder deck counts), create/update/delete (delete unfiles its decks, never
  deletes them), `moveDeckToFolder` (folderId or null). `listWorkspaceDecks` gains a `folderId` filter.
- Routes: `GET/POST /folders`, `PATCH/DELETE /folders/:id`, `POST /decks/:id/move {folderId|null}`,
  and `GET /decks?folderId=`.

### Frontend
- `features/folders/`: api + hooks (`useFolders/Create/Update/Delete/MoveDeck`). `FoldersSection`
  in the Home sidebar — lists folders (icon tinted by color + deck count), **+ New folder** modal,
  right-click/⋯ **rename/delete**, click → `/dashboard?folder=<id>`. Folders are **drop targets**:
  dragging a deck card onto one files it (`DECK_DRAG_KEY` dataTransfer).
- Dashboard: reads `?folder=` → filters + shows the folder name/back-to-all header. Deck cards +
  list rows are **draggable**, and have a ⋯ **Move to folder** menu (incl. "Remove from folder").
- **Sidebar trimmed**: removed "Sites" + "Shared with you" stubs; kept "API generated" (Soon).
  Wired the previously-disabled sidebar **Search ⌘K** to the command palette.

## Dashboard tabs/analytics + ⌘K deck search (2026-06-30)

View tracking + Recently-viewed/Favorites + Grid/List + a ⌘K command palette. Compiles clean
(core + frontend). Not yet run live. Needs core restarted (new routes).

### View tracking + favorites + audience analytics (core)
- New `DeckView` model `{deckId, workspaceId, userId, lastViewedAt, viewCount, favorite}` (unique
  per deck+user). `view.service.ts`: `recordDeckView` (upsert on `GET /decks/:id`), `setFavorite`,
  `recordPublicView` (anonymous `deck.publicViewCount`, bumped in `getPublicDeck`), `getDeckViewers`
  (members who viewed, names via populate, + anonymous count). Deck model gains `publicViewCount`.
- `listWorkspaceDecks` rewritten: `filter` = all|recent|created|favorites, `sort`, `desc`; decks
  decorated with thumbnail + creator{name,avatar} + the user's {lastViewedAt, favorite} (batched).
  `searchDecks` — title + slide content/notes regex search for the palette.
- Routes: `GET /decks?filter&sort&desc`, `GET /decks/search?q=`, `POST /decks/:id/favorite`,
  `GET /decks/:id/viewers`. (Viewers analytics endpoint built; no UI yet.)

### Dashboard (frontend)
- Tabs **All / Recently viewed / Created by you / Favorites** as an antd **Segmented** (matches the
  Media tabs, per request — was plain buttons). **Grid / List** toggle + reverse-sort. Star toggle
  on cards + list rows (`useToggleFavorite`). List view shows thumbnail + last-viewed/updated +
  creator avatar. `timeAgo()` added to `lib/utils`.

### ⌘K command palette (frontend)
- `DeckSearchModal` — Gamma-style "Jump to": debounced server search (title+content), thumbnail +
  creator + last-viewed, ↑↓/↵ keyboard nav. Global state in `command-palette.store` (zustand);
  mounted once in `AppLayout` with a global ⌘K/Ctrl+K listener; the PageHeader search button opens it.

## Share/Export modal + public viewer (password-gated) (2026-06-30)

Gamma-style Share modal + a real **public, unauthenticated** deck viewer. Compiles clean
across all 3 services. Not yet run live. Needs both backends restarted + R2 (already set).

### Share modal (`components/ShareExportModal.tsx`) — replaces the editor's Export button
- Left sub-nav **Share / Export / Settings** (antd Modal).
- **Export**: card scope (All / **custom range** like `1-5, 8` → `parseRange` → `slideNumbers[]`),
  export types **PDF / PowerPoint / PNGs(zip)** + **Google Slides (stub, "Soon")**. Each opens
  the file URL.
- **Share**: the public link + Copy, link on/off, allow-downloads toggle.
- **Settings**: set/remove view **password**, **discoverable** toggle.

### Backend — public share (no auth by design)
- `DeckShare` model extended: `enabled`, `passwordHash` (Bun.password), `allowDownload`,
  `discoverable`. `share.service.ts`: `getOrCreateShare` (lazy token), `updateShareSettings`
  (hashes password), `getPublicDeck(token,password)` → `{passwordRequired}` or read-only
  deck+slides, `resolveDownloadableShare` (enforces allowDownload + password for public export).
- Owner routes (auth): `GET/PUT /decks/:id/share`. **Public router** (`routes/public.ts`, NO
  requireAuth, mounted at `/api/public`): `POST /public/decks/:token` (view, body password),
  `POST /public/decks/:token/export` (download iff allowDownload + password).
- Export now takes an optional `slideNumbers[]` subset (renumbered 1..k); engine adds **png**
  format → `exportPngZip` (jszip of per-slide screenshots, reuses the PPTX screenshot helper).

### Frontend — public viewer (`pages/PublicDeckPage.tsx`, route `/share/:token`, OUTSIDE auth)
- Unauthenticated. Password gate when set → read-only vertical slide stack (`SlideFrame`) +
  Present mode + a Download menu **only when the owner allowed downloads**. `api/public.api.ts`.

## Present mode + Export (PDF/PPTX) + Speaker notes + Theme switcher (2026-06-30)

Four Gamma-parity editor features. Compiles clean across all 3 services. Not yet run live.
Export needs R2 configured (already set) + both backends restarted (new routes + engine /export).

### Present mode (frontend only)
- `components/PresentMode.tsx` — full-screen portal overlay. ← → / Space / click navigate,
  ESC exits, **S** toggles a speaker-notes pane. Requests real fullscreen. Reuses `SlideFrame`
  (pixel-identical to editor/PDF). **Present** button in the editor header (opens at current slide).

### Export PDF / PPTX
- **Engine**: `services/export.service.ts` — `exportPdf` (reuses `generatePDF`, returns bytes)
  and `exportPptx` (puppeteer screenshots each slide → PNG → `pptxgenjs` full-bleed image per
  slide; `pptxgenjs` was already a dep). `POST /export` rewritten **stateless**: accepts inline
  `slides[]` + deck meta (no DECK_STORE reliance), returns the file **bytes** (DECK_STORE kept as
  same-session fallback).
- **Core**: `services/export.service.ts` — `exportDeck` loads deck+slides, posts structured
  content to the engine, gets bytes, **uploads to R2** (`storage.putObject` + `buildExportKey`),
  records `Export` + an `Asset(source:export)`, returns `{ url }`. `listDeckExports` for history.
  Routes (auth+validated): `POST /decks/:id/export {format}`, `GET /decks/:id/exports`.
- **Frontend**: `decksApi.exportDeck/exports`; header **Export ▾** (PDF / PPTX) → opens the file
  URL in a new tab.

### Speaker notes
- `Slide` model gains a `notes` string. `updateSlide` handles `notes` **without re-rendering**
  (metadata). Editor: a **Notes** tool in the right rail → textarea (saves on blur). Shown in
  Present mode (press S). Round-trips fe `Slide.notes`.

### Theme switcher (restyle whole deck post-generation)
- **Core**: `changeDeckTheme` — sets deck theme/accent, re-renders every structured slide via the
  engine `/render` (now returns `{html, css}` through `renderSlideContentWithCss`), persists each
  slide's html + the deck's new `styleCss`. `PATCH /decks/:id/theme {theme?, accentColor?}`.
- **Frontend**: reuses existing `ThemePicker` (sample-slide drawer) in the editor header →
  `decksApi.changeTheme` → swaps in re-rendered slides, updates the cached deck `styleCss`, bumps
  `revertKey` so iframes remount with the new look.

## Gamma-style text selection toolbar (2026-06-30)

Compiles clean (frontend). Not yet run live.

- New `components/SelectionToolbar.tsx` — a floating rich-text bar (headings ¶/H1/H2/H3,
  bold/italic/underline/strikethrough with active states, text-color swatches, bullet/numbered
  lists, align L/C/R, link, clear formatting). Every control fires on **mousedown +
  preventDefault** so the slide iframe keeps its selection/focus.
- `EditableSlide` now tracks the selection inside its sandboxed contentEditable iframe
  (`selectionchange`/mouseup/keyup), maps the range rect through the iframe `scale` to viewport
  coords, and portals the toolbar above (or below, near the top edge) the selection. Commands
  run via `iframe.contentDocument.execCommand`; link uses a saved-range + refocus so the URL
  input doesn't lose the selection. Repositions on scroll/resize; hides on blur (kept up while
  the link input is focused).
- **Manual save only (no autosave).** Inline/formatting edits just flag the deck dirty; the
  user saves explicitly. Header shows a **red "Unsaved changes — you might lose your progress"**
  warning (pulsing dot) with a **Discard** button + the **Save** button. A `beforeunload` guard
  warns on refresh/close/navigate while dirty. (Structured ops — AI edit/image/content +
  undo/redo — still persist immediately and are revertable via ⌘Z.) Removing autosave also
  means the live text selection is no longer dropped mid-edit.
- **Discard mechanism (important):** inline edits live in the iframe DOM, NOT React state, so
  `s.html` in state is still the last-saved HTML — resetting it is a no-op and the iframe never
  reloads. Fix: Discard bumps a `revertKey` that's part of each `EditableSlide` key, forcing the
  iframes to **remount** and reload the saved HTML (true revert) + clears touched/dirty flags.

## Editor undo/redo + scalable dashboard thumbnails (2026-06-30)

Compiles clean across core + frontend. Not yet run live.

### Undo / redo (editor)
- `DeckViewerPage` keeps per-slide snapshot stacks (`undoRef`/`redoRef`, capped 50) taken
  BEFORE each structured change (AI edit, image apply, content apply). **⌘Z / ⌘⇧Z (and ⌘Y)**
  plus toolbar Undo/Redo buttons. Undo re-PATCHes the slide to its snapshot (re-render from
  `content`, else `html`), selects + scrolls to it. Stacks live in refs so the keydown handler
  never reads stale state. Inline text edits still use the iframe's native undo (separate).
  NOTE: structural ops (delete/reorder/duplicate/paste) are not yet on the undo stack.

### Dashboard shows slide 1, paginated + lazy (scalable)
- `GET /decks` is now **paginated** (`?page&limit`, default 24, validated) → returns
  `{ decks, total, page, limit, hasMore }`. Each deck carries `thumbnailHtml` (first slide,
  one aggregation per page) + `styleCss`.
- Frontend `useDecks` → **`useInfiniteQuery`** with a "Load more" button. Deck cards render
  **slide 1 live** via `LazyThumb` — a `SlideFrame` mounted only when the card scrolls near
  the viewport (IntersectionObserver, 300px margin), so a big list doesn't spin up N iframes.

## Media library (master, searchable) + editor media panel (2026-06-30)

Workspace-scoped media library backed by the existing `Asset` model. **Compiles clean
across all 3 services; not yet run live.** Needs both backends restarted + R2 env set.

### What it does
- Every image a user gets is auto-catalogued into the workspace library: AI generations
  (`source:ai`), stock picks/auto-fills (`unsplash`), and uploads (`upload`). Deduped by URL.
- Each asset gets **AI-derived metadata** (title/description/tags) via an OpenAI **vision**
  model, plus **user tags** — so search finds images by what's actually in them.
- Dashboard **Media** page: tabs (All / AI generated / Stock / Uploaded), server-side search,
  tag filter, upload, per-image tag edit + delete. Editor right-rail **Media** tool: same
  library (compact) to pick an image straight onto the current slide.

### Backend core
- `models/content/asset.model.ts` extended: `title/description/tags[]/aiTags[]/metaStatus`,
  dims/bytes/mime, `storageKey`, deck/slide refs. **Indexes**: `workspaceId+createdAt`,
  `workspaceId+source+createdAt`, `workspaceId+url` (dedupe), and a weighted **`$text`** index
  over title/tags/aiTags/description/meta.prompt/filename (scalable server-side search).
- `services/storage.service.ts` — **Cloudflare R2** (S3-compatible) via **`Bun.S3Client`**.
  Uploads are **presigned PUT** (browser → R2 directly, bytes bypass core). `isStorageConfigured`,
  `presignUpload`, `publicUrl`, `deleteObject`.
- `services/media.service.ts` — `recordAsset`/`captureAsset` (dedupe + fire-and-forget AI
  enrich), `listAssets` (indexed `$text` + tag `$all` + paging), `listWorkspaceTags`,
  `createUpload`, `registerUpload`, `updateAssetTags`, `deleteAsset`. AI enrich calls the engine
  async and sets `metaStatus` ready/failed (never blocks the request).
- `controllers/media.controller.ts` + `routes/media.ts` + `validators/media.validator.ts`
  (registered at `/api/media`). Endpoints (all `requireAuth`, validated): `GET /media`
  (q/source/tags/page/limit), `GET /media/tags`, `POST /media/upload-url`, `POST /media`
  (register upload), `PATCH /media/:id` (tags), `DELETE /media/:id`.
- **Capture hooks**: `generation.service` slide event, `deck.service.setSlideImage` and
  `aiEditSlide` now `captureAsset(...)` the resulting image URL.
- `config/env.ts` — `R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET/R2_ENDPOINT/
  R2_PUBLIC_BASE_URL` (all optional; storage throws a clear error at upload if unset),
  `UPLOAD_MAX_BYTES` (15MB), `UPLOAD_URL_TTL_SECONDS` (600). `config/constants.ts` — media
  sources, mime→ext, page sizes, tag caps.

### ai-engine
- `agents/imageMetaAgent.ts` + **`POST /image/describe`** ({imageUrl} → {title, description,
  tags}). Uses **`gpt-4o-mini`** vision. It **fetches the bytes itself and sends base64** (our
  image URLs are often localhost/private, which OpenAI's servers can't fetch).

### Frontend
- `features/media/`: `types.ts`, `api/media.api.ts` (list/tags/updateTags/remove + `upload`
  orchestrating presign→PUT→register, reading dims client-side), `hooks/use-media.ts`
  (React Query, `keepPreviousData` for search). Components: `MediaCard`, `MediaTagsModal`,
  **`MediaLibrary`** (tabs/search/tag-filter/upload/grid/paging — reused by both surfaces).
- `MediaPage.tsx` now renders `MediaLibrary`. `DeckViewerPage` rail gains a **Media** tool →
  `MediaLibrary compact onPick` → applies the image via the free `regenerateImage(imageUrl)` path.

### Billing policy (decided 2026-06-30)
- **Media ops are FREE** — credits still meter only explicit AI value (generate, AI edit,
  AI image). Uploads, browse/search, tag edits, and applying a saved image to a slide cost
  nothing. No ledger changes.
- **Vision describe runs only for uploads + editor "set image" picks** (`enrich` default true).
  Bulk-generation slide images are catalogued with `enrich:false` (metaStatus `ready`, seeded
  with the slide title + prompt) so they stay searchable without ~12 unmetered vision calls
  per deck. Cost absorbed, not billed.

### ⚠ To run live
- **Set R2 env** in `backend/core/.env` (account id, access key/secret, bucket, and
  `R2_PUBLIC_BASE_URL` = the bucket's public domain). For direct browser PUT, the **bucket CORS**
  must allow `PUT` from the frontend origin (`http://localhost:5173`).
- **Restart both backends** (new routes: `/api/media/*`, engine `/image/describe`).
- AI metadata needs the engine's `OPEN_AI_KEY` to allow `gpt-4o-mini`. Enrichment is
  best-effort — search still works on prompt/filename/user tags if it fails.
- Existing decks' old images aren't backfilled; capture is forward-going (new generations/edits).

## Outline studio + AI quality + image picker (2026-06-30)

Big session across all 3 services. Everything below compiles clean (core `tsc`,
fe `tsc`+oxlint+vite build, engine `tsc` on changed files). **Not yet run live.**

### Outline quality — outline path now matches the direct-prompt path
- **`outlineAgent.generateOutline` rewritten to strategist-grade** (`backend/ai-engine`):
  domain-expert enrichment (real names/tools/stats), per-`deckType` narrative arcs, and it
  now **honors an explicit slide list** in the prompt instead of re-inventing structure. It
  also emits an `analysis` block (topicSummary/audience/objectives/tone). Reasoning effort
  `minimal → low`.
- **`pipeline.buildOutline`** no longer starves the content stage on the outline path: it
  threads the approved outline's `analysis` into `enrichedAnalysis` and derives a per-slide
  `businessObjective` from the bullets (was `{ narrativeApproach }` only).
- `analysis` round-trips fe→core→engine (added to fe `DeckOutline`, core `outlineSchema`).

### Backend outline persistence (new `Outline` model)
- `models/content/outline.model.ts` — saves prompt + config + generated outline (+analysis).
- Service `requestOutline` now **persists** each outline (needs workspace/user) and returns
  `outlineId`; new `getLatestOutline`, `updateOutline`. Endpoints (all `requireAuth`, validated):
  `GET /decks/outline/latest`, `POST /decks/outline/slide` (per-card AI), `PATCH /decks/outline/:id`.
- Token-saving: review page hydrates the last outline from the server when the store is empty.

### Outline review page — full redesign (`OutlineReviewPage.tsx`)
- Gamma-style **toolbar**: cards count, theme, dimensions, **AI model** dropdown (cosmetic —
  persisted/stored, generation still runs on `gpt-5-nano`; options in `MODEL_OPTIONS`). The
  model select has an **animated shimmer gradient border**.
- **Editable prompt + regenerate (↻)** button; **draggable reorder** via `motion` `Reorder`
  (stable `slideNumber` ids + memoized `OutlineCard` → smooth, was jittery); compact cards.
- **Per-card AI** ("Generate/Rewrite with AI") opens an **optional brief textarea** (hint),
  shows a **magical generating state** (glow ring + shimmer sweep + "Writing this slide…").
  Backend: `generateOutlineCard` agent → `POST /outline/slide` → core `requestOutlineCard`
  (accepts `hint`). Edits persist to backend (debounced) via `updateOutline`.
- **`CornerGuide`** presenter (`/public/man/man_for_outline.png`) bottom-left with a rotating
  tip speech bubble; ✕ slides him down (animated) then unmounts. Cat removed from this page
  (kept on Generate). Bottom bar credits moved right so the guide doesn't cover them.

### Generate page polish (`GeneratePage.tsx`)
- Deck-type chips use `/public/icons/*.svg` (grayscale, glow on select). Generate-outline
  button has an indigo glow. Back button pulled to page edge + breadcrumbs.

### AI slide edit — context + one-button apply + images
- **Deck now stores `storyTheme`** (added to `Deck` model + saved in `runGeneration` outline
  handler). `aiEditSlide` passes `deckContext {deckTitle, storyTheme, deckType}` to the engine.
- **`slideEditAgent` got two modes**: TWEAK (strict, no fabrication) vs GENERATE/EXPAND/REWRITE
  (authors real on-topic content from deck context) — fixes generic "close the deal" output.
- **One "Apply with AI" button** in `SlideInspector` (was 3): instruction+layout go in one
  engine call, image as a follow-up. Parent `applyAi` orchestrates + returns success.
- **Image compulsory for image layouts** (`hero/image_left/image_right/quote_image`,
  `IMAGE_LAYOUTS`): Apply is blocked until an image is provided when such a layout has none.
- **Auto-fill so image layouts never start empty:** engine `/slide/edit` adds a free Unsplash
  photo when the result needs one and has none; core `addSlide` does the same for new image slides.
- **Stock photo PICKER**: engine `searchUnsplashImages` + `POST /images/search`; core
  `searchStockImages` + `POST /decks/stock-search`; `/slide/image` accepts a chosen `imageUrl`
  (free, no re-search). Inspector: "Find photos" → 3-col thumbnail grid → pick one → apply.

## Editor UX polish (2026-06-29)
- **Optimistic slide ops:** delete/cut/duplicate/paste/add update the UI instantly and sync in
  the background (temp `tmp_…` ids swapped for the server slide on success; rolled back on error).
  Fixes the 4–5s "frozen" feel. Toasts fire in real time (Copied/Cut/Pasted/Duplicated/Deleted).
- **Temp-id guard:** save/autosave/reorder skip `tmp_…` slides so we never PATCH a non-ObjectId
  (fixes the "Invalid value for _id" CastError when saving right after paste).
- **Server perf:** `placeSlide`/`reorderSlides` now use one `Slide.bulkWrite` instead of N awaited
  `findOneAndUpdate`s; `deleteSlide` uses two direct `updateOne`/`$pull` writes (no load-save).
- Slide context menu: smaller ⋯ chip, right-click opens it too, Gamma-style items.
- **core body limit 25MB** (`app.ts`) + **engine body limit 25MB** (`index.ts`) — legacy base64
  decks; new decks are small.

---

## Done (as of 2026-06-29)

### Auth (end-to-end working)
- **Email OTP (passwordless):** `POST /api/auth/email/request-otp` → `{ email }`,
  `POST /api/auth/email/verify-otp` → `{ token }`. Services: `otp.service`, `mailer.service`.
- **Email delivery via Mandrill (Mailchimp Transactional) API** — switched off SMTP/nodemailer
  to the HTTP API (`config/mailer.ts` `sendMandrillEmail`, native `fetch`). Env:
  `MAILCHIMP_TRANSACTIONAL_KEY`, `MAILCHIMP_FROM_EMAIL`, `MAILCHIMP_FROM_NAME`.
- **Google OAuth redirect flow** (passport) — pre-existing, still works.
- **Google One Tap** — `POST /api/auth/google/one-tap` verifies the GIS credential offline
  via `google-auth-library` (`services/google.service.ts`), routed in its own JSON router
  (`routes/google.onetap.ts`) so errors hit the global handler, not the OAuth redirect.
  Frontend: `lib/google-identity.ts` (GIS loader, `use_fedcm_for_prompt`), hooks
  `use-google-identity.ts` + `useGoogleOneTap`. Needs `VITE_GOOGLE_CLIENT_ID` and the JS
  origin authorized in Google Cloud console.
- **Auth middleware:** `middleware/requireAuth.ts` — verifies JWT from `Authorization: Bearer`
  OR `?token=` (for SSE/EventSource). Attaches `req.auth = { id, email }`.

### Workspaces + credits
- **Auto-provision on signup:** `findOrCreateUserByEmail` calls
  `workspace.service.provisionDefaultWorkspace` → creates Workspace (owner, free),
  WorkspaceMember (owner), grants `STARTER_CREDIT_GRANT` (400) in the append-only
  `CreditLedger`, sets `user.defaultWorkspaceId`. Covers Google + email paths.
- `GET /api/workspaces/me` → `{ id, name, slug, plan, role, credits }`.
- `credit.service` — `getBalance` (latest `balanceAfter`), `recordCredit` (append-only,
  guards negative balance).

### Deck generation (the core loop, SSE)
- **`POST /api/decks/generate`** (auth, SSE): creates `Deck(generating)` + `Job(queued)`,
  charges credits upfront, then **proxies the ai-engine `POST /jobs` SSE** (port 8080,
  events `outline → slide×N → done`), persisting Deck config + a `Slide` per outline entry
  (pending→ready with cached `html`) + `Job.progress`, and relaying events to the client.
  On `done`: deck `ready` + `slideOrder`. On failure: job `error` + **credit refund**.
  Service: `generation.service.ts` (models are loosely typed via `defineModel`, so docs are
  cast to local `DeckDoc`/`JobDoc` interfaces).
- **`GET /api/decks`** (list) and **`GET /api/decks/:id`** (deck + ordered slides).
- **Outline step (Gamma-style, 2026-06-29):** `POST /api/decks/outline` → core `requestOutline`
  → ai-engine **`POST /outline`** (new `agents/outlineAgent.ts`, returns
  `{ deckTitle, storyTheme, slides:[{slideNumber,title,bullets}] }`; no deck, no credits).
  The user edits it, then `POST /decks/generate` carries the approved `outline`; the engine's
  `buildOutline` uses it (skips the strategist) and carries title+bullets on each slide so
  `slideCreationAgent` honors them. Frontend: `GeneratePage` is now config → editable outline
  → Generate; `/create/generate` route.
- Added **`styleCss`** field to the Deck model — the ai-engine emits the shared stylesheet
  once in `outline`; persisting it lets the standalone viewer render saved decks.
- Constants in `config/constants.ts` (`STARTER_CREDIT_GRANT`, `CREDITS_PER_SLIDE`, slide
  bounds, `creditCostForSlides`). Env: `AI_ENGINE_URL` (default `http://localhost:8080`).

### Backend conventions enforcement
- `backend/core/CLAUDE.md` — the conventions (golden path, ApiError, ApiResponse, pino
  logger, `_base.ts` models, constants/env).
- `scripts/check-conventions.mjs` — dependency-free checker (no-console, no-raw-res,
  no-direct-process-env, no-bare-throw-error) with scoped exemptions. `bun run lint`.
- Enforcement: git `pre-commit` hook (`.git/hooks/pre-commit`) + a Claude Code PostToolUse
  hook in `backend/.claude/settings.json` (may need `/hooks` reload to activate per session).

### Frontend
- **Passwordless login** (`features/auth/pages/LoginPage.tsx`) — 2-step email → `Input.OTP`,
  resend cooldown, auto-submit; Google One Tap + button. Login brand panel shows the
  Aceternity **3D Marquee** (`components/ui/3d-marquee.tsx`, `motion` + `cn`), images in
  `features/auth/login-marquee-images.ts`. Scoped via AuthLayout `background` prop (Signup
  keeps hero).
- **Public landing page** at `/` (`features/marketing/pages/LandingPage.tsx`), unprotected.
- **Create → Generate → View** (`features/decks/`): api (`decks.api.ts` incl. fetch-based SSE
  consumer), hooks (`use-decks`, `use-deck-generation`), `SlideFrame` (scaled iframe of
  `css`+`html`, canvas inches→px), `CreatePage` (Gamma-style mode grid → Generate form →
  live streaming grid; gradient bg; card covers use `public/1–4.jpeg`), `DeckViewerPage`.
- **Workspace feature** (`features/workspace/`) — `useWorkspace` (credits).
- **Two-level Gamma-style nav** (`components/layout/`): `AppLayout` (layout route + `<Outlet/>`),
  icon `Rail` (Home/Media/Templates/Library/Settings/More), contextual secondary panels
  (`sidebars/HomeSidebar` with workspace-switcher **Popover**, `sidebars/SettingsSidebar`),
  data-driven `nav.tsx`, reusable `SideItem`/`PageHeader`/`SectionPlaceholder`. Section pages:
  `features/media|templates|library`, `features/settings` (sub-nav via `sections.tsx`,
  Overview + API-keys with upgrade cards).
- **Theme** (`config/theme.ts`): **indigo** primary (`#4F46E5`), **sharp** corners
  (borderRadius 0 — rounded was tried and reverted). Active nav uses indigo tint.
- Routing: public `/`, `/login`, `/signup`, `/auth/google/callback`; protected under
  `AppLayout`: `/dashboard`, `/create`, `/decks/:id`, `/media`, `/templates`, `/library`,
  `/settings/*`.

---

### Deck editor (2026-06-29)
- **Inline text editing:** `DeckViewerPage` renders each slide's `html`+`styleCss` in a sandboxed
  iframe with `contentEditable` body; edits autosave (debounced) via `PATCH /decks/:id/slides/:slideId`
  (`html`). Editable deck **title** (`PATCH /decks/:id`), **Edit/Preview** toggle, save status.
- **Structured editing (re-renders server-side):** engine emits each slide's structured `content`
  in the SSE `slide` event (core persists it to `Slide.content`) and exposes **`POST /render`**
  (content → html). Core `renderSlideContent()` calls it. The editor's right-hand **`SlideInspector`**
  edits title/description/bullets → `PATCH .../slides/:slideId` with `content` → re-rendered html.
- **Reorder / add / delete slides:** `PATCH /decks/:id/reorder`, `POST /decks/:id/slides`,
  `DELETE /decks/:id/slides/:slideId` (rail hover actions + "Add slide"). `addSlide` renders a blank
  slide via the engine.
- **AI slide editing (2026-06-29):** engine `agents/slideEditAgent.ts` (tight edit-only prompt,
  anti-hallucination: change only what's asked, never invent facts, preserve structural fields) +
  `POST /slide/edit` (instruction and/or target layout → QA-hydrate → re-render) and
  `POST /slide/image` (prompt → gpt-image-1 or Unsplash → re-render). Core `aiEditSlide` /
  `setSlideImage` proxy these, charge credits (AI_EDIT_COST=1, AI_IMAGE_COST=2; refund on failure),
  persist content+html: `POST /decks/:id/slides/:slideId/ai-edit` and `.../image`. Frontend
  `SlideInspector` has an **Ask AI** tab (instruction, layout switcher over all engine layouts in
  `layouts.ts`, image prompt with AI/stock toggle) + a manual **Content** tab.

### Editor slide ops (2026-06-29)
- Thumbnail rail: **native HTML5 drag-and-drop** reorder (grip handle, indigo drop line); a ⋯
  hover menu **and right-click context menu** (shared `slideMenuItems`) with Cut/Copy/Paste/
  Duplicate/Add-below/Delete. **Keyboard shortcuts** on the selected slide: ⌘/Ctrl C/X/V/D +
  Delete (ignored while typing). In-app slide clipboard (deep-copied `content`).
- Backend: `POST /decks/:id/slides/:slideId/duplicate`; `POST /decks/:id/slides` now takes
  `afterSlideId` (insert position) and `content` (paste → re-rendered, never trusts client HTML);
  shared `placeSlide` keeps position/slideNumber/slideOrder consistent.

### Image storage — URLs not blobs (2026-06-29)
- **Root-cause fix for the 413 / huge payloads:** AI (gpt-image-1) images were inlined as base64
  data URIs in `slide.html` (~1.8MB/slide). Now the engine references the **saved file by URL**:
  `config/assets.ts` (`ASSET_BASE_URL`, default `http://localhost:8080`; `assetUrl()`), used in
  `pipeline.fillSlide` and `/slide/image`. Slides are now ~KBs. Unsplash already returned URLs.
  Core keeps a 25MB body limit as defense + so **legacy** decks (already base64 in Mongo) still save.
  Env: `ASSET_BASE_URL` (engine) — point at a CDN/S3 bucket later; only that line changes.
  NOTE: existing decks stay heavy until regenerated; new decks are small.

## Not done / next
- **Run/verify end-to-end** with Mongo + ai-engine + core + frontend up (generation never
  run live yet — only compiles).
- Other create modes (Paste / Template / Import) are "Soon" stubs.
- Slide **editing / regenerate / reorder** (`slide_versions` model exists, no UI/API).
- **Exports** (`export` model), **sharing** (`deck_shares`), **teams/invites**
  (`workspace_invites/members`), **billing UI / Stripe** (billing models exist).
- `/auth/me` and `/auth/logout` endpoints don't exist on core (frontend tolerates it;
  store user comes from JWT, logout clears locally).
- SSE through the Vite dev proxy unverified (may need proxy tweak if slides arrive batched).
