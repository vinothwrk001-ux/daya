const STAFF_PERMISSION_CATALOG = Object.freeze({
  users: ["read", "create", "delete"],
  orders: ["read", "update", "cancel"],
  products: ["read", "create", "update", "delete"],
  payments: ["read", "refund"],
  payouts: ["read", "process"],
  reviews: ["read", "delete"],
  analytics: ["read"],
  influencerCommerce: [
    "read",
    "invite",
    "manage",
    "approve",
    "export",
    "dashboard",
    "influencers",
    "vendors",
    "campaigns",
    "applications",
    "content",
    "commissions",
    "settlements",
    "payouts",
    "withdrawals",
    "analytics",
    "fraud",
    "settings",
  ],
  settings: ["update"],
  branding: ["view", "create", "update", "delete"],
  roles: ["read", "create", "update", "delete"],
  staff: ["read", "create", "update", "delete"],
});

function createEmptyPermissions() {
  return Object.fromEntries(
    Object.entries(STAFF_PERMISSION_CATALOG).map(([moduleName, actions]) => [
      moduleName,
      Object.fromEntries(actions.map((action) => [action, false])),
    ])
  );
}

function normalizePermissions(input = {}) {
  const normalized = createEmptyPermissions();

  for (const [moduleName, actions] of Object.entries(STAFF_PERMISSION_CATALOG)) {
    const source = input?.[moduleName] || {};

    for (const action of actions) {
      normalized[moduleName][action] = Boolean(source?.[action]);
    }

    if (actions.includes("read")) {
      const hasMutatingPermission = actions.some(
        (action) => action !== "read" && normalized[moduleName][action]
      );
      if (hasMutatingPermission) {
        normalized[moduleName].read = true;
      }
    }
  }

  return normalized;
}

function permissionExists(permission) {
  const [moduleName, action] = String(permission || "").split(".");
  return Boolean(STAFF_PERMISSION_CATALOG[moduleName]?.includes(action));
}

function hasStaffPermission(permissions, permission) {
  if (!permissionExists(permission)) return false;
  const [moduleName, action] = permission.split(".");
  return Boolean(permissions?.[moduleName]?.[action]);
}

function listPermissionKeys() {
  return Object.entries(STAFF_PERMISSION_CATALOG).flatMap(([moduleName, actions]) =>
    actions.map((action) => `${moduleName}.${action}`)
  );
}

module.exports = {
  STAFF_PERMISSION_CATALOG,
  createEmptyPermissions,
  normalizePermissions,
  permissionExists,
  hasStaffPermission,
  listPermissionKeys,
};
