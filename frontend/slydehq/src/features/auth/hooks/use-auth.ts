import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../api/auth.api";
import { useAuthStore } from "../store/auth.store";
import type {
  GoogleOneTapPayload,
  LoginPayload,
  RequestOtpPayload,
  SignupPayload,
  VerifyOtpPayload,
} from "../types/auth.types";

/** React Query keys for the auth feature. */
export const authKeys = {
  me: ["auth", "me"] as const,
};

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

/** Log in, persist the session, and prime the user cache. */
export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: (session) => {
      setSession(session);
      queryClient.setQueryData(authKeys.me, session.user);
    },
  });
}

/** Register, then persist the session just like login. */
export function useSignup() {
  const setSession = useAuthStore((s) => s.setSession);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SignupPayload) => authApi.signup(payload),
    onSuccess: (session) => {
      setSession(session);
      queryClient.setQueryData(authKeys.me, session.user);
    },
  });
}

/** The current user. Only runs when a token exists; keeps the store in sync. */
export function useCurrentUser() {
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);

  return useQuery({
    queryKey: authKeys.me,
    queryFn: async () => {
      const user = await authApi.me();
      setUser(user);
      return user;
    },
    enabled: Boolean(token),
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
