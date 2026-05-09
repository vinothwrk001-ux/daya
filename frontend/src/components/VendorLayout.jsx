import { useMemo } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { Topbar } from "./Topbar";
import { Sidebar } from "./sidebar/Sidebar";
import { useVendorDashboardStore } from "../context/vendorDashboardStore";
import { useAuthStore } from "../context/authStore";
import { VendorModuleProvider, useModuleAccess } from "../context/VendorModuleContext";
import { useVendorSidebarData } from "../hooks/useVendorSidebarData";
import { useRoleNotifications } from "../hooks/useRoleNotifications";

const pageMeta = {
  "/vendor/dashboard": {
    title: "Dashboard",
    subtitle: "Track revenue, orders, fulfillment progress, and operational health.",
  },
  "/vendor/products": {
    title: "Products",
    subtitle: "Manage listings, approvals, and catalog quality without leaving the seller workspace.",
  },
  "/vendor/orders": {
    title: "Orders",
    subtitle: "Move orders through the fulfillment pipeline and keep customers informed.",
  },
  "/vendor/inventory": {
    title: "Inventory",
    subtitle: "Watch stock, thresholds, and low-stock risk across your catalog.",
  },
  "/vendor/analytics": {
    title: "Analytics",
    subtitle: "Read sales trends, top products, and performance distribution at a glance.",
  },
  "/vendor/payouts": {
    title: "Payouts",
    subtitle: "Review earnings, pending transfers, and payout history.",
  },
  "/vendor/finance": {
    title: "Wallet",
    subtitle: "Track available balance, payout requests, and finance controls with audit-friendly clarity.",
  },
  "/vendor/finance/payouts": {
    title: "Payout History",
    subtitle: "Monitor withdrawal requests, approval progress, and payout completion details.",
  },
  "/vendor/finance/ledger": {
    title: "Ledger",
    subtitle: "Inspect wallet credits, debits, and balance snapshots line by line.",
  },
  "/vendor/finance/account": {
    title: "Payout Account",
    subtitle: "Manage the verified bank or UPI details used for vendor withdrawals.",
  },
  "/vendor/earnings": {
    title: "Earnings",
    subtitle: "Track total earnings, pending payouts, and order payment health.",
  },
  "/vendor/delivery": {
    title: "Delivery",
    subtitle: "Assign courier details and maintain shipment visibility.",
  },
  "/vendor/pickups": {
    title: "Ready for Pickup",
    subtitle: "Batch ready shipments into one pickup request.",
  },
  "/vendor/notifications": {
    title: "Notifications",
    subtitle: "Stay on top of orders, payouts, system activity, and product alerts.",
  },
  "/vendor/reviews": {
    title: "Reviews",
    subtitle: "See customer feedback and reply quickly from one place.",
  },
  "/vendor/returns": {
    title: "Returns & Refunds",
    subtitle: "Handle approvals, rejections, and refund decisions with audit-friendly notes.",
  },
  "/vendor/offers": {
    title: "Discounts & Offers",
    subtitle: "Launch time-bound promotions and vendor-specific campaigns.",
  },
  "/vendor/content": {
    title: "Homepage Content",
    subtitle: "Create promotional banners and content to showcase on the homepage.",
  },
  "/vendor/influencer-commerce": {
    title: "Influencer Commerce",
    subtitle: "Launch campaigns, recruit creators, and monitor reel-driven sales attribution.",
  },
  "/vendor/support": {
    title: "Support",
    subtitle: "Open tickets with your operations team and keep a message history.",
  },
  "/vendor/settings": {
    title: "Store Settings",
    subtitle: "Control storefront, payout, notification, and security-related preferences.",
  },
};

function VendorLayoutInner() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const { sidebarOpen, setSidebarOpen } = useVendorDashboardStore();
  const { can } = useModuleAccess();
  const baseSidebarData = useVendorSidebarData();
  const activeNotificationTarget = useMemo(() => {
    for (const section of baseSidebarData.sections) {
      const item = section.items.find(
        (entry) => location.pathname === entry.path || location.pathname.startsWith(`${entry.path}/`)
      );
      if (item?.notificationModule || item?.notificationSubModule) {
        return {
          module: item.notificationModule,
          subModule: item.notificationSubModule,
        };
      }
    }
    return null;
  }, [baseSidebarData.sections, location.pathname]);
  const { summary } = useRoleNotifications("vendor", activeNotificationTarget);
  const sidebarData = useVendorSidebarData({
    unreadCount: summary.total,
    summary,
  });
  const meta = pageMeta[location.pathname] || pageMeta["/vendor/dashboard"];

  if (!user || user.role !== "vendor") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="flex min-h-screen max-w-full overflow-x-hidden">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          title={sidebarData.title}
          subtitle={sidebarData.subtitle}
          primaryItem={sidebarData.primaryItem}
          sections={sidebarData.sections}
          loading={sidebarData.loading}
          error={sidebarData.error}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar title={meta.title} subtitle={meta.subtitle} onMenuToggle={() => setSidebarOpen(true)} />
          <main className="min-w-0 max-w-full flex-1 overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                Seller workspace
              </div>
              <div className="flex flex-col gap-2 xs:flex-row xs:gap-3 text-xs sm:text-sm">
                <Link 
                  to="/vendor/dashboard" 
                  className="inline-flex justify-center rounded-xl border border-slate-200 px-3 py-2 text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  Overview
                </Link>
                {can("products.create") ? (
                  <Link 
                    to="/vendor/products/create" 
                    className="inline-flex justify-center rounded-xl bg-slate-900 px-3 py-2 font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                  >
                    Add Product
                  </Link>
                ) : null}
              </div>
            </div>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

export function VendorLayout() {
  return (
    <VendorModuleProvider>
      <VendorLayoutInner />
    </VendorModuleProvider>
  );
}
