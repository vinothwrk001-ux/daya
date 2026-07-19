const { authenticate } = require("./auth/authenticate");
const { authorize } = require("./auth/authorize");

// Wrappers for backward compatibility
const adminWorkspaceAuthRequired = authenticate({ types: ["legacy_admin", "staff"] });
const requireWorkspacePermission = authorize.workspacePermission;
const requireLegacyAdminPermission = authorize.legacyAdminPermission;

module.exports = {
  adminWorkspaceAuthRequired,
  requireWorkspacePermission,
  requireLegacyAdminPermission,
};
