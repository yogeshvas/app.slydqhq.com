import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "./api-client";

/**
 * App-wide React Query configuration. Sensible defaults for a dashboard app:
 * cache for a minute, don't refetch on every window focus, and don't retry
 * client errors (4xx) — only transient ones.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (isApiError(error) && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
