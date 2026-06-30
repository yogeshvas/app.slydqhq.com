# Backend Core — Conventions

Express + Bun + Mongoose + Zod. **Follow these patterns on every change** — they
already exist in the codebase, so match them rather than inventing new ones.

> Current implemented surface is logged in `../../BUILD_LOG.md`. Auth (email OTP +
> Google OAuth/One Tap), workspaces + credits, and deck generation (SSE) are built;
> editing/exports/sharing/billing are not yet.

## API surface (implemented)

- `POST /api/auth/email/request-otp` · `POST /api/auth/email/verify-otp` → `{ token }`
- `GET  /api/auth/google` + `/google/callback` (OAuth redirect) · `POST /api/auth/google/one-tap` → `{ token }`
- `GET  /api/workspaces/me` → current workspace + credits
- `POST /api/decks/generate` — **SSE**, auth; proxies ai-engine `POST /jobs` (:8080),
  persists deck/slides, charges/refunds credits
- `GET  /api/decks` · `GET /api/decks/:id` (deck + ordered slides)

Auth: `middleware/requireAuth.ts` reads `Authorization: Bearer` or `?token=` (SSE),
sets `req.auth`. New protected route = add `requireAuth` + a Zod validator.

## Request lifecycle (the golden path)

Every endpoint flows through the same layers. Do not skip a layer.

```
route → validate(schema) → controller (asyncHandler) → service → model
                                  ↓ throw ApiError          ↓ throw ApiError
                          ApiResponse.success         errorHandler (central)
```

1. **Route** (`src/routes/*`) — wire `validate(schema)` before the controller.
   ```ts
   router.post("/email/request-otp", validate(requestOtpSchema), requestOtp);
   ```
2. **Validator** (`src/validators/*`) — one Zod schema per route, wrapped in
   `z.object({ body, query, params })`. See `validators/email.auth.validator.ts`.
   The `validate` middleware (`middleware/validate.ts`) returns field-level
   `errors[]` and friendly messages — never validate by hand in a controller.
3. **Controller** (`src/controllers/*`) — thin. Wrap in `asyncHandler`, pull
   typed fields off `req.body`, call a service, return via `ApiResponse`.
   **No business logic, no DB calls, no try/catch in controllers.**
4. **Service** (`src/services/*`) — all business logic and DB access lives here.
   Services throw `ApiError`; they never touch `req`/`res`.
5. **Model** (`src/models/*`) — defined via `_base.ts` helpers.

## Errors — always throw `ApiError`, never bare `throw`/`res.status`

Use the static factories on `utils/appError.ts`. Never construct ad-hoc error
objects or call `res.status(400).json(...)`.

```ts
throw ApiError.badRequest("No code found for this email. Request a new one.");
throw ApiError.tooManyRequests(`Please wait ${remaining}s before retrying.`);
throw ApiError.unprocessableEntity("Validation failed", fieldErrors);
```

- Messages are **user-facing** — clear, actionable, no internal jargon or stack
  detail. (Good: "This code has expired. Request a new one.")
- The central `middleware/errorHandler.ts` is the **only** place that writes an
  error response. It normalizes Mongoose/Mongo errors (validation, cast,
  duplicate-key) into `ApiError`. Don't duplicate that handling in services.
- Controllers must use `asyncHandler` so thrown/rejected errors reach the
  handler. Never add try/catch just to `res.json` an error.

## Responses — always `ApiResponse`

Return through `responses/apiResponse.ts`. Never `res.json` a raw object.

```ts
return ApiResponse.success(res, { token }, "Logged in successfully.");
return ApiResponse.created(res, { id }, "Workspace created.");
```

Response shape is fixed: `{ statusCode, data, message }` on success,
`{ success: false, statusCode, message, errors }` on error. Keep it consistent.

## Logging — use the pino `logger`, never `console.log`

Import from `utils/logger.ts`. Pino is structured: **context object first,
message second.**

```ts
import { logger } from "../utils/logger";
logger.info({ email, userId }, "OTP issued");
logger.warn({ email }, "OTP verification failed");
logger.error({ err, jobId }, "Failed to render deck");
```

- `console.log` is not allowed in committed code.
- Never log secrets, raw OTPs, passwords, tokens, or full request bodies.
- 5xx are logged with the error/stack by `errorHandler`; 4xx as one-line warns.
  Don't re-log an error you're already throwing as `ApiError`.

## Models — define with `_base.ts`

Use `defineModel`, `ObjectId`, and `ref` from `models/_base.ts`. `defineModel`
adds `timestamps: true` for free — don't redefine it.

```ts
import { defineModel, ref } from "../_base";
export const Foo = defineModel("Foo", {
  workspace: ref("Workspace"),
  name: { type: String, required: true },
});
```

Models live under the domain folder: `identity/`, `billing/`, `content/`,
`generation/`.

## Constants & config — no magic values inline

- **Env-driven / secret** values → `config/env.ts` only. It is a validated Zod
  schema; add the key there with a sensible default, then read `env.X`. Never
  read `process.env` directly outside `config/`.
- **Non-secret magic numbers/strings** (limits, enums, cooldowns, role names,
  status strings) → a constants module (`config/constants.ts`, create if it
  doesn't exist). No hardcoded literals scattered across services.

```ts
// good
const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60_000);
// bad
const expiresAt = new Date(Date.now() + 10 * 60_000);
```

## Checklist before finishing any backend change

- [ ] Route has a `validate(schema)` and a Zod validator
- [ ] Controller is thin, wrapped in `asyncHandler`, no business logic
- [ ] Business logic + DB access live in a service
- [ ] Errors thrown as `ApiError.*` with user-facing messages (no `res.status`)
- [ ] Success returned via `ApiResponse.*` (no raw `res.json`)
- [ ] Logging via `logger` with a context object (no `console.log`, no secrets)
- [ ] Models use `_base.ts` helpers
- [ ] No magic values — config in `env.ts`, constants in `config/constants.ts`
