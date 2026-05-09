import { Navigate } from "react-router-dom";
import { useAuthStore } from "../context/authStore";

export function DashboardRedirect() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;

  if (["admin", "super_admin", "support_admin", "finance_admin"].includes(user.role)) {
    return <Navigate to="/dashboard/admin" replace />;
  }
  if (user.role === "vendor") return <Navigate to="/dashboard/vendor" replace />;
  if (user.role === "influencer") return <Navigate to="/influencer/dashboard" replace />;
  return <Navigate to="/dashboard/user" replace />;
}
