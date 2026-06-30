/**
 * Decode a JWT payload WITHOUT verifying it. Verification happens server-side;
 * this is only to read non-sensitive claims (id, email) for the UI.
 * Returns null if the token is malformed.
 */
export function decodeJwt<T = Record<string, unknown>>(token: string): T | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    // base64url → base64, then decode.
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
