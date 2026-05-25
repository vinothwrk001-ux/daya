import { useMemo, useState } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { LayoutGrid, Clapperboard, Upload, Wallet, UserRound, Megaphone, X, Store, Link2, BarChart3, Boxes } from "lucide-react";
import { useAuthStore } from "../../context/authStore";
import { usePlatformFeatures } from "../../context/PlatformFeaturesContext";
import { Topbar } from "../../components/Topbar";

const NAV = [
  { to: "/influencer/dashboard", label: "Overview", icon: LayoutGrid },
  { to: "/influencer/welcome", label: "Welcome", icon: Store },
  { to: "/influencer/collections", label: "Collections", icon: Boxes },
  { to: "/influencer/affiliate-links", label: "Affiliate links", icon: Link2 },
  { to: "/influencer/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/influencer/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/influencer/reels/upload", label: "Upload reel", icon: Upload },
  { to: "/influencer/reels", label: "My reels", icon: Clapperboard },
  { to: "/influencer/earnings", label: "Earnings", icon: Wallet },
  { to: "/influencer/profile", label: "Profile", icon: UserRound },
];

const PAGE_META = {
  "/influencer/dashboard": {
    title: "Creator overview",
    subtitle: "Earnings, attributed orders, clicks, and recent wallet activity.",
  },
  "/influencer/welcome": {
    title: "Creator activation",
    subtitle: "Badge, storefront, affiliate links, wallet, and setup checklist.",
  },
  "/influencer/collections": {
    title: "Collections",
    subtitle: "Curate products and share creator recommendations.",
  },
  "/influencer/affiliate-links": {
    title: "Affiliate links",
    subtitle: "Generate product, collection, campaign, and storefront tracking URLs.",
  },
  "/influencer/analytics": {
    title: "Analytics",
    subtitle: "Storefront, affiliate, conversion, and revenue metrics.",
  },
  "/influencer/campaigns": {
    title: "Campaigns",
    subtitle: "Review proposals, accept active partnerships, and decline what does not fit.",
  },
  "/influencer/reels/upload": {
    title: "Upload a reel",
    subtitle: "Attach content to an active campaign and tag eligible products.",
  },
  "/influencer/reels": {
    title: "Reel performance",
    subtitle: "Moderation status, engagement metrics, and storefront attribution.",
  },
  "/influencer/earnings": {
    title: "Earnings & ledger",
    subtitle: "Available balance, hold pipeline, and full transaction history.",
  },
  "/influencer/profile": {
    title: "Public profile",
    subtitle: "Categories, reach, bio, and social proof for vendor discovery.",
  },
};

export function InfluencerLayout() {
  const user = useAuthStore((s) => s.user);
  const { influencerCommerceEnabled, loading: commerceLoading } = usePlatformFeatures();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const meta = useMemo(() => {
    const hit = Object.keys(PAGE_META).find(
      (path) => location.pathname === path || location.pathname.startsWith(`${path}/`)
    );
    return PAGE_META[hit] || PAGE_META["/influencer/dashboard"];
  }, [location.pathname]);

  const userRoles = Array.from(new Set([user?.role, ...(user?.roles || [])].filter(Boolean)));
  if (!user || !userRoles.includes("influencer")) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!commerceLoading && !influencerCommerceEnabled) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="flex min-h-screen max-w-full overflow-x-hidden">
        <aside
          className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800 lg:h-16">
            <Link to="/influencer/dashboard" className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
              Creator hub
            </Link>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-90" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="shrink-0 border-t border-slate-200 p-3 dark:border-slate-800">
            <Link
              to="/"
              className="block rounded-xl px-3 py-2 text-center text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            >
              ← Back to storefront
            </Link>
          </div>
        </aside>

        {sidebarOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-20 bg-slate-950/40 lg:hidden"
            aria-label="Dismiss menu"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col lg:pl-0">
          <Topbar title={meta.title} subtitle={meta.subtitle} onMenuToggle={() => setSidebarOpen(true)} />
          <main className="min-w-0 flex-1 overflow-x-hidden px-3 py-5 sm:px-6 sm:py-7 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
