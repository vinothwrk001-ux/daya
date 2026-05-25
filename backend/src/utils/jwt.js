const jwt = require("jsonwebtoken");

function getRequiredSecret(primaryName, fallbackName) {
  const secret = process.env[primaryName] || (fallbackName ? process.env[fallbackName] : undefined);
  if (!secret) {
    throw new Error(`Missing JWT secret: ${primaryName}`);
  }
  return secret;
}

function signAccessToken(user) {
  const payload = {
    sub: String(user._id),
    role: user.role,
    roles: Array.from(new Set([user.role, ...(user.roles || [])].filter(Boolean))),
    email: user.email,
  };

  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
  return jwt.sign(payload, getRequiredSecret("JWT_ACCESS_SECRET"), { expiresIn });
}

function signRefreshToken({ user, sessionId }) {
  const payload = {
    sub: String(user._id),
    sid: String(sessionId),
    role: user.role,
    roles: Array.from(new Set([user.role, ...(user.roles || [])].filter(Boolean))),
  };

  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "30d";
  return jwt.sign(payload, getRequiredSecret("JWT_REFRESH_SECRET"), { expiresIn });
}

function verifyAccessToken(token) {
  return jwt.verify(token, getRequiredSecret("JWT_ACCESS_SECRET"));
}

function verifyRefreshToken(token) {
  return jwt.verify(token, getRequiredSecret("JWT_REFRESH_SECRET"));
}

function signStaffAccessToken({ staff, sessionId, roleId, permissions }) {
  const payload = {
    sub: String(staff._id),
    sid: String(sessionId),
    type: "staff",
    role: "staff",
    roleId: roleId ? String(roleId) : null,
    permissions,
    email: staff.email,
  };

  const expiresIn = process.env.STAFF_JWT_ACCESS_EXPIRES_IN || "15m";
  return jwt.sign(payload, getRequiredSecret("STAFF_JWT_ACCESS_SECRET", "JWT_ACCESS_SECRET"), {
    expiresIn,
  });
}

function signStaffRefreshToken({ staff, sessionId, roleId, permissions }) {
  const payload = {
    sub: String(staff._id),
    sid: String(sessionId),
    type: "staff_refresh",
    role: "staff",
    roleId: roleId ? String(roleId) : null,
    permissions,
  };

  const expiresIn = process.env.STAFF_JWT_REFRESH_EXPIRES_IN || "30d";
  return jwt.sign(payload, getRequiredSecret("STAFF_JWT_REFRESH_SECRET", "JWT_REFRESH_SECRET"), {
    expiresIn,
  });
}

function verifyStaffAccessToken(token) {
  return jwt.verify(token, getRequiredSecret("STAFF_JWT_ACCESS_SECRET", "JWT_ACCESS_SECRET"));
}

function verifyStaffRefreshToken(token) {
  return jwt.verify(token, getRequiredSecret("STAFF_JWT_REFRESH_SECRET", "JWT_REFRESH_SECRET"));
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  signStaffAccessToken,
  signStaffRefreshToken,
  verifyStaffAccessToken,
  verifyStaffRefreshToken,
};
