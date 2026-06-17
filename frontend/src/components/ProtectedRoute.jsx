import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../context/authStore";
import { saveRedirectAfterLogin } from "../utils/loginRedirect";

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authReady = useAuthStore((s) => s.authReady);
  const location = useLocation();

  if (!authReady) {
    return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-slate-500">Restoring session...</div>;
  }

  if (!isAuthenticated) {
    const attemptedPath = `${location.pathname}${location.search}${location.hash}`;
    if (attemptedPath && attemptedPath !== "/login") {
      saveRedirectAfterLogin(window.location.origin + attemptedPath);
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}

