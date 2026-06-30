import { App as AntApp } from "antd";
import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isApiError } from "@/lib/api-client";
import { env } from "@/config/env";
import { paths } from "@/routes/paths";
import {
  ensureGoogleIdentity,
  promptOneTap,
  renderGoogleButton,
} from "../lib/google-identity";
import { useAuthStore } from "../store/auth.store";
import { useGoogleOneTap } from "./use-auth";

interface Options {
  /** Auto-show the One Tap prompt on mount (skipped when already signed in). */
  oneTap?: boolean;
}

/**
 * Drives Google Identity Services for a page: handles the returned credential,
 * signs the user in, and navigates to the dashboard. Returns a callback ref to
 * render the official Google button, plus the configured flag.
 */
export function useGoogleIdentity({ oneTap = false }: Options = {}) {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const verify = useGoogleOneTap();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const configured = Boolean(env.googleClientId);

  const handleCredential = useCallback(
    async (credential: string) => {
      try {
        await verify.mutateAsync({ credential });
        navigate(paths.dashboard, { replace: true });
      } catch (error) {
        message.error(
          isApiError(error) ? error.message : "Google sign-in failed.",
        );
      }
    },
    [verify, navigate, message],
  );

  // Callback ref: render the Google button once GIS is ready.
  const googleButtonRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !configured) return;
      ensureGoogleIdentity(handleCredential)
        .then(() => renderGoogleButton(node))
        .catch(() => {
          /* button just won't render; email login still works */
        });
    },
    [configured, handleCredential],
  );

  // Auto One Tap prompt — only when enabled and the user isn't signed in.
  useEffect(() => {
    if (!oneTap || !configured || isAuthenticated) return;
    ensureGoogleIdentity(handleCredential)
      .then(() => promptOneTap())
      .catch(() => {
        /* One Tap unavailable; ignore */
      });
  }, [oneTap, configured, isAuthenticated, handleCredential]);

  return { googleButtonRef, configured };
}
