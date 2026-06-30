import axios, { AxiosError, type AxiosInstance } from "axios";
import { env } from "@/config/env";
import { paths } from "@/routes/paths";
import type { ApiError, ApiErrorBody } from "@/types/api";
import { tokenStorage } from "./token-storage";

/**
 * The shared axios instance. Import this in feature `*.api.ts` files only — UI
 * code should go through React Query hooks, never call the client directly.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true, // send cookies (refresh token / session) by default
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

// Request: attach the bearer token if we have one.
apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

// Response: unwrap nothing here, but normalise errors into a predictable shape
// and globally handle expired sessions (401).
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status ?? 0;

    // Session expired / unauthenticated — clear and bounce to login.
    // Skip if we're already on an auth page to avoid redirect loops.
    if (status === 401 && !location.pathname.startsWith(paths.login)) {
      tokenStorage.clear();
      location.assign(paths.login);
    }

    const normalised: ApiError = {
      status,
      message:
        error.response?.data?.message ??
        error.message ??
        "Something went wrong. Please try again.",
      errors: error.response?.data?.errors,
    };
    return Promise.reject(normalised);
  },
);

/** Type guard for the normalised `ApiError` thrown by the client. */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    "message" in error
  );
}
