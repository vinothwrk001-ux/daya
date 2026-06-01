const { AppError } = require("../utils/AppError");
const { verifyAccessToken } = require("../utils/jwt");
const { hasPermission } = require("../utils/adminPermissions");

function getTokenFromReq(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return { legacyBearer: true };
  if (req.cookies && req.cookies.accessToken) return req.cookies.accessToken;
  return null;
}

function authRequired(req, res, next) {
  const token = getTokenFromReq(req);
  if (token?.legacyBearer) {
    return next(new AppError("Legacy bearer authentication has been removed", 410, "LEGACY_AUTH_REMOVED"));
  }
  if (!token) return next(new AppError("Unauthorized", 401, "UNAUTHORIZED"));

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (e) {
    return next(new AppError("Invalid or expired token", 401, "UNAUTHORIZED"));
  }
}

// Optional auth - doesn't throw error if token is missing
function authOptional(req, res, next) {
  const token = getTokenFromReq(req);
  if (token?.legacyBearer) {
    return next(new AppError("Legacy bearer authentication has been removed", 410, "LEGACY_AUTH_REMOVED"));
  }
  if (!token) {
    // No token, but continue anyway
    req.user = null;
    return next();
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (e) {
    // Invalid token, but continue anyway
    req.user = null;
    next();
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError("Unauthorized", 401, "UNAUTHORIZED"));
    const userRoles = Array.from(new Set([req.user.role, ...(req.user.roles || [])].filter(Boolean)));
    if (!userRoles.some((role) => roles.includes(role))) {
      return next(new AppError("Forbidden", 403, "FORBIDDEN"));
    }
    next();
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError("Unauthorized", 401, "UNAUTHORIZED"));
    if (!hasPermission(req.user.role, permission)) {
      return next(new AppError("Forbidden", 403, "FORBIDDEN"));
    }
    next();
  };
}

module.exports = { authRequired, authOptional, requireRole, requirePermission };
