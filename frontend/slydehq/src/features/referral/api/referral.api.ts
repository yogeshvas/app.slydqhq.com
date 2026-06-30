import { apiClient } from "@/lib/api-client";
import type { ApiSuccess } from "@/types/api";

export interface ReferralInfo {
  code: string;
  link: string;
  friendsJoined: number;
  creditsEarned: number;
  thisMonth: number;
  monthlyCap: number;
  rewardPerReferral: number;
  refereeReward: number;
}

export const referralApi = {
  me: () =>
    apiClient
      .get<ApiSuccess<ReferralInfo>>("/referral/me")
      .then((r) => r.data.data),

  claim: (code: string) =>
    apiClient
      .post<ApiSuccess<{ claimed: boolean; refereeReward?: number }>>(
        "/referral/claim",
        { code },
      )
      .then((r) => r.data.data),
};

const REF_KEY = "slyde_ref_code";

/** Persist a ?ref= code from the URL so it survives the signup round-trip. */
export function captureRefCode() {
  const code = new URLSearchParams(window.location.search).get("ref");
  if (code) localStorage.setItem(REF_KEY, code.trim());
}
export const getStoredRef = () => localStorage.getItem(REF_KEY);
export const clearStoredRef = () => localStorage.removeItem(REF_KEY);
