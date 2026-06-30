import { useEffect, useRef } from "react";
import { App } from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { workspaceKeys } from "@/features/workspace/hooks/use-workspace";
import {
  clearStoredRef,
  getStoredRef,
  referralApi,
} from "../api/referral.api";

export const referralKeys = { me: ["referral", "me"] as const };

/** The signed-in user's referral code + stats (for the Refer & earn screen). */
export function useReferral() {
  return useQuery({ queryKey: referralKeys.me, queryFn: referralApi.me });
}

/**
 * Once, after the user is authenticated, redeem any stored ?ref= code. Backend
 * guards it (only brand-new accounts get rewarded), so this is safe to fire for
 * everyone. Clears the code after the attempt regardless.
 */
export function useReferralClaim() {
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  const { message } = App.useApp();
  const qc = useQueryClient();
  const done = useRef(false);

  useEffect(() => {
    if (!isAuthed || done.current) return;
    const code = getStoredRef();
    if (!code) return;
    done.current = true;
    referralApi
      .claim(code)
      .then((res) => {
        if (res.claimed) {
          message.success(`🎁 +${res.refereeReward} bonus credits from your invite!`);
          qc.invalidateQueries({ queryKey: workspaceKeys.me });
        }
      })
      .catch(() => {})
      .finally(() => clearStoredRef());
  }, [isAuthed, message, qc]);
}
