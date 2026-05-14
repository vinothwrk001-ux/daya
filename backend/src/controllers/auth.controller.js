const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const authService = require("../services/auth.service");
const cartMergeService = require("../services/cartMerge.service");
const wishlistMergeService = require("../services/wishlistMerge.service");

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, result, "Registered successfully");
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, result, "Logged in successfully");
});

const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.body?.refreshToken;
  const result = await authService.refreshSession(refreshToken, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, result, "Session refreshed");
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.body?.refreshToken;
  // req.user might be null if authOptional didn't find a token
  // That's OK - logout service handles it gracefully
  const result = await authService.logout(refreshToken, req.user, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, result, "Logged out successfully");
});

const logoutAll = asyncHandler(async (req, res) => {
  const result = await authService.logoutAll(req.user.sub, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, result, "Logged out from all sessions");
});

const me = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const user = await authService.me(userId);
  return ok(res, user, "OK");
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
};
