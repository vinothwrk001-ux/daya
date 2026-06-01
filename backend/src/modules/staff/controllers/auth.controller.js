const { ok } = require("../../../utils/apiResponse");
const { asyncHandler } = require("../../../utils/asyncHandler");
const staffAuthService = require("../services/staff-auth.service");

function cookieOptions(maxAgeMs) {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: process.env.AUTH_COOKIE_SAMESITE || (secure ? "none" : "lax"),
    path: "/",
    maxAge: maxAgeMs,
  };
}

function setSessionCookies(res, result) {
  if (!result?.accessToken || !result?.refreshToken) return;
  const accessMaxAgeMs = Number(process.env.JWT_ACCESS_COOKIE_MAX_AGE_MS || 15 * 60 * 1000);
  const refreshMaxAgeMs = Number(process.env.JWT_REFRESH_TTL_DAYS || 30) * 24 * 60 * 60 * 1000;
  res.cookie("staffAccessToken", result.accessToken, cookieOptions(accessMaxAgeMs));
  res.cookie("staffRefreshToken", result.refreshToken, cookieOptions(refreshMaxAgeMs));
}

function clearSessionCookies(res) {
  res.clearCookie("staffAccessToken", cookieOptions(0));
  res.clearCookie("staffRefreshToken", cookieOptions(0));
}

const login = asyncHandler(async (req, res) => {
  const result = await staffAuthService.login(req.body, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  setSessionCookies(res, result);
  return ok(res, result, "Staff logged in successfully");
});

const refresh = asyncHandler(async (req, res) => {
  const result = await staffAuthService.refreshSession(req.body.refreshToken || req.cookies?.staffRefreshToken, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  setSessionCookies(res, result);
  return ok(res, result, "Staff session refreshed");
});

const logout = asyncHandler(async (req, res) => {
  const result = await staffAuthService.logout(req.body?.refreshToken || req.cookies?.staffRefreshToken);
  clearSessionCookies(res);
  return ok(res, result, "Staff logged out successfully");
});

const me = asyncHandler(async (req, res) => {
  const result = await staffAuthService.me(req.staff._id);
  return ok(res, result, "OK");
});

const requestPasswordReset = asyncHandler(async (req, res) => {
  const result = await staffAuthService.requestPasswordReset(req.body.email);
  return ok(res, result, "Password reset requested");
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await staffAuthService.resetPassword(req.body.token, req.body.password);
  return ok(res, result, "Password updated successfully");
});

module.exports = {
  login,
  refresh,
  logout,
  me,
  requestPasswordReset,
  resetPassword,
};
