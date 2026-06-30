import { useEffect, useRef } from "react";
import { App } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { workspaceApi } from "@/features/workspace/api/workspace.api";
import {
  clearStoredInvite,
  getStoredInvite,
} from "../invite-storage";

/**
 * Once, after the user is authenticated, redeem any stored invite token (captured
 * on the public /invite page before they signed in). The backend guards it, so
 * this is safe to fire for everyone. Refreshes all workspace-scoped data on join.
 */
export function useInviteClaim() {
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  const { message } = App.useApp();
  const qc = useQueryClient();
  const done = useRef(false);

  useEffect(() => {
    if (!isAuthed || done.current) return;
    const token = getStoredInvite();
    if (!token) return;
    done.current = true;
    workspaceApi
      .acceptInvite(token)
      .then((ws) => {
        message.success(`You've joined ${ws.name}!`);
        // The active workspace switched — refresh decks, media, credits, members.
        qc.invalidateQueries();
      })
      .catch(() => {})
      .finally(() => clearStoredInvite());
  }, [isAuthed, message, qc]);
}
