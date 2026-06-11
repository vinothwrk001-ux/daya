export const STAFF_MODULES = [
  {
    key: "dashboard",
    name: "Dashboard",
    description: "Overview, access visibility, and workspace health",
    icon: "LayoutDashboard",
    route: "/staff/dashboard",
    permission: null,
    section: "main",
    order: 0,
  },
  {
    key: "users",
    name: "Users",
    description: "Browse customer accounts and apply user-level actions",
    icon: "Users",
    route: "/staff/users",
    permission: "users.read",
    section: "management",
    order: 1,
    notificationModule: "MANAGEMENT",
    notificationSubModule: "USERS",
  },
  {
    key: "orders",
    name: "Orders",
    description: "Track fulfillment, payment state, and status updates",
    icon: "ShoppingCart",
    route: "/staff/orders",
    permission: "orders.read",
    section: "management",
    order: 2,
    notificationModule: "MANAGEMENT",
    notificationSubModule: "ORDERS",
  },
  {
    key: "products",
    name: "Products",
    description: "Work the catalog with create, update, and moderation actions",
    icon: "Package",
    route: "/staff/products",
    permission: "products.read",
    section: "management",
    order: 3,
    notificationModule: "MANAGEMENT",
    notificationSubModule: "PRODUCTS",
  },
  {
    key: "reviews",
    name: "Reviews",
    description: "Manage product reviews and customer ratings",
    icon: "MessageCircle",
    route: "/staff/reviews",
    permission: "reviews.read",
    section: "management",
    order: 4,
    notificationModule: "GROWTH",
    notificationSubModule: "REVIEWS",
  },
  {
    key: "payments",
    name: "Payments",
    description: "Process and manage payment transactions",
    icon: "CreditCard",
    route: "/staff/payments",
    permission: "payments.read",
    section: "finance",
    order: 5,
    notificationModule: "FINANCE",
    notificationSubModule: "PAYMENTS",
  },
  {
    key: "analytics",
    name: "Analytics",
    description: "Platform performance metrics and insights",
    icon: "BarChart3",
    route: "/staff/analytics",
    permission: "analytics.read",
    section: "finance",
    order: 6,
  },
  {
    key: "settings",
    name: "Settings",
    description: "Platform configuration and system preferences",
    icon: "Settings",
    route: "/staff/settings",
    permission: "settings.update",
    section: "admin",
    order: 7,
    notificationModule: "WORKSPACE",
    notificationSubModule: "SETTINGS",
  },
  {
    key: "roles",
    name: "Roles",
    description: "Create and manage staff roles with permissions",
    icon: "Lock",
    route: "/staff/roles",
    permission: "roles.read",
    section: "admin",
    order: 8,
  },
  {
    key: "staff",
    name: "Staff",
    description: "Manage staff members and their access levels",
    icon: "UserCheck",
    route: "/staff/staff",
    permission: "staff.read",
    section: "admin",
    order: 9,
  },
];

export const SIDEBAR_SECTIONS = {
  main: "Navigation",
  management: "Management",
  finance: "Finance",
  admin: "Administration",
};

export function getAccessibleModules(permissions, enabledModules = {}) {
  if (!permissions) return [STAFF_MODULES[0]];

  return STAFF_MODULES.filter((module) => {
    if (!module.permission) return true;
    if (enabledModules?.[module.key] === false) return false;
    const [moduleName, action] = module.permission.split(".");
    return permissions?.[moduleName]?.[action] === true;
  }).sort((left, right) => left.order - right.order);
}

export function canAccessModule(permissions, moduleId, enabledModules = {}) {
  const module = STAFF_MODULES.find((item) => item.key === moduleId);
  if (!module) return false;
  if (!module.permission) return true;
  if (enabledModules?.[module.key] === false) return false;

  const [moduleName, action] = module.permission.split(".");
  return permissions?.[moduleName]?.[action] === true;
}

export function hasPermission(permissions, permissionKey) {
  if (!permissions || !permissionKey) return false;
  const [moduleName, action] = permissionKey.split(".");
  return permissions?.[moduleName]?.[action] === true;
}

export function getModuleActions(permissions, moduleName) {
  if (!permissions?.[moduleName]) return [];
  return Object.keys(permissions[moduleName]).filter((action) => permissions[moduleName][action]);
}

export function getDefaultStaffRoute(permissions, enabledModules = {}) {
  return getAccessibleModules(permissions, enabledModules)[0]?.route || "/staff/dashboard";
}

export function getStaffModuleByRoute(pathname) {
  return (
    STAFF_MODULES.find((module) => pathname === module.route || pathname.startsWith(`${module.route}/`)) ||
    STAFF_MODULES[0]
  );
}
