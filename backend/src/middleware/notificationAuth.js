const { AppError } = require("../utils/AppError");
const { verifyAccessToken, verifyStaffAccessToken } = require("../utils/jwt");
const { ADMIN_ROLES, normalizeRole } = require("../utils/adminPermissions");
const { Staff } = require("../modules/staff/models/Staff");
const { StaffSession } = require("../modules/staff/models/StaffSession");

function getTokenFromReq(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return { legacyBearer: true };
  if (req.cookies?.accessToken) return req.cookies.accessToken;
  if (req.cookies?.staffAccessToken) return req.cookies.staffAccessToken;
  return null;
}

async function notificationAuthRequired(req, res, next) {
  const token = getTokenFromReq(req);
  if (token?.legacyBearer) {
    return next(new AppError("Legacy bearer authentication has been removed", 410, "LEGACY_AUTH_REMOVED"));
  }
  if (!token) {
    return next(new AppError("Unauthorized", 401, "UNAUTHORIZED"));
  }

  try {
    const payload = verifyAccessToken(token);
    const normalizedRole = normalizeRole(payload.role);
    let notificationRole = null;

    if (ADMIN_ROLES.includes(normalizedRole)) {
      notificationRole = "ADMIN";
    }

    if (!notificationRole) {
      return next(new AppError("Forbidden", 403, "FORBIDDEN"));
    }

    req.user = payload;
    req.notificationActor = {
      userId: payload.sub,
      role: notificationRole,
      authType: "access_token",
    };
    return next();
  } catch (error) {
    // Fall through to staff token verification.
  }

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

    req.staff = {
      _id: staff._id,
      permissions: staff.roleId?.permissions || {},
    };
    req.user = {
      sub: String(staff._id),
      role: "staff",
      permissions: req.staff.permissions,
      authType: "staff",
    };
    req.notificationActor = {
      userId: String(staff._id),
      role: "STAFF",
      authType: "staff",
    };
    return next();
  } catch (error) {
    return next(new AppError("Invalid or expired token", 401, "UNAUTHORIZED"));
  }
}

module.exports = {
  notificationAuthRequired,
};
