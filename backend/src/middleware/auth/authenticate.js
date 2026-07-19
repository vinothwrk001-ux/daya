const { AppError } = require("../../utils/AppError");
const { verifyAccessToken, verifyStaffAccessToken } = require("../../utils/jwt");
const { Staff } = require("../../modules/staff/models/Staff");
const { StaffSession } = require("../../modules/staff/models/StaffSession");
const { logger } = require("../../utils/logger");
const { ADMIN_ROLES, normalizeRole } = require("../../utils/adminPermissions");

/**
 * Universal authentication middleware that parses legacy user/admin tokens
 * and newer staff tokens, attaching the standardized user context to `req.user`.
 * 
 * Options:
 * - optional: boolean (if true, continues without throwing error on missing/invalid token)
 * - types: array ["user", "staff", "legacy_admin"] (if provided, filters allowed token types)
 */
const authenticate = (options = {}) => async (req, res, next) => {
  const { getTokenFromReq } = require("./tokenExtractor");
  const token = getTokenFromReq(req);
  
  if (token?.legacyBearer) {
    return next(new AppError("Legacy bearer authentication has been removed", 410, "LEGACY_AUTH_REMOVED"));
  }
  
  if (!token) {
    if (options.optional) {
      req.user = null;
      return next();
    }
    return next(new AppError("Unauthorized", 401, "UNAUTHORIZED"));
  }

  // 1. Attempt Legacy/User Token Verification
  try {
    const payload = verifyAccessToken(token);
    const isLegacyAdmin = ADMIN_ROLES.includes(normalizeRole(payload.role));
    
    const authType = isLegacyAdmin ? "legacy_admin" : "user";
    
    if (options.types && !options.types.includes(authType)) {
      // If we only wanted staff, we can skip and try staff verification below
      if (options.types.includes("staff")) {
        throw new Error("Proceed to staff verification");
      }
      return next(new AppError("Unauthorized auth type", 401, "UNAUTHORIZED"));
    }

    req.user = payload;
    req.user.authType = authType;
    req.authContext = { type: authType };
    
    // Legacy notification compatibility
    req.notificationActor = { userId: payload.id || payload.sub, role: payload.role, authType };

    return next();
  } catch (error) {
    // If it's a generic user token requirement that failed, and staff isn't allowed, exit.
    if (!options.types || (!options.types.includes("staff") && !options.types.includes("any"))) {
      if (options.optional) {
        req.user = null;
        return next();
      }
      return next(new AppError("Invalid or expired token", 401, "UNAUTHORIZED"));
    }
  }

  // 2. Attempt Staff Token Verification
  try {
    const payload = verifyStaffAccessToken(token);
    const session = await StaffSession.findById(payload.sid);
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return next(new AppError("Session expired", 401, "UNAUTHORIZED"));
    }

    const staff = await Staff.findById(payload.sub).populate("roleId");
    if (!staff || staff.status !== "active") {
      return next(new AppError("Staff account unavailable", 401, "UNAUTHORIZED"));
    }

    const issuedAt = payload.iat ? new Date(payload.iat * 1000) : null;
    if (
      issuedAt &&
      ((staff.forceLogoutAt && issuedAt < staff.forceLogoutAt) ||
        (staff.passwordChangedAt && issuedAt < staff.passwordChangedAt))
    ) {
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
    req.notificationActor = { userId: req.user.sub, role: req.user.role, authType: "staff" };

    return next();
  } catch (error) {
    if (options.optional) {
      req.user = null;
      return next();
    }
    return next(new AppError("Invalid or expired token", 401, "UNAUTHORIZED"));
  }
};

module.exports = { authenticate };
