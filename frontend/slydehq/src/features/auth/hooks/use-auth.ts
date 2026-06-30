import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../api/auth.api";
import { useAuthStore } from "../store/auth.store";
import type {
  GoogleOneTapPayload,
  RequestOtpPayload,
  VerifyOtpPayload,
} from "../types/auth.types";

/** Passwordless step 1 — request a one-time code for an email. */
export function useRequestOtp() {
  return useMutation({
    mutationFn: (payload: RequestOtpPayload) => authApi.requestOtp(payload),
  });
}

/** Passwordless step 2 — verify the code and persist the token-only session. */
export function useVerifyOtp() {
  const setToken = useAuthStore((s) => s.setToken);

  return useMutation({
    mutationFn: (payload: VerifyOtpPayload) => authApi.verifyOtp(payload),
    onSuccess: ({ token }) => setToken(token),
  });
}

/** Verify a Google One Tap / button credential and persist the session. */
export function useGoogleOneTap() {
  const setToken = useAuthStore((s) => s.setToken);

  return useMutation({
    mutationFn: (payload: GoogleOneTapPayload) => authApi.googleOneTap(payload),
    onSuccess: ({ token }) => setToken(token),
  });
}

/** Log out: hit the endpoint, clear local session and all cached queries. */
export function useLogout() {
  const clearSession = useAuthStore((s) => s.clearSession);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      clearSession();
      queryClient.clear();
    },
  });
}
