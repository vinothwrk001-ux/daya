import { Outlet, useLocation } from "react-router-dom";
import { useMemo, useState } from "react";
import { Sidebar } from "./sidebar/Sidebar";
import { Topbar } from "./Topbar";
import { useAdminSidebarData } from "../hooks/useAdminSidebarData";
import { useRoleNotifications } from "../hooks/useRoleNotifications";
import { ADMIN_SECTION_ITEMS } from "../config/sidebarModules";

const pageMeta = {
  "/admin/dashboard": {
    title: "Dashboard",
    subtitle: "Monitor business performance, queues, and platform growth.",
  },
  "/admin/users": {
    title: "Users",
    subtitle: "Manage user accounts, access, and lifecycle actions.",
  },
  "/admin/sellers": {
    title: "Sellers",
    subtitle: "Review applications and control seller approvals.",
  },
  "/admin/products": {
    title: "Products",
    subtitle: "Moderate product catalog quality and approval workflow.",
  },
  "/admin/inventory": {
    title: "Inventory",
    subtitle: "Manage platform-owned product variants, warehouse stock, and low-stock exposure.",
  },
  "/admin/categories": {
    title: "Categories",
    subtitle: "Control category visibility, ordering, and storefront presentation.",
  },
  "/admin/orders": {
    title: "Orders",
    subtitle: "Track fulfillment progress and update order statuses.",
  },
  "/admin/payments": {
    title: "Payments",
    subtitle: "Review captured payments, verification state, and gateway records.",
  },
  "/admin/refunds": {
    title: "Refunds",
    subtitle: "Approve, reject, and reconcile refund operations.",
  },
  "/admin/payouts": {
    title: "Payouts",
    subtitle: "Manage vendor settlements, payout queues, and transfer outcomes.",
  },
  "/admin/finance/payouts": {
    title: "Payout Management",
    subtitle: "Review, approve, reject, and settle vendor payout requests safely.",
  },
  "/admin/finance/invoices": {
    title: "Invoices",
    subtitle: "Manage invoice previews, metadata versions, and PDF outputs without changing order totals.",
  },
  "/admin/finance/invoices/settings": {
    title: "Invoice Settings",
    subtitle: "Configure organization branding, GST details, invoice labels, and footer content.",
  },
  "/admin/payment-details": {
    title: "Payment Details",
    subtitle: "Inspect signature verification, linked orders, and webhook history.",
  },
  "/admin/product-modules": {
    title: "Product Modules",
    subtitle: "Control dynamic product tabs and additional info sections from admin.",
  },
  "/admin/content": {
    title: "Homepage Content",
    subtitle: "Create and manage dynamic banners, promo cards, and collection content for the homepage.",
  },
  "/admin/vendor-access": {
    title: "Vendor Module Access",
    subtitle: "Control which modules are accessible to vendors globally.",
  },
  "/admin/vendor-access/shipping": {
    title: "Shipping Access",
    subtitle: "Control which shipping modes vendors can use across the marketplace.",
  },
  "/admin/shipping": {
    title: "Shipping Configuration",
    subtitle: "Manage weight-based pricing rules and the zone resolution matrix for checkout.",
  },
  "/admin/analytics": {
    title: "Analytics",
    subtitle: "Review revenue, top products, and sales momentum.",
  },
  "/admin/revenue": {
    title: "Revenue",
    subtitle: "Track platform sales, commission, and vendor earnings with export-ready reporting.",
  },
  "/admin/audit-logs": {
    title: "Audit Logs",
    subtitle: "Inspect admin actions, compliance events, and operational history.",
  },
  "/admin/settings": {
    title: "Settings",
    subtitle: "Admin workspace preferences and operational notes.",
  },
  "/admin/pricing": {
    title: "Pricing Configuration",
    subtitle: "Manage platform-wide pricing rules, fees, and discounts.",
  },
  "/admin/pricing-categories": {
    title: "Pricing Categories",
    subtitle: "Create and manage pricing categories to organize your fees and charges.",
  },
  "/admin/roles": {
    title: "Staff Roles",
    subtitle: "Create reusable role templates and manage RBAC permissions.",
  },
  "/admin/staff": {
    title: "Staff Accounts",
    subtitle: "Provision staff access, assign roles, and control account status.",
  },
  "/staff/dashboard": {
    title: "Staff Dashboard",
    subtitle: "Your assigned workspace modules and operational overview.",
  },
  "/staff/users": {
    title: "Users",
    subtitle: "Customer records you are permitted to view or update.",
  },
  "/staff/products": {
    title: "Products",
    subtitle: "Catalog controls available to your assigned role.",
  },
  "/staff/orders": {
    title: "Orders",
    subtitle: "Order tasks and workflow actions available to your role.",
  },
  "/staff/analytics": {
    title: "Analytics",
    subtitle: "Reporting and dashboards granted to your role.",
  },
  "/staff/settings": {
    title: "Settings",
    subtitle: "Staff-facing operational settings and workspace notes.",
  },
};

export function AdminLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeNotificationTarget = useMemo(() => {
    for (const section of ADMIN_SECTION_ITEMS) {
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
  }, [location.pathname]);
  const { summary } = useRoleNotifications("admin", activeNotificationTarget);
  const sidebarData = useAdminSidebarData(summary);

  const meta = useMemo(() => {
    if (location.pathname.startsWith("/admin/sellers/")) {
      return {
        title: "Seller Details",
        subtitle: "Inspect onboarding details and decision history.",
      };
    }
    if (location.pathname.startsWith("/admin/vendors/") && location.pathname.endsWith("/finance")) {
      return {
        title: "Vendor Finance",
        subtitle: "Review wallet balances, payout requests, and ledger activity for a seller.",
      };
    }
    if (location.pathname.startsWith("/admin/payment-details/")) {
      return pageMeta["/admin/payment-details"];
    }
    if (location.pathname.startsWith("/admin/orders/") && location.pathname.endsWith("/invoice")) {
      return pageMeta["/admin/finance/invoices"];
    }
    return pageMeta[location.pathname] || pageMeta["/admin/dashboard"];
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen max-w-full overflow-x-hidden bg-slate-100 dark:bg-slate-950">
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
      <div className="flex min-w-0 max-w-full flex-1 flex-col">
        <Topbar
          title={meta.title}
          subtitle={meta.subtitle}
          onMenuToggle={() => setSidebarOpen((open) => !open)}
        />
        <main className="min-w-0 max-w-full flex-1 overflow-x-hidden px-4 py-4 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
