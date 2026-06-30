import { apiClient } from "@/lib/api-client";
import type { ApiSuccess } from "@/types/api";
import type {
  AuthResponse,
  GoogleOneTapPayload,
  GoogleOneTapResponse,
  LoginPayload,
  RequestOtpPayload,
  RequestOtpResponse,
  SignupPayload,
  User,
  VerifyOtpPayload,
  VerifyOtpResponse,
} from "../types/auth.types";

/**
 * Auth endpoints. These assume the backend wraps responses in the standard
 * `{ success, data }` envelope (see `types/api.ts`). Adjust the `.data.data`
 * unwrap if your Express routes return the resource directly.
 */
export const authApi = {
  /** Passwordless step 1 — email a one-time code. */
  requestOtp: (payload: RequestOtpPayload) =>
    apiClient
      .post<ApiSuccess<RequestOtpResponse>>("/auth/email/request-otp", payload)
      .then((res) => res.data.data),

  /** Passwordless step 2 — verify the code, returns a bearer token. */
  verifyOtp: (payload: VerifyOtpPayload) =>
    apiClient
      .post<ApiSuccess<VerifyOtpResponse>>("/auth/email/verify-otp", payload)
      .then((res) => res.data.data),

  /** Verify a Google One Tap / button credential, returns a bearer token. */
  googleOneTap: (payload: GoogleOneTapPayload) =>
    apiClient
      .post<ApiSuccess<GoogleOneTapResponse>>("/auth/google/one-tap", payload)
      .then((res) => res.data.data),

  login: (payload: LoginPayload) =>
    apiClient
      .post<ApiSuccess<AuthResponse>>("/auth/login", payload)
      .then((res) => res.data.data),

  signup: (payload: SignupPayload) =>
    apiClient
      .post<ApiSuccess<AuthResponse>>("/auth/register", payload)
      .then((res) => res.data.data),

  me: () =>
    apiClient
      .get<ApiSuccess<User>>("/auth/me")
      .then((res) => res.data.data),

  logout: () => apiClient.post("/auth/logout").then((res) => res.data),
};
