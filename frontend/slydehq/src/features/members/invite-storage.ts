/**
 * Persist a pending invite token across the sign-in round-trip (Google OAuth is a
 * full-page redirect, email OTP swaps the view), so we can auto-accept once the
 * user is authenticated — mirrors the referral capture/claim pattern.
 */
const INVITE_KEY = "slyde_invite_token";

export const storeInviteToken = (token: string) =>
  localStorage.setItem(INVITE_KEY, token);
export const getStoredInvite = () => localStorage.getItem(INVITE_KEY);
export const clearStoredInvite = () => localStorage.removeItem(INVITE_KEY);
