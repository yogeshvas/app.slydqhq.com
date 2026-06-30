# Slyde HQ — Frontend Architecture

Feature-based React (Vite + TypeScript + antd + Tailwind). Built to scale: each
domain owns its API calls, hooks, state, types and pages.

## Stack

- **React 19 + Vite** — app + build
- **react-router-dom** — routing (lazy-loaded, code-split per page)
- **@tanstack/react-query** — server state (fetching, caching, mutations)
- **zustand** — lightweight client state (auth session)
- **axios** — HTTP client with auth + error interceptors
- **antd + Tailwind** — UI components + utility styling

## Folder layout

```
src/
├── main.tsx              # entry — mounts <AppProviders><App/></AppProviders>
├── App.tsx               # renders <AppRouter/>
├── config/
│   ├── env.ts            # the ONLY place that reads import.meta.env
│   └── theme.ts          # antd theme (brand colours, sharp corners)
├── lib/                  # framework-agnostic singletons
│   ├── api-client.ts     # axios instance + interceptors + isApiError()
│   ├── query-client.ts   # React Query config
│   └── token-storage.ts  # token persistence (localStorage)
├── providers/
│   └── AppProviders.tsx  # composes theme + query + router providers
├── routes/
│   ├── paths.ts          # route path constants — never hard-code paths
│   ├── AppRouter.tsx     # route table (lazy pages)
│   └── ProtectedRoute.tsx# auth guard
├── components/           # SHARED UI only (reused across features)
│   ├── ui/               # presentational (BootstrapButton, …)
│   └── layout/           # layouts (AuthLayout, …)
├── types/
│   └── api.ts            # shared API envelope types
└── features/             # one folder per domain
    └── <feature>/
        ├── api/          # <feature>.api.ts — axios calls, returns typed data
        ├── hooks/        # use-<feature>.ts — React Query hooks
        ├── store/        # zustand stores (client state only)
        ├── types/        # feature types
        ├── components/   # feature-specific components
        └── pages/        # route components
```

## Conventions

- **Imports** use the `@/` alias (→ `src/`), e.g. `import { paths } from "@/routes/paths"`.
- **Data flow**: UI → React Query hook (`features/*/hooks`) → API service
  (`features/*/api`) → `apiClient`. UI never calls `apiClient` directly.
- **New feature** = add a folder under `features/`, register its page(s) in
  `routes/AppRouter.tsx`, add the path to `routes/paths.ts`.
- **Errors**: the client throws a normalised `ApiError` (`{ status, message,
  errors }`); use `isApiError()` to narrow.
- **Auth**: token in `localStorage` via `token-storage`; session state in the
  `auth.store`; 401s auto-clear and redirect to `/login`.

## Backend contract

The API base URL is `VITE_API_BASE_URL` (defaults to `/api`, proxied to
`http://localhost:5000` in dev — see `vite.config.ts`). Services assume a
`{ success, data }` response envelope (`types/api.ts`); adjust the `.data.data`
unwrap in `features/*/api/*.api.ts` if your Express routes differ.
