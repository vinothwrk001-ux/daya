import {
  BarChart3,
  Boxes,
  FileSearch,
  FolderTree,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tags,
  Truck,
  Users,
  Wallet,
  UserCog,
} from "lucide-react";

export const ADMIN_SIDEBAR_CONFIG = [
  {
    section: "Overview",
    key: "overview",
    items: [
      {
        name: "Analytics",
        path: "/admin/analytics",
        permission: "analytics.read",
        icon: BarChart3,
      },
      {
        name: "Revenue",
        path: "/admin/revenue",
        permission: "analytics.read",
        icon: Wallet,
        legacyOnly: true,
      },
      {
        name: "Audit Logs",
        path: "/admin/audit-logs",
        permission: "audit.read",
        icon: FileSearch,
        legacyOnly: true,
      },
    ],
  },
  {
    section: "Management",
    key: "management",
    items: [
      {
        name: "Users",
        path: "/admin/users",
        permission: "users.read",
        icon: Users,
      },
      {
        name: "Products",
        path: "/admin/products",
        permission: "products.read",
        icon: Boxes,
      },
      {
        name: "Orders",
        path: "/admin/orders",
        permission: "orders.read",
        icon: ShoppingCart,
      },
    ],
  },
  {
    section: "Catalog",
    key: "catalog",
    items: [
      {
        name: "Categories",
        path: "/admin/categories",
        permission: "categories.read",
        icon: FolderTree,
        legacyOnly: true,
      },
      {
        name: "Subcategories",
        path: "/admin/subcategories",
        permission: "categories.read",
        icon: Tags,
        legacyOnly: true,
      },
      {
        name: "Attributes",
        path: "/admin/attributes",
        permission: "categories.read",
        icon: Tags,
        legacyOnly: true,
      },
      {
        name: "Product Modules",
        path: "/admin/product-modules",
        permission: "categories.read",
        icon: Boxes,
        legacyOnly: true,
      },
    ],
  },
  {
    section: "Workspace",
    key: "workspace",
    items: [
      {
        name: "Settings",
        path: "/admin/settings",
        permission: "settings.update",
        icon: Settings,
      },
      {
        name: "Shipping",
        path: "/admin/shipping",
        permission: "settings.update",
        icon: Truck,
      },
      {
        name: "Staff Roles",
        path: "/admin/roles",
        permission: "roles.read",
        icon: ShieldCheck,
        legacyOnly: true,
      },
      {
        name: "Staff Accounts",
        path: "/admin/staff",
        permission: "staff.read",
        icon: UserCog,
        legacyOnly: true,
      },
    ],
  },
];
