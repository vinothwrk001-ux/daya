const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const authService = require("../services/auth.service");
const cartMergeService = require("../services/cartMerge.service");
const wishlistMergeService = require("../services/wishlistMerge.service");
const { issueCsrfToken } = require("../middleware/csrf");

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
  res.cookie("accessToken", result.accessToken, cookieOptions(accessMaxAgeMs));
  res.cookie("refreshToken", result.refreshToken, cookieOptions(refreshMaxAgeMs));
}

function publicAuthPayload(result) {
  return { user: result?.user || null };
}

function clearSessionCookies(res) {
  res.clearCookie("accessToken", cookieOptions(0));
  res.clearCookie("refreshToken", cookieOptions(0));
}

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  setSessionCookies(res, result);
  issueCsrfToken(req, res);
  return ok(res, publicAuthPayload(result), "Registered successfully");
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  setSessionCookies(res, result);
  issueCsrfToken(req, res);
  return ok(res, publicAuthPayload(result), "Logged in successfully");
});

const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  const result = await authService.refreshSession(refreshToken, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  setSessionCookies(res, result);
  issueCsrfToken(req, res);
  return ok(res, publicAuthPayload(result), "Session refreshed");
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  // req.user might be null if authOptional didn't find a token
  // That's OK - logout service handles it gracefully
  const result = await authService.logout(refreshToken, req.user, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  clearSessionCookies(res);
  return ok(res, result, "Logged out successfully");
});

const logoutAll = asyncHandler(async (req, res) => {
  const result = await authService.logoutAll(req.user.sub, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  clearSessionCookies(res);
  return ok(res, result, "Logged out from all sessions");
});

const me = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const user = await authService.me(userId);
  return ok(res, user, "OK");
});

const csrf = asyncHandler(async (req, res) => {
  const csrfToken = issueCsrfToken(req, res);
  return ok(res, { csrfToken }, "CSRF token issued");
});

const updateThemePreference = asyncHandler(async (req, res) => {
  const user = await authService.updateThemePreference(req.user.sub, req.body?.theme, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, user, "Theme updated");
});

/**
 * POST-LOGIN MERGE ENDPOINT
 * Called by frontend after successful login to merge guest data into user account
 * Merges both cart and wishlist in one call
 */
const mergeGuestData = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
  }

  const { guestCartItems = [], guestWishlistItems = [] } = req.body || {};

  const result = {
    cartMerge: null,
    wishlistMerge: null,
  };

  // Merge cart if guest items provided
  if (cartMergeService.hasGuestCartItems(guestCartItems)) {
    result.cartMerge = await cartMergeService.mergeGuestCartIntoUserCart(req.user.sub, guestCartItems);
  }

  // Merge wishlist if guest items provided
  if (wishlistMergeService.hasGuestWishlistItems(guestWishlistItems)) {
    result.wishlistMerge = await wishlistMergeService.mergeGuestWishlistIntoUserWishlist(req.user.sub, guestWishlistItems);
  }

  return ok(res, result, "Guest data merged successfully");
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  me,
  updateThemePreference,
  mergeGuestData,
  csrf,
};
