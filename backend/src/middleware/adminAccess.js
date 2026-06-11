const { AppError } = require("../utils/AppError");
const { ADMIN_ROLES, hasPermission, normalizeRole } = require("../utils/adminPermissions");
const { verifyAccessToken, verifyStaffAccessToken } = require("../utils/jwt");
const { Staff } = require("../modules/staff/models/Staff");
const { StaffSession } = require("../modules/staff/models/StaffSession");
const { hasStaffPermission } = require("../modules/staff/permissions");
const { logger } = require("../utils/logger");

function getTokenFromReq(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return { legacyBearer: true };
  if (req.cookies?.accessToken) return req.cookies.accessToken;
  if (req.cookies?.staffAccessToken) return req.cookies.staffAccessToken;
  return null;
}

async function adminWorkspaceAuthRequired(req, res, next) {
  const token = getTokenFromReq(req);
  if (token?.legacyBearer) {
    return next(new AppError("Legacy bearer authentication has been removed", 410, "LEGACY_AUTH_REMOVED"));
  }
  if (!token) {
    logger.warn("Auth request without token", { path: req.path, method: req.method });
    return next(new AppError("Unauthorized", 401, "UNAUTHORIZED"));
  }

  try {
    const payload = verifyAccessToken(token);
    if (ADMIN_ROLES.includes(normalizeRole(payload.role))) {
      req.user = payload;
      req.authContext = { type: "legacy_admin" };
      logger.debug("Legacy admin authenticated", { role: payload.role, path: req.path });
      return next();
    }
  } catch (error) {
    logger.debug("Legacy admin token verification failed", { error: error.message });
    // Staff tokens are validated below.
  }

  try {
    const payload = verifyStaffAccessToken(token);
    const session = await StaffSession.findById(payload.sid);
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      logger.warn("Staff session expired or revoked", { staffId: payload.sub, path: req.path });
      return next(new AppError("Session expired", 401, "UNAUTHORIZED"));
    }

    const staff = await Staff.findById(payload.sub).populate("roleId");
    if (!staff || staff.status !== "active") {
      logger.warn("Staff account unavailable", { staffId: payload.sub, status: staff?.status });
      return next(new AppError("Staff account unavailable", 401, "UNAUTHORIZED"));
    }

    const issuedAt = payload.iat ? new Date(payload.iat * 1000) : null;
    if (
      issuedAt &&
      ((staff.forceLogoutAt && issuedAt < staff.forceLogoutAt) ||
        (staff.passwordChangedAt && issuedAt < staff.passwordChangedAt))
    ) {
      logger.warn("Staff session invalidated due to password/logout", { staffId: payload.sub });
      return next(new AppError("Session expired", 401, "UNAUTHORIZED"));
    }

    req.staff = {
      _id: staff._id,
      name: staff.name,
      email: staff.email,
      roleId: staff.roleId?._id,
      roleName: staff.roleId?.name,
      permissions: staff.roleId?.permissions || {},
      status: staff.status,
      authType: "staff",
    };
    req.user = {
      sub: String(staff._id),
      role: "staff",
      roleId: req.staff.roleId,
      permissions: req.staff.permissions,
      authType: "staff",
    };
    req.authContext = { type: "staff" };
    logger.debug("Staff authenticated", { staffId: payload.sub, path: req.path });
    return next();
  } catch (error) {
    logger.warn("Auth token verification failed", { error: error.message, path: req.path });
    return next(new AppError("Invalid or expired token", 401, "UNAUTHORIZED"));
  }
}

function requireWorkspacePermission(permission, options = {}) {
  const legacyPermission = options.legacyPermission || permission;

  return async (req, res, next) => {
    try {
      if (!req.user || !req.authContext) {
        return next(new AppError("Unauthorized", 401, "UNAUTHORIZED"));
      }

      if (req.authContext.type === "legacy_admin") {
        if (!hasPermission(req.user.role, legacyPermission)) {
          return next(new AppError("Forbidden", 403, "FORBIDDEN"));
        }
        return next();
      }

      if (!hasStaffPermission(req.user.permissions, permission)) {
        return next(new AppError("Access denied", 403, "FORBIDDEN"));
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function requireLegacyAdminPermission(permission) {
  return (req, res, next) => {
    if (!req.user || req.authContext?.type !== "legacy_admin") {
      return next(new AppError("Forbidden", 403, "FORBIDDEN"));
    }

    if (!hasPermission(req.user.role, permission)) {
      return next(new AppError("Forbidden", 403, "FORBIDDEN"));
    }

    return next();
  };
}

module.exports = {
  adminWorkspaceAuthRequired,
  requireWorkspacePermission,
  requireLegacyAdminPermission,
};
