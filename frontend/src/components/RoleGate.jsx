import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../context/authStore";

export function RoleGate({ roles }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  const userRoles = Array.from(new Set([user.role, ...(user.roles || [])].filter(Boolean)));
  if (!userRoles.some((role) => roles.includes(role))) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

