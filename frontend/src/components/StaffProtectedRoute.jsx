import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useStaffAuthStore } from "../context/staffAuthStore";
import * as staffAuthService from "../services/staffAuthService";

export function StaffProtectedRoute() {
  const isAuthenticated = useStaffAuthStore((s) => s.isAuthenticated);
  const setAuth = useStaffAuthStore((s) => s.setAuth);
  const location = useLocation();
  const [checkingSession, setCheckingSession] = useState(!isAuthenticated);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      if (isAuthenticated) {
        setCheckingSession(false);
        return;
      }

      setCheckingSession(true);
      try {
        const response = await staffAuthService.refreshSession();
        if (!cancelled) setAuth(response?.data || response);
      } catch {
        // The redirect below handles unauthenticated staff after the refresh check.
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, setAuth]);

  if (checkingSession) {
    return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-slate-500">Restoring session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
