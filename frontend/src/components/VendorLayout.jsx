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
  "/vendor/finance/commission": {
    title: "Commission Summary",
    subtitle: "See platform deductions, per-order commission, and vendor net settlement clarity.",
  },
  "/vendor/finance/account": {
    title: "Payout Account",
    subtitle: "Manage the verified bank or UPI details used for vendor withdrawals.",
  },
  "/vendor/finance/invoices": {
    title: "Invoices",
    subtitle: "Download invoice-safe order summaries and GST-ready PDFs for your own orders.",
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
  "/vendor/influencer-commerce": {
    title: "Influencer Commerce",
    subtitle: "Launch campaigns, recruit creators, and monitor reel-driven sales attribution.",
  },
  "/vendor/influencer-commerce/discover": {
    title: "Discover Influencers",
    subtitle: "Find creators by category, audience, engagement, conversion, and revenue fit.",
  },
  "/vendor/influencer-commerce/relationships": {
    title: "My Influencers",
    subtitle: "Manage creator relationships, statuses, campaign activity, and revenue history.",
  },
  "/vendor/influencer-commerce/campaigns": {
    title: "Campaign Management",
    subtitle: "Create campaigns, review applications, and manage creator collaboration.",
  },
  "/vendor/influencer-commerce/products": {
    title: "Product Promotion",
    subtitle: "Track promoted products, affiliate revenue, clicks, orders, and commissions.",
  },
  "/vendor/influencer-commerce/affiliate": {
    title: "Affiliate Products",
    subtitle: "Monitor influencer product promotion and affiliate attribution.",
  },
  "/vendor/influencer-commerce/content": {
    title: "Content Approvals",
    subtitle: "Review submitted reels, videos, live recordings, and campaign deliverables.",
  },
  "/vendor/influencer-commerce/performance": {
    title: "Influencer Performance",
    subtitle: "Compare creator revenue, clicks, conversions, ROI, engagement, and AOV.",
  },
  "/vendor/influencer-commerce/analytics": {
    title: "Campaign Analytics",
    subtitle: "Analyze revenue, spend, commissions, funnels, and campaign comparisons.",
  },
  "/vendor/influencer-commerce/leaderboard": {
    title: "Creator Leaderboard",
    subtitle: "Rank creators by revenue, conversions, engagement, and campaign score.",
  },
  "/vendor/influencer-commerce/reports": {
    title: "Reports",
    subtitle: "Export and schedule campaign, influencer, revenue, commission, and content reports.",
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
  let activeNotificationTarget = null;
  for (const section of baseSidebarData.sections) {
    const item = section.items.find(
      (entry) => location.pathname === entry.path || location.pathname.startsWith(`${entry.path}/`)
    );
    if (item?.notificationModule || item?.notificationSubModule) {
      activeNotificationTarget = {
        module: item.notificationModule,
        subModule: item.notificationSubModule,
      };
      break;
    }
  }
  const { summary } = useRoleNotifications("vendor", activeNotificationTarget);
  const sidebarData = useVendorSidebarData({
    unreadCount: summary.total,
    summary,
  });
  const meta =
    (location.pathname.startsWith("/vendor/finance/invoices")
      ? pageMeta["/vendor/finance/invoices"]
      : location.pathname.startsWith("/vendor/analytics/products/")
        ? {
            title: "Product Performance",
            subtitle: "Drill into one product's revenue, inventory, and return behavior.",
          }
      : pageMeta[location.pathname]) || pageMeta["/vendor/dashboard"];

  if (!user || user.role !== "vendor") {
    return <Navigate to="/dashboard" replace />;
  }

  function handleMenuToggle() {
    setSidebarOpen(!sidebarOpen);
  }

  return (
    <div className={`flex min-h-screen max-w-full overflow-x-hidden bg-slate-100 dark:bg-slate-950 ${sidebarOpen ? "lg:ml-20" : "lg:ml-0"}`}>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNavigate={() => setSidebarOpen(false)}
        title={sidebarData.title}
        subtitle={sidebarData.subtitle}
        primaryItem={sidebarData.primaryItem}
        sections={sidebarData.sections}
        loading={sidebarData.loading}
        error={sidebarData.error}
      />
      <div className="flex min-w-0 max-w-full flex-1 flex-col">
        <Topbar title={meta.title} subtitle={meta.subtitle} onMenuToggle={handleMenuToggle} sidebarOpen={sidebarOpen} />
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
  );
}

export function VendorLayout() {
  return (
    <VendorModuleProvider>
      <VendorLayoutInner />
    </VendorModuleProvider>
  );
}
