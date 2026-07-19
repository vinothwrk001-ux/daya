const { authenticate } = require("./auth/authenticate");
const { authorize } = require("./auth/authorize");

// Wrappers for backward compatibility
const authRequired = authenticate({ types: ["user", "legacy_admin"] });
const authOptional = authenticate({ optional: true });
const requireRole = authorize.roles;

// Original requirePermission checked legacy admin roles
const requirePermission = authorize.legacyAdminPermission;

module.exports = { authRequired, authOptional, requireRole, requirePermission };
