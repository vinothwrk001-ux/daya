import {
  BarChart3,
  Bell,
  Boxes,
  CreditCard,
  FileSearch,
  FolderTree,
  HeadphonesIcon,
  Image,
  LayoutDashboard,
  Package,
  Package2,
  Percent,
  RotateCcw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Star,
  Tags,
  Truck,
  Users,
  Wallet,
  UserCog,
  Clapperboard,
  Megaphone,
} from "lucide-react";

export const ADMIN_PRIMARY_ITEM = {
  name: "Dashboard",
  path: "/admin/dashboard",
  icon: LayoutDashboard,
};

export const ADMIN_SECTION_ITEMS = [
  {
    section: "Overview",
    key: "overview",
    items: [
      { name: "Analytics", path: "/admin/analytics", permission: "analytics.read", icon: BarChart3 },
      { name: "Revenue", path: "/admin/revenue", permission: "analytics.read", icon: Wallet, legacyOnly: true },
      { name: "Audit Logs", path: "/admin/audit-logs", permission: "audit.read", icon: FileSearch, legacyOnly: true },
    ],
  },
  {
    section: "Management",
    notificationModule: "MANAGEMENT",
    key: "management",
    items: [
      { name: "Users", path: "/admin/users", permission: "users.read", icon: Users, notificationModule: "MANAGEMENT", notificationSubModule: "USERS" },
      { name: "Sellers", path: "/admin/sellers", permission: "vendors.read", icon: ShoppingBag, legacyOnly: true },
      { name: "Products", path: "/admin/products", permission: "products.read", icon: Boxes, notificationModule: "MANAGEMENT", notificationSubModule: "PRODUCTS" },
      { name: "Inventory", path: "/admin/inventory", permission: "products.read", icon: Package2, notificationModule: "MANAGEMENT", notificationSubModule: "INVENTORY" },
      { name: "Orders", path: "/admin/orders", permission: "orders.read", icon: ShoppingCart, notificationModule: "MANAGEMENT", notificationSubModule: "ORDERS" },
      { name: "Pickups", path: "/admin/pickups", permission: "orders.read", icon: Truck, notificationModule: "MANAGEMENT", notificationSubModule: "DELIVERY" },
    ],
  },
  {
    section: "Catalog",
    key: "catalog",
    items: [
      { name: "Categories", path: "/admin/categories", permission: "categories.read", icon: FolderTree, legacyOnly: true },
      { name: "Subcategories", path: "/admin/subcategories", permission: "categories.read", icon: Tags, legacyOnly: true },
      { name: "Attributes", path: "/admin/attributes", permission: "categories.read", icon: Tags, legacyOnly: true },
      { name: "Product Modules", path: "/admin/product-modules", permission: "categories.read", icon: Boxes, legacyOnly: true },
      { name: "Homepage Content", path: "/admin/content", permission: "dashboard.read", icon: Image, legacyOnly: true },
      { name: "Homepage Containers", path: "/admin/homepage-containers", permission: "settings.read", icon: Image },
      { name: "Homepage Builder", path: "/admin/marketing/homepage-builder", permission: "settings.read", icon: LayoutDashboard },
      { name: "Vendor Access", path: "/admin/vendor-access", permission: "dashboard.read", icon: ShieldCheck, legacyOnly: true },
      { name: "Shipping Access", path: "/admin/vendor-access/shipping", permission: "settings.update", icon: Truck, legacyOnly: true },
    ],
  },
  {
    section: "Finance",
    notificationModule: "FINANCE",
    key: "finance",
    items: [
      { name: "Payments", path: "/admin/payments", permission: "payments.read", icon: CreditCard, notificationModule: "FINANCE", notificationSubModule: "PAYMENTS" },
      { name: "Refunds", path: "/admin/refunds", permission: "payments.read", icon: RotateCcw, notificationModule: "MANAGEMENT", notificationSubModule: "RETURNS" },
      { name: "Cancellation Policies", path: "/admin/finance/cancellation-policies", permission: "settings.read", icon: ShieldCheck, notificationModule: "FINANCE", notificationSubModule: "SETTINGS" },
      { name: "Invoices", path: "/admin/finance/invoices", permission: "orders.read", icon: FileSearch, notificationModule: "FINANCE", notificationSubModule: "PAYMENTS" },
      { name: "Payout Management", path: "/admin/finance/payouts", permission: "payouts.read", icon: Wallet, notificationModule: "FINANCE", notificationSubModule: "PAYOUTS" },
      { name: "Commission", path: "/admin/commission", permission: "settings.update", icon: Percent, notificationModule: "FINANCE", notificationSubModule: "PAYOUTS" },
      { name: "Influencers", path: "/admin/influencers", permission: "dashboard.read", icon: Clapperboard },
    ],
  },
  {
    section: "Workspace",
    notificationModule: "WORKSPACE",
    key: "workspace",
    items: [
      { name: "Settings", path: "/admin/settings", permission: "settings.update", icon: Settings, notificationModule: "WORKSPACE", notificationSubModule: "SETTINGS" },
      { name: "Shipping", path: "/admin/shipping", permission: "settings.update", icon: Truck },
      { name: "Pricing", path: "/admin/pricing", permission: "settings.update", icon: Percent },
      { name: "Pricing Categories", path: "/admin/pricing-categories", permission: "settings.update", icon: Tags },
      { name: "Staff Roles", path: "/admin/roles", permission: "roles.read", icon: ShieldCheck, legacyOnly: true },
      { name: "Staff Accounts", path: "/admin/staff", permission: "staff.read", icon: UserCog, legacyOnly: true },
    ],
  },
];

export const VENDOR_PRIMARY_ITEM = {
  name: "Dashboard",
  path: "/vendor/dashboard",
  icon: LayoutDashboard,
};

export const VENDOR_DYNAMIC_MODULE_META = {
  analytics: { section: "Finance", path: "/vendor/analytics", icon: BarChart3 },
  delivery: { section: "Management", path: "/vendor/delivery", icon: Truck, notificationModule: "MANAGEMENT", notificationSubModule: "DELIVERY" },
  homepage_content: { section: "Marketing", path: "/vendor/content", icon: Image },
  inventory: { section: "Management", path: "/vendor/inventory", icon: Package2, notificationModule: "MANAGEMENT", notificationSubModule: "INVENTORY" },
  orders: { section: "Management", path: "/vendor/orders", icon: ShoppingCart, notificationModule: "MANAGEMENT", notificationSubModule: "ORDERS" },
  payments: { section: "Finance", path: "/vendor/finance", icon: CreditCard, notificationModule: "FINANCE", notificationSubModule: "PAYOUTS" },
  products: { section: "Management", path: "/vendor/products", icon: Package, notificationModule: "MANAGEMENT", notificationSubModule: "PRODUCTS" },
  returns: { section: "Management", path: "/vendor/returns", icon: RotateCcw, notificationModule: "MANAGEMENT", notificationSubModule: "RETURNS" },
  reviews: { section: "Growth", path: "/vendor/reviews", icon: Star, notificationModule: "GROWTH", notificationSubModule: "REVIEWS" },
};

export const VENDOR_STATIC_ITEMS = [
  {
    section: "Workspace",
    notificationModule: "WORKSPACE",
    key: "workspace",
    items: [
      { name: "Notifications", path: "/vendor/notifications", icon: Bell, badgeKey: "notificationsUnread" },
      { name: "Ready for Pickup", path: "/vendor/pickups", icon: Truck },
      { name: "Offers", path: "/vendor/offers", icon: Percent },
      { name: "Influencer Commerce", path: "/vendor/influencer-commerce", icon: Megaphone },
      { name: "Support", path: "/vendor/support", icon: HeadphonesIcon, notificationModule: "WORKSPACE", notificationSubModule: "SUPPORT" },
      { name: "Settings", path: "/vendor/settings", icon: Settings, notificationModule: "WORKSPACE", notificationSubModule: "SETTINGS" },
    ],
  },
];
