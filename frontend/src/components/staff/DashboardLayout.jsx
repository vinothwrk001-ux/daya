import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useStaffAuthStore } from "../../context/staffAuthStore";
import { StaffSidebar } from "./Sidebar";
import { StaffTopbar } from "./Topbar";
import * as staffAuthService from "../../services/staffAuthService";
import { getStaffModuleByRoute } from "../../config/staffModules";
import { useRoleNotifications } from "../../hooks/useRoleNotifications";
import {
  logPermissionSyncFailed,
  logPermissionSyncStart,
  logPermissionSyncSuccess,
  logPeriodicSync,
} from "../../utils/permissionLogger";

// Periodic sync interval - 5 minutes
const PERMISSION_SYNC_INTERVAL = 5 * 60 * 1000;

export function StaffDashboardLayout({ children }) {
  const { isAuthenticated, user } = useStaffAuthStore();
  const setAuth = useStaffAuthStore((state) => state.setAuth);
  const logout = useStaffAuthStore((state) => state.logout);
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Calculate active module and notification target before any hooks (for consistency)
  const activeModule = getStaffModuleByRoute(location.pathname);
  const activeNotificationTarget = activeModule?.notificationModule || activeModule?.notificationSubModule
    ? {
        module: activeModule.notificationModule,
        subModule: activeModule.notificationSubModule,
      }
    : null;

  // Call all hooks at the top level before any conditional returns
  const { summary } = useRoleNotifications("staff", activeNotificationTarget);

  // Initial sync and periodic sync
  useEffect(() => {
    let active = true;
    let syncInterval = null;

    async function syncSession() {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        logPermissionSyncStart();
        const response = await staffAuthService.getMe();
        
        if (active) {
          setAuth({
            user: response.data,
          });
          logPermissionSyncSuccess(response.data?.email, response.data?.permissions, response.data?.syncedAt);
          setLastSyncTime(new Date());
          setError("");
        }
      } catch (err) {
        if (!active) return;

        if (err.response?.status === 401) {
          logout();
          return;
        }

        const errorMsg = err.response?.data?.message || "Failed to load the latest staff permissions.";
        setError(errorMsg);
        logPermissionSyncFailed(user?.email, err);
      } finally {
        if (active) setLoading(false);
      }
    }

    // Initial sync on mount
    syncSession();

    // Setup periodic sync
    syncInterval = setInterval(() => {
      logPeriodicSync(PERMISSION_SYNC_INTERVAL);
      syncSession();
    }, PERMISSION_SYNC_INTERVAL);

    const handleWindowFocus = () => {
      syncSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncSession();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      if (syncInterval) clearInterval(syncInterval);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated, logout, setAuth, user?.email]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="enterprise-shell flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-brand-primary" />
          <p className="mt-4 text-sm text-slate-600">Loading staff workspace...</p>
          {lastSyncTime && (
            <p className="mt-2 text-xs text-slate-400">
              Last synced: {lastSyncTime.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="enterprise-shell flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-[1.5rem] border border-rose-200 bg-white p-6 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Unable to load workspace</h2>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="enterprise-primary-button w-full rounded-xl px-4 py-2 text-sm font-semibold"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="enterprise-secondary-button w-full rounded-xl px-4 py-2 text-sm font-semibold"
            >
              Logout
            </button>
          </div>
          {lastSyncTime && (
            <p className="mt-4 text-xs text-slate-400">
              Last synced: {lastSyncTime.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="enterprise-shell flex min-h-screen overflow-hidden">
      <StaffSidebar
        permissions={user?.permissions || {}}
        enabledModules={user?.enabledModules || {}}
        summary={summary}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((current) => !current)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <StaffTopbar
          user={user}
          role={user?.role || null}
          permissions={user?.permissions || {}}
          module={activeModule}
          onMenuToggle={() => setSidebarOpen((current) => !current)}
        />

        <main className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children || <Outlet />}</div>
        </main>
      </div>

      {sidebarOpen ? (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          aria-label="Close sidebar overlay"
        />
      ) : null}
    </div>
  );
}
