const { AppError } = require("../../utils/AppError");
const { hasPermission } = require("../../utils/adminPermissions");
const { hasStaffPermission } = require("../../modules/staff/permissions");

/**
 * Universal authorization middleware.
 * Use after `authenticate()`.
 */
const authorize = {
  /**
   * Require exact role(s). Generally only for 'user' or legacy 'admin'.
   */
  roles: (...allowedRoles) => (req, res, next) => {
    if (!req.user) return next(new AppError("Unauthorized", 401, "UNAUTHORIZED"));
    const userRoles = Array.from(new Set([req.user.role, ...(req.user.roles || [])].filter(Boolean)));
    if (!userRoles.some((role) => allowedRoles.includes(role))) {
      return next(new AppError("Forbidden", 403, "FORBIDDEN"));
    }
    next();
  },

  /**
   * Require specific workspace permission. 
   * Abstracts differences between legacy admin permissions and staff permissions.
   */
  workspacePermission: (permission, options = {}) => (req, res, next) => {
    if (!req.user || !req.authContext) {
      return next(new AppError("Unauthorized", 401, "UNAUTHORIZED"));
    }

    if (req.authContext.type === "legacy_admin") {
      const legacyPermission = options.legacyPermission || permission;
      if (!hasPermission(req.user.role, legacyPermission)) {
        return next(new AppError("Forbidden", 403, "FORBIDDEN"));
      }
      return next();
    }

    if (req.authContext.type === "staff") {
      if (!hasStaffPermission(req.user.permissions, permission)) {
        return next(new AppError("Access denied", 403, "FORBIDDEN"));
      }
      return next();
    }

    return next(new AppError("Forbidden: Invalid auth context", 403, "FORBIDDEN"));
  },

  /**
   * Require legacy admin permission strictly (bypasses staff check)
   */
  legacyAdminPermission: (permission) => (req, res, next) => {
    if (!req.user || req.authContext?.type !== "legacy_admin") {
      return next(new AppError("Forbidden", 403, "FORBIDDEN"));
    }
    if (!hasPermission(req.user.role, permission)) {
      return next(new AppError("Forbidden", 403, "FORBIDDEN"));
    }
    return next();
  }
};

module.exports = { authorize };
