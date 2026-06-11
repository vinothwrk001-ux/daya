import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboard, listOrders, listProducts, listUsers } from "../services/adminApi";
import { getAccessibleModules } from "../config/staffModules";
import { useStaffPermission, useStaffUser } from "../hooks/useStaffAuth";

const FALLBACK_STATS = {
  users: { label: "Users", value: "Access granted", icon: UsersIcon, accent: "bg-sky-50 text-sky-700" },
  orders: { label: "Orders", value: "Access granted", icon: ReceiptIcon, accent: "bg-emerald-50 text-emerald-700" },
  products: { label: "Products", value: "Access granted", icon: PackageIcon, accent: "bg-amber-50 text-amber-700" },
};

function formatCompact(value) {
  if (typeof value !== "number") return value;
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function StaffDashboardPage() {
  const { user } = useStaffUser();
  const { hasPermission, permissions } = useStaffPermission();
  const enabledModules = useMemo(() => user?.enabledModules || {}, [user?.enabledModules]);
  const accessibleModules = useMemo(
    () => getAccessibleModules(permissions, enabledModules),
    [enabledModules, permissions]
  );
  const visibleModules = useMemo(
    () => accessibleModules.filter((module) => module.key !== "dashboard"),
    [accessibleModules]
  );
  const effectivePermissionEntries = useMemo(
    () =>
      Object.entries(permissions)
        .filter(([moduleName]) => enabledModules?.[moduleName] !== false)
        .map(([moduleName, actions]) => [
          moduleName,
          Object.fromEntries(
            Object.entries(actions || {}).filter(([action]) => hasPermission(`${moduleName}.${action}`))
          ),
        ])
        .filter(([, actions]) => Object.keys(actions).length > 0),
    [enabledModules, hasPermission, permissions]
  );
  const canReadAnalytics = enabledModules.analytics !== false && hasPermission("analytics.read");
  const canReadUsers = enabledModules.users !== false && hasPermission("users.read");
  const canReadOrders = enabledModules.orders !== false && hasPermission("orders.read");
  const canReadProducts = enabledModules.products !== false && hasPermission("products.read");

  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadStats() {
      setLoading(true);
      const tasks = [];

      if (canReadAnalytics) {
        tasks.push(getDashboard().then((response) => ({ type: "dashboard", payload: response.data })));
      }
      if (canReadUsers) {
        tasks.push(listUsers().then((response) => ({ type: "users", payload: response.data })));
      }
      if (canReadOrders) {
        tasks.push(listOrders({ page: 1, limit: 1 }).then((response) => ({ type: "orders", payload: response.data })));
      }
      if (canReadProducts) {
        tasks.push(listProducts({ page: 1, limit: 1 }).then((response) => ({ type: "products", payload: response.data })));
      }

      const results = await Promise.allSettled(tasks);
      if (!active) return;

      const nextStats = [];

      for (const result of results) {
        if (result.status !== "fulfilled") continue;

        if (result.value.type === "dashboard") {
          const totals = result.value.payload?.totals || {};
          nextStats.push({
            key: "revenue",
            label: "Platform Revenue",
            value: typeof totals.revenue === "number" ? `$${formatCompact(totals.revenue)}` : "Available",
            icon: ShieldCheckIcon,
            accent: "bg-slate-900 text-white",
          });
        }

        if (result.value.type === "users") {
          nextStats.push({
            key: "users",
            ...FALLBACK_STATS.users,
            value: Array.isArray(result.value.payload) ? formatCompact(result.value.payload.length) : FALLBACK_STATS.users.value,
          });
        }

        if (result.value.type === "orders") {
          nextStats.push({
            key: "orders",
            ...FALLBACK_STATS.orders,
            value: formatCompact(result.value.payload?.pagination?.total || 0),
          });
        }

        if (result.value.type === "products") {
          nextStats.push({
            key: "products",
            ...FALLBACK_STATS.products,
            value: formatCompact(result.value.payload?.pagination?.total || 0),
          });
        }
      }

      setStats(nextStats);
      setLoading(false);
    }

    loadStats();

    return () => {
      active = false;
    };
  }, [canReadAnalytics, canReadUsers, canReadOrders, canReadProducts]);

  return (
    <div className="space-y-6">
      <section className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-md">
        <div className="grid gap-6 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.16),_transparent_42%),linear-gradient(135deg,_#0f172a,_#1e293b)] px-6 py-8 text-white lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,.8fr)] lg:px-8">
          <div>
            <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-200">
              Staff Access
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">Welcome back, {user?.name || "Staff"}.</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-200">
              This dashboard is generated from your live role permissions. When an admin changes your role,
              the workspace refreshes from the latest `/api/staff/auth/me` response.
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Current access</div>
            <div className="mt-4 text-4xl font-semibold">{visibleModules.length}</div>
            <div className="mt-1 text-sm text-slate-300">
              module{visibleModules.length === 1 ? "" : "s"} available in your workspace
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-[1.5rem] bg-slate-100" />
            ))
          : stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <article key={stat.key} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-md">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                      <p className="mt-3 text-3xl font-semibold text-slate-950">{stat.value}</p>
                    </div>
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${stat.accent}`}>
                      <Icon size={20} />
                    </div>
                  </div>
                </article>
              );
            })}
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-md">
        <h2 className="text-xl font-semibold text-slate-950">Modules you can access</h2>
        <p className="mt-1 text-sm text-slate-500">Every card below is generated from the shared staff module config.</p>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleModules.map((module) => (
              <Link
                key={module.key}
                to={module.route}
                className="group rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-amber-300 hover:bg-white hover:shadow-lg"
              >
                <div className="text-sm font-semibold text-slate-950">{module.name}</div>
                <p className="mt-2 text-sm text-slate-500">{module.description}</p>
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-amber-700">
                  Open module
                  <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-md">
        <h2 className="text-xl font-semibold text-slate-950">Permission matrix</h2>
        <p className="mt-1 text-sm text-slate-500">
          Actions currently available after applying both your role and global module access.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {effectivePermissionEntries
            .map(([moduleName, actions]) => (
              <div key={moduleName} className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold capitalize text-slate-950">{moduleName}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(actions)
                    .map(([action]) => (
                      <span
                        key={action}
                        className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"
                      >
                        {action}
                      </span>
                    ))}
                </div>
              </div>
            ))}
        </div>
        {!effectivePermissionEntries.length ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            No staff permissions are currently active.
          </div>
        ) : null}
      </section>
    </div>
  );
}

function IconBase({ className = "h-5 w-5", children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function UsersIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="3" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 4.13a3 3 0 0 1 0 5.74" />
    </IconBase>
  );
}

function ReceiptIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21V3Z" />
      <path d="M9.5 8h5" />
      <path d="M9.5 12h5" />
      <path d="M9.5 16h3" />
    </IconBase>
  );
}

function PackageIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="m12 2 8 4.5v11L12 22 4 17.5v-11L12 2Z" />
      <path d="M12 22V11.5" />
      <path d="m20 6.5-8 5-8-5" />
    </IconBase>
  );
}

function ShieldCheckIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-3Z" />
      <path d="m9.5 12 1.8 1.8 3.7-4.3" />
    </IconBase>
  );
}

function ArrowRightIcon({ className = "h-4 w-4" }) {
  return (
    <IconBase className={className}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </IconBase>
  );
}
