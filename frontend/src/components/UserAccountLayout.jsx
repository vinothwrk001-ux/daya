import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { useAuthStore } from "../context/authStore";
import { getUserNotifications } from "../services/userService";
import { resolveApiAssetUrl } from "../utils/resolveUrl";
import { SEO } from "./SEO";

const navItems = [
  { label: "Dashboard", path: "/dashboard/user" },
  { label: "Profile", path: "/profile" },
  { label: "Orders", path: "/orders" },
  { label: "Addresses", path: "/addresses" },
  { label: "Wishlist", path: "/wishlist" },
  { label: "Saved Reels", path: "/saved-reels" },
  { label: "Reviews", path: "/reviews" },
  { label: "Support", path: "/support" },
  { label: "Settings", path: "/settings" },
];

export function UserAccountLayout() {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getUserNotifications({ page: 1, limit: 1 })
      .then((response) => {
        if (!cancelled) {
          setUnreadNotifications(response.data?.unreadCount || 0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUnreadNotifications(0);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);

  const initials = useMemo(
    () =>
      user?.name
        ?.split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "U",
    [user?.name]
  );

  const avatarUrl = resolveApiAssetUrl(user?.avatarUrl);

  return (
    <>
      <SEO title="User Account" robots="noindex,nofollow" />
      <div className="flex min-h-screen flex-col gap-4 overflow-x-safe px-3 py-4 sm:px-4 sm:py-6 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6 lg:px-8 lg:py-8">
      {/* Sidebar — drawer on mobile, fixed column on desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(100vw,18rem)] flex-col safe-area-inset border-r border-slate-200 bg-white shadow-2xl transition-transform duration-300 dark:border-slate-800 dark:bg-slate-900 lg:static lg:z-0 lg:w-auto lg:translate-x-0 lg:rounded-3xl lg:border lg:shadow-sm ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${sidebarOpen ? "block" : "hidden lg:block"}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-slate-800 lg:hidden">
          <span className="text-sm font-semibold text-slate-900 dark:text-white">Account menu</span>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="touch-target inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto overscroll-contain p-3 sm:p-4">
          <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Customer panel</div>
            <div className="mt-3 flex items-center gap-3">
              {avatarUrl ? (
                <img src={avatarUrl} alt={user?.name || "User"} className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 rounded-2xl object-cover" />
              ) : (
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xs sm:text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-xs sm:text-sm font-semibold text-slate-950 dark:text-white">{user?.name}</div>
                <div className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email || user?.phone}</div>
              </div>
            </div>
          </div>

          <nav className="mt-4 grid gap-1">
            {navItems.map((item) => {
              const active = location.pathname === item.path || (item.path !== "/dashboard/user" && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`touch-target rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-medium transition ${
                    active
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                      : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="min-w-0 flex flex-col gap-4">
        {/* Top Bar */}
        <div className="flex flex-col gap-3 rounded-2xl lg:rounded-3xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setSidebarOpen((current) => !current)}
              className="touch-target inline-flex lg:hidden self-start rounded-xl border border-slate-300 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-expanded={sidebarOpen}
            >
              Menu
            </button>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Account center</div>
              <div className="text-base sm:text-lg font-semibold text-slate-950 dark:text-white">Manage orders, profile & support</div>
            </div>
          </div>

          <div className="flex flex-col gap-2 xs:flex-row xs:flex-wrap">
            <Link
              to="/notifications"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 flex-1 xs:flex-none"
            >
              Notifications
              {unreadNotifications > 0 ? (
                <span className="ml-1 inline-flex flex-shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-white">{unreadNotifications}</span>
              ) : null}
            </Link>
            <Link
              to="/shop"
              className="inline-flex justify-center rounded-xl bg-blue-600 px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-blue-700 flex-1 xs:flex-none"
            >
              Continue shopping
            </Link>
          </div>
        </div>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen ? (
          <div
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        ) : null}

        <Outlet />
      </div>
    </div>
    </>
  );
}
