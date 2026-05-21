/**
 * Vendor Module Configuration
 * Defines all available modules and their properties
 */

const VENDOR_MODULE_CONFIG = {
  delivery: {
    key: "delivery",
    name: "Delivery",
    description: "Manage shipment workflows and fulfillment updates",
    icon: "Truck",
    category: "operations",
    requiredPermission: "delivery:read",
    default: {
      enabled: true,
      vendorEnabled: true,
    },
  },

  orders: {
    key: "orders",
    name: "Orders",
    description: "View and manage vendor orders",
    icon: "ShoppingCart",
    category: "operations",
    requiredPermission: "orders:read",
    default: {
      enabled: true,
      vendorEnabled: true,
    },
  },

  products: {
    key: "products",
    name: "Products",
    description: "Create and manage vendor products",
    icon: "Package",
    category: "operations",
    requiredPermission: "products:read",
    default: {
      enabled: true,
      vendorEnabled: true,
    },
  },

  payments: {
    key: "payments",
    name: "Payments",
    description: "View payment history and details",
    icon: "CreditCard",
    category: "finance",
    requiredPermission: "payments:read",
    default: {
      enabled: true,
      vendorEnabled: true,
    },
  },

  analytics: {
    key: "analytics",
    name: "Analytics",
    description: "View sales analytics and reports",
    icon: "BarChart3",
    category: "analytics",
    requiredPermission: "analytics:read",
    default: {
      enabled: true,
      vendorEnabled: true,
    },
  },

  inventory: {
    key: "inventory",
    name: "Inventory",
    description: "Manage product inventory and stock",
    icon: "Package2",
    category: "operations",
    requiredPermission: "inventory:read",
    default: {
      enabled: true,
      vendorEnabled: true,
    },
  },

  returns: {
    key: "returns",
    name: "Returns",
    description: "Handle return requests",
    icon: "RotateCcw",
    category: "operations",
    requiredPermission: "returns:read",
    default: {
      enabled: true,
      vendorEnabled: true,
    },
  },

  reviews: {
    key: "reviews",
    name: "Reviews",
    description: "Manage product reviews and ratings",
    icon: "Star",
    category: "sales",
    requiredPermission: "reviews:read",
    default: {
      enabled: true,
      vendorEnabled: true,
    },
  },
};

/**
 * Get all module keys
 */
function getAllModuleKeys() {
  return Object.keys(VENDOR_MODULE_CONFIG);
}

/**
 * Get module config by key
 */
function getModuleConfig(key) {
  return VENDOR_MODULE_CONFIG[key];
}

/**
 * Validate module key
 */
function isValidModuleKey(key) {
  return key in VENDOR_MODULE_CONFIG;
}

/**
 * Get modules by category
 */
function getModulesByCategory(category) {
  return Object.values(VENDOR_MODULE_CONFIG).filter((m) => m.category === category);
}

function getDefaultVendorModules() {
  return Object.values(VENDOR_MODULE_CONFIG).map((module, index) => ({
    key: module.key,
    name: module.name,
    description: module.description,
    icon: module.icon,
    enabled: module.default.enabled,
    vendorEnabled: module.default.vendorEnabled,
    order: index + 1,
    requiredPermission: module.requiredPermission,
    metadata: { category: module.category, beta: Boolean(module.beta) },
  }));
}

module.exports = {
  VENDOR_MODULE_CONFIG,
  getAllModuleKeys,
  getDefaultVendorModules,
  getModuleConfig,
  isValidModuleKey,
  getModulesByCategory,
};
