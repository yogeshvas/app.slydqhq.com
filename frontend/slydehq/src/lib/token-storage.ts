/**
 * Single source of truth for the auth token's persistence.
 *
 * Kept separate from the auth store so the API client can read the token in its
 * request interceptor without importing React/zustand (avoids a circular dep).
 */
const TOKEN_KEY = "slydehq.token";

export const tokenStorage = {
  get(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
  },
};
