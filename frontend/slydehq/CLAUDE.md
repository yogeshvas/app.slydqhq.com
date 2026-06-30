# Frontend — Slyde HQ (conventions)

React 19 + Vite + TypeScript + **antd** + **Tailwind v4** + React Query + zustand + axios.
Feature-based. See `ARCHITECTURE.md` for the folder map and `../../BUILD_LOG.md` for what's
built. **Match these patterns on every change.**

## Data flow (never skip a layer)
UI → React Query hook (`features/*/hooks`) → API service (`features/*/api`, returns typed
data) → `lib/api-client` (axios). **UI never calls `apiClient` directly.**
- Errors: client throws a normalised `ApiError` (`{ status, message, errors }`); narrow with
  `isApiError()`. 401 auto-clears the token and bounces to `/login`.
- Backend envelope is `{ statusCode, data, message }` → services unwrap `res.data.data`.

## Conventions
- **Imports** use the `@/` alias (→ `src/`).
- **Routes/paths** live in `routes/paths.ts` — never hard-code path strings; use `paths.*`
  and `deckPath(id)`. New protected page = add under the `AppLayout` route in
  `routes/AppRouter.tsx`.
- **Auth:** token in `localStorage` via `lib/token-storage`; session in `features/auth/store`
  (`auth.store`); user is derived from the JWT (no `/auth/me` endpoint exists).
- **Env:** only `config/env.ts` reads `import.meta.env` (`VITE_*`). Includes
  `VITE_GOOGLE_CLIENT_ID`.

## UI / styling
- **ANT DESIGN ONLY for components — this is a hard rule.** Every UI element that antd
  provides MUST be the antd component: cards → `Card`, tabs → `Tabs`, tables → `Table`,
  stats → `Statistic`, avatars/badges → `Avatar`/`Badge`/`Tag`, buttons → `Button`,
  layout grids → `Row`/`Col`/`Flex`, text → `Typography`. **NEVER hand-build a `<div>` that
  mimics an antd component** (no custom "card" divs with `border rounded shadow`, no custom
  tab bars, etc.). Tailwind is allowed ONLY for outer layout/spacing/background — never to
  recreate something antd already does. If unsure whether antd has it, it does — use it.
- The global antd theme is `config/theme.ts` — change design tokens THERE, not per-component.
- **Brand = indigo `#4F46E5`; corners are SHARP (`borderRadius: 0`).** (Rounded/pill was
  tried and rejected — keep sharp.)
- Authenticated pages render inside **`AppLayout`** (icon `Rail` + contextual secondary
  panel + `<Outlet/>`). Don't wrap pages in their own shell. Use `PageHeader` for titles +
  the credits/search/bell cluster, `SectionPlaceholder` for stub sections.
- Nav is **data-driven**: add a section in `components/layout/nav.tsx`; settings sub-tabs in
  `features/settings/sections.tsx`. Each is a one-entry change.
- Focused flows (`/create`, `/decks/:id`) get the rail only (no secondary panel).

## Generation specifics
- `streamDeckGeneration` (in `decks.api.ts`) consumes the core SSE with **fetch** (not
  EventSource — it must POST + send the bearer token), parsing `event:`/`data:` frames.
- `SlideFrame` renders a slide's `html` + the deck's shared `styleCss` in a sandboxed iframe,
  scaled from canvas size (inches × 96 = px; widescreen = 1280×720).

## Aceternity / shadcn components
- No shadcn/`components.json` set up (Vite project). To add an Aceternity component, copy its
  source into `components/ui/`, ensure deps (`motion`, `cn` from `lib/utils`). `cn` =
  `clsx` + `tailwind-merge`.

## Check before finishing
`bunx tsc -p tsconfig.app.json --noEmit` · `bunx oxlint src` · `bunx vite build` — all clean.
