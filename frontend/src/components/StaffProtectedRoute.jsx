import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useStaffAuthStore } from "../context/staffAuthStore";

export function StaffProtectedRoute() {
  const isAuthenticated = useStaffAuthStore((s) => s.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
