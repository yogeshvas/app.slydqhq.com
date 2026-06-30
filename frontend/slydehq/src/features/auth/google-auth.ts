import { env } from "@/config/env";

/**
 * Kick off the Google OAuth flow. This is a full-page navigation (not an XHR):
 * the browser goes to the backend, which redirects to Google, then back to the
 * frontend `/auth/google/callback?token=…` route once authenticated.
 */
export function redirectToGoogle(): void {
  // Go straight to the backend origin so the browser actually lands on the
  // OAuth endpoint (e.g. http://localhost:3000/api/auth/google), not the SPA.
  window.location.assign(`${env.backendUrl}/api/auth/google`);
}
