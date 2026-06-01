import { useAuthStore } from "../context/authStore";
import { useStaffAuthStore } from "../context/staffAuthStore";
import {
  LEGACY_ADMIN_ROLES,
  hasLegacyPermission,
  hasStaffPermission,
} from "../utils/staffPermissions";

export function useAdminSession() {
  const legacyUser = useAuthStore((s) => s.user);
  const staffUser = useStaffAuthStore((s) => s.user);

  const isLegacyAdmin = legacyUser && LEGACY_ADMIN_ROLES.includes(legacyUser.role);
  const isStaffSession = !isLegacyAdmin && Boolean(staffUser);

  const currentUser = isLegacyAdmin ? legacyUser : isStaffSession ? staffUser : null;
  const sessionType = isLegacyAdmin ? "legacy" : isStaffSession ? "staff" : null;
  const basePath = isLegacyAdmin ? "/admin" : isStaffSession ? "/staff" : "/admin";

  function canAccess(permission) {
    if (isLegacyAdmin) return hasLegacyPermission(legacyUser.role, permission);
    if (isStaffSession) return hasStaffPermission(staffUser?.permissions, permission);
    return false;
  }

  return {
    currentUser,
    sessionType,
    basePath,
    isLegacyAdmin,
    isStaffSession,
    isAuthenticated: Boolean(currentUser),
    canAccess,
  };
}
