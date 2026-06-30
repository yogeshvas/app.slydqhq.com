import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { paths } from "./paths";

/**
 * Guards nested routes behind authentication. Unauthenticated users are sent to
 * login, preserving where they were headed so we can return them after sign-in.
 */
const ProtectedRoute = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={paths.login} replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
