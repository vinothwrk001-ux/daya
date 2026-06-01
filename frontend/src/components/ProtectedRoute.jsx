import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../context/authStore";
import { saveRedirectAfterLogin } from "../utils/loginRedirect";

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();
  if (!isAuthenticated) {
    const attemptedPath = `${location.pathname}${location.search}${location.hash}`;
    if (attemptedPath && attemptedPath !== "/login") {
      saveRedirectAfterLogin(window.location.origin + attemptedPath);
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}

