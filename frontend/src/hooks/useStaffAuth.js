import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStaffAuthStore } from "../context/staffAuthStore";
import { hasStaffPermission } from "../utils/staffPermissions";
import * as staffAuthService from "../services/staffAuthService";
import {
  logPermissionCheck,
  logPermissionSyncFailed,
  logPermissionSyncStart,
  logPermissionSyncSuccess,
  logUnauthorizedAccess,
} from "../utils/permissionLogger";

export function useStaffPermission() {
  const user = useStaffAuthStore((state) => state.user);
  const setAuth = useStaffAuthStore((state) => state.setAuth);
  const [syncing, setSyncing] = useState(false);

  const permissions = useMemo(() => user?.permissions || {}, [user]);
  const enabledModules = useMemo(() => user?.enabledModules || {}, [user]);
  const roleName = user?.role?.name || user?.roleName || null;

  // Force sync permissions from server
  const syncPermissions = useCallback(async () => {
    if (syncing) return;

    try {
      setSyncing(true);
      logPermissionSyncStart();
      const response = await staffAuthService.getMe();

      setAuth({
        user: response.data,
      });
      logPermissionSyncSuccess(response.data?.email, response.data?.permissions, response.data?.syncedAt);
    } catch (error) {
      logPermissionSyncFailed(user?.email, error);
    } finally {
      setSyncing(false);
    }
  }, [setAuth, syncing, user?.email]);

  const hasPermission = useCallback(
    (permissionKey) => {
      const [moduleName] = String(permissionKey || "").split(".");
      const result = enabledModules?.[moduleName] === false ? false : hasStaffPermission(permissions, permissionKey);
      logPermissionCheck(permissionKey, result, permissions);
      return result;
    },
    [enabledModules, permissions]
  );

  const canAccess = useCallback(
    (permissionKey) => (!permissionKey ? true : hasPermission(permissionKey)),
    [hasPermission]
  );

  const getPermissions = useCallback(() => permissions, [permissions]);
  const getRole = useCallback(() => roleName, [roleName]);

  return useMemo(
    () => ({
      permissions,
      hasPermission,
      canAccess,
      getPermissions,
      getRole,
      syncPermissions,
      syncing,
      enabledModules,
    }),
    [permissions, hasPermission, canAccess, getPermissions, getRole, syncPermissions, syncing, enabledModules]
  );
}

export function useRequirePermission(permissionKey) {
  const navigate = useNavigate();
  const user = useStaffAuthStore((state) => state.user);

  useEffect(() => {
    const [moduleName] = String(permissionKey || "").split(".");
    if (
      permissionKey &&
      user &&
      (user?.enabledModules?.[moduleName] === false || !hasStaffPermission(user.permissions, permissionKey))
    ) {
      logUnauthorizedAccess(window.location.pathname, permissionKey);
      navigate("/staff/unauthorized", { replace: true });
    }
  }, [navigate, permissionKey, user]);
}

export function useStaffUser() {
  const { user, isAuthenticated } = useStaffAuthStore();

  return {
    user,
    isAuthenticated,
    name: user?.name || "Staff",
    email: user?.email || "",
    roleId: user?.roleId || user?.role?._id || null,
    roleName: user?.role?.name || user?.roleName || null,
    status: user?.status || "active",
  };
}

export function useStaffAuthLoading() {
  const { user, isAuthenticated } = useStaffAuthStore();
  return !isAuthenticated || !user;
}

export function PermissionGate({ permission, children, fallback = null }) {
  const { hasPermission } = useStaffPermission();
  return !permission || hasPermission(permission) ? children : fallback;
}
