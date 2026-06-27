# Production Plan — AI Proposal Maker (Gamma-style streaming + commercialization)

Status: **draft for review** · Date: 2026-06-21 · Branch: `v2`

This document is the agreed architecture and phased build plan. No code is written
until this is reviewed and approved.

---

## 1. Goal

Turn the current monolithic generator into a production product where:

1. The user picks a free **template** (deckType × theme × accent × canvas preset).
2. Generation streams **slide-by-slide** into the browser (Gamma-style): an outline
   appears in ~5s, then each finished slide pops in as it's ready.
3. Once the deck is assembled in the browser, the user **exports** (PDF first;
   PPTX and Google Slides later) as a separate, deliberate step.
4. Later: accounts, credits, and payments (commercialization).

---

## 2. Current state (baseline)

One Bun + Express process. Single blocking route `POST /generate` (`src/index.ts`)
runs the whole pipeline with `Promise.all` and returns a finished PDF:

```
strategist → layoutSelector → enforceVariety
           → [slideCreationAgent ×N]  (Promise.all, all at once)
           → [image resolve ×N]       (Promise.all)
           → generatePDF(all slides)  (single Puppeteer pass)
           → JSON + pdfPath
```

Key facts that shape this plan:

- **Each slide already renders independently.** `RENDERERS[layout](slide)` returns
  one slide's self-contained HTML string (`src/renderers/pdf.renderer.ts:3764`).
  `buildHTML` just joins them under one shared `<style>` block (`:3776`). Puppeteer
  only runs once, at the very end (`generatePDF`, `:3782`).
  → **No React re-implementation of the 32 layouts is needed to stream.** We stream
  each slide's finished HTML.
- All slides currently finish at roughly the same ~2-min mark because they run in
  parallel and the request blocks on the slowest one. There is no per-slide output today.
- No DB, no auth, no jobs, no payments. Pure generator core — wrap it, don't rewrite it.
- `src/renderers/ppt.renderer.ts` is all `noop` — PPTX export is stubbed.

---

## 3. Target architecture (3 services)

```
┌─ Frontend (Next.js)
│    templates gallery · live slide-by-slide preview · export UI · billing UI
│
├─ Backend / API (Bun)
│    auth · credits · payments (Stripe) · job orchestration · export storage
│    owns Postgres (+ Redis later for job/credit state)
│
└─ PPT Engine (current codebase, refactored)
     stateless · streams a generation job over SSE · renders + exports
```

- Backend never renders. It calls the engine and meters credits.
- Engine never knows about users or money.
- Frontend talks to Backend; Backend proxies/streams from Engine.

For the **MVP (Phase 0–1)** the Frontend may talk to the Engine directly to move
fast; the Backend seam is introduced in Phase 2.

---

## 4. Streaming design (the Gamma part) — DECIDED

**Cadence: parallel, emit-as-ready + outline-first.**

- Outline (title + slide headings + layouts) is produced first by a fast pass and
  emitted immediately → the browser shows all N placeholder cards in ~5s.
- All slides then generate in parallel (as today), but each slide's HTML is emitted
  the instant *that* slide finishes — arriving as a fast burst over ~40–60s for a
  20-slide deck, roughly in completion order.
- Frontend slots each slide by its `slideNumber`, swapping placeholder → real slide.
- Nothing is a PDF during preview. Export is a separate call after `done`.

(Throttling to a steadier "drip" can be added later without changing the contract.)

### 4.1 Transport: SSE (Server-Sent Events)

One-way server→client progress fits SSE exactly. Simpler than WebSockets,
auto-reconnect, plain HTTP. (WebSockets only if we later add collaborative editing.)

### 4.2 SSE event contract

`POST /jobs` opens an SSE stream and emits, in order:

```
event: outline
data: {
  "jobId": "job_abc",
  "deckTitle": "…",
  "deckType": "pitch_deck",
  "theme": "corporate",
  "canvas": "widescreen_16_9",
  "accentColor": { "name": "...", "hex": "#..." } | null,
  "css": "<shared stylesheet string>",          // sent once, applied to every slide iframe
  "slides": [
    { "slideNumber": 1, "title": "…", "layout": "hero",    "status": "pending" },
    { "slideNumber": 2, "title": "…", "layout": "metrics", "status": "pending" }
    // …×N
  ]
}

event: slide          // emitted once per slide, as each finishes (out of order OK)
data: {
  "slideNumber": 3,
  "layout": "metrics",
  "html": "<section class='slide'>…</section>",  // self-contained slide HTML
  "imageUrl": "…" | null,
  "status": "ready"
}

event: slide_error    // a single slide failed; deck continues
data: { "slideNumber": 7, "error": "…", "status": "error" }

event: done
data: { "jobId": "job_abc", "slideCount": 20, "deckId": "deck_xyz" }

event: error          // fatal, whole job aborted
data: { "jobId": "job_abc", "error": "…" }
```

Frontend rendering: drop each slide's `html` into a scaled `<iframe srcdoc>` (or
shadow DOM) that includes the shared `css`. Pixel-identical to the final PDF, zero
new rendering code.

### 4.3 Request body for `POST /jobs`

Same inputs as today's `/generate`, plus the template preset:

```json
{
  "prompt": "Create a pitch deck for my AI startup",
  "noOfSlides": 15,
  "templateId": "midnight-pitch",      // resolves to deckType+theme+accent+canvas
  "deckType": "pitch_deck",            // optional overrides
  "theme": "corporate",
  "accentColor": "indigo",
  "canvas": "widescreen_16_9",
  "watermark": true
}
```

### 4.4 Export (separate call)

```
POST /export   { deckId | slides[], format: "pdf" | "pptx" | "gslides", theme, canvas, accent }
→ { url }      // generated on demand, reuses existing Puppeteer path for PDF
```

---

## 5. Engine refactor required (small, no logic changes)

1. **Extract single-slide render.** Pull a `renderSlideHTML(slide, themeName, canvas,
   accentOverride, watermark)` out of `buildHTML` (`pdf.renderer.ts:3741`) — it already
   does exactly this per slide internally; just expose one slide at a time.
2. **Export the shared stylesheet.** Expose `getStyles(theme, canvasDims)` so the
   outline event can ship the CSS once.
3. **Split the pipeline into stages** so the engine can emit between them:
   - `buildOutline()` = strategist + layoutSelector + enforceVariety (→ outline event).
   - `fillSlide(slide)` = slideCreationAgent + validateAndFixSlide + image resolve +
     `renderSlideHTML` (→ slide event). Fired per-slide, emit on completion.
4. **Add `POST /jobs` SSE endpoint** alongside the existing `/generate` (keep
   `/generate` working for backward compat / Postman during transition).
5. Keep the engine **stateless**: a `deckId` maps to the assembled slide set held in
   memory (Phase 0/1) or persisted by the Backend (Phase 2+).

Estimated effort: ~half a day. No changes to the 32 layout renderers or prompts.

---

## 6. Templates

A "free template" = a named preset over existing primitives
(`deckType` × `theme` × `accentColor` × `canvas`). No new rendering work.

- Phase 1: a small static registry of presets + a gallery UI.
- Later: per-template cover thumbnails, premium/free flagging for monetization.

---

## 7. Exports — current status & plan

| Format        | Status today            | Plan |
|---------------|-------------------------|------|
| PDF           | ✅ working (Puppeteer)  | Reuse as-is behind `POST /export`. |
| PPTX          | ❌ `ppt.renderer` noop  | Decide image-per-slide vs native editable in Phase 3. |
| Google Slides | ❌ none                 | Google Slides API + OAuth, Phase 3+. |

---

## 8. Phases

### Phase 0 — Engine streaming (foundation)
- Extract `renderSlideHTML` + export `getStyles`.
- Stage the pipeline (`buildOutline`, `fillSlide`).
- Add `POST /jobs` SSE emitting `outline → slide(×N) → done`.
- Testable immediately with `curl -N`.
- **Exit:** curling `/jobs` streams outline in ~5s, then slides as they finish.

### Phase 1 — Frontend MVP (Next.js)
- Template gallery → generation screen.
- Consume SSE: render placeholders from `outline`, swap in slides on `slide` events
  via scaled `iframe srcdoc`.
- `done` enables Export → PDF download via `POST /export`.
- No login yet; Frontend may call Engine directly.
- **Exit:** end-to-end create → watch slides stream in → export PDF, in the browser.

### Phase 2 — Backend + accounts
- Bun API service, Postgres. Auth, save/list/load decks, job orchestration through
  the API (Frontend → Backend → Engine). Persist `deckId`.
- **Exit:** logged-in user's decks persist and reload.

### Phase 3 — Exports expansion
- PPTX (chosen strategy), then Google Slides (API + OAuth).
- **Exit:** export menu offers PDF + PPTX (+ Slides).

### Phase 4 — Commercialize
- Stripe, credit ledger, metering per generation, plan gating, premium templates.
- **Exit:** paid plan can be purchased and consumes credits per deck.

---

## 9. Open decisions (deferred, not blocking Phase 0–1)

- **Live preview rendering:** start with server-HTML-in-iframe (decided for MVP);
  revisit a React port only if/when native in-browser editing is required.
- **PPTX export type:** image-per-slide (fast, all layouts) vs native editable
  (pptxgenjs rebuild of 32 layouts). Decide at Phase 3.
- **Backend/auth/payments stack specifics:** decide at Phase 2.
- Job persistence & scaling (Redis/queue) — only if concurrency demands it.

---

## 10. Decided so far

- Cadence: **parallel, emit-as-ready + outline-first.**
- Transport: **SSE.**
- Preview: **stream server-rendered HTML fragments** (no 32-layout React port for MVP).
- Build order: **spec doc → Phase 0 (engine SSE) → Phase 1 (frontend).**
