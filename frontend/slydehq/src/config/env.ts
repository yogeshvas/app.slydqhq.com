/**
 * Typed, centralised access to environment variables.
 *
 * All Vite env vars must be prefixed with `VITE_` to be exposed to the client.
 * Define them in `.env` / `.env.local`. Keep this file as the ONLY place that
 * reads `import.meta.env` so the rest of the app stays decoupled from Vite.
 */
export const env = {
  /** Base URL for XHR API requests. Defaults to the dev proxy in vite.config.ts. */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api",
  /**
   * Absolute backend origin. Used for full-page OAuth redirects, which must go
   * straight to the backend (the dev proxy only covers same-origin XHR).
   */
  backendUrl: import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3000",
  /** Google OAuth client ID — powers Google One Tap and the Google sign-in button. */
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
  appName: "Slyde HQ",
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const;
