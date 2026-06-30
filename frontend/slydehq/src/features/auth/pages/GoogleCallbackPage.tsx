import { useEffect, useRef } from "react";
import { App as AntApp, Spin } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import { paths } from "@/routes/paths";
import { useAuthStore } from "../store/auth.store";

/**
 * Lands here after Google OAuth: the backend redirects with `?token=…` on
 * success or `?error=…` on failure. We persist the token, mark the session
 * authenticated, and forward to the dashboard.
 */
const GoogleCallbackPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
  const { message } = AntApp.useApp();
  const handled = useRef(false); // guard against StrictMode double-run

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const token = params.get("token");
    const error = params.get("error");

    if (token) {
      setToken(token);
      navigate(paths.dashboard, { replace: true });
    } else {
      message.error(
        error
          ? "Google sign-in failed. Please try again."
          : "Missing sign-in token. Please try again.",
      );
      navigate(paths.login, { replace: true });
    }
  }, [params, navigate, setToken, message]);

  return (
    <div className="grid min-h-screen place-items-center bg-zinc-50">
      <div className="flex flex-col items-center gap-3 text-zinc-500">
        <Spin size="large" />
        <span className="text-sm">Signing you in…</span>
      </div>
    </div>
  );
};

export default GoogleCallbackPage;
