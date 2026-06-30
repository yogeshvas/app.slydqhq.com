export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt?: string;
}

/** Claims carried in our JWT (see backend google.controller). */
export interface JwtClaims {
  id: string;
  email: string;
  iat?: number;
  exp?: number;
}

/** Step 1 of passwordless login: request a one-time code for an email. */
export interface RequestOtpPayload {
  email: string;
}

/** Echoes back the email the code was sent to. */
export interface RequestOtpResponse {
  email: string;
}

/** Step 2: verify the emailed code. `name` is only applied when verifying
 * creates a new account (passwordless sign-up). */
export interface VerifyOtpPayload {
  email: string;
  otp: string;
  name?: string;
}

/** Verify returns a token only; the user is derived from the JWT claims. */
export interface VerifyOtpResponse {
  token: string;
}

/** Google One Tap / button — the GIS credential (ID token) to verify. */
export interface GoogleOneTapPayload {
  credential: string;
}

/** Returns a token only, like OTP verify. */
export interface GoogleOneTapResponse {
  token: string;
}

/** Returned by login/signup. `token` is the JWT we persist for the bearer. */
export interface AuthResponse {
  user: User;
  token: string;
}
