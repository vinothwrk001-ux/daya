const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const wishlistService = require("../services/wishlist.service");
const guestWishlistService = require("../services/guestWishlist.service");
const wishlistMergeService = require("../services/wishlistMerge.service");

/**
 * AUTHENTICATED USER WISHLIST ENDPOINTS
 */

const list = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AppError("Login required to view wishlist", 401, "AUTH_REQUIRED");
  }

  const data = await wishlistService.listWishlist(req.user.sub);
  return ok(res, data, "Wishlist retrieved");
});

const add = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AppError("Login required to add to wishlist", 401, "AUTH_REQUIRED");
  }

  const { variantId, selectedAttributes } = req.body || {};
  const data = await wishlistService.addToWishlist(req.user.sub, req.params.productId, variantId, selectedAttributes);
  return ok(res, data, "Added to wishlist");
});

const remove = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AppError("Login required to remove from wishlist", 401, "AUTH_REQUIRED");
  }

  const data = await wishlistService.removeFromWishlist(req.user.sub, req.params.productId);
  return ok(res, data, "Removed from wishlist");
});

const status = asyncHandler(async (req, res) => {
  if (!req.user) {
    return ok(res, { inWishlist: false }, "Not in wishlist");
  }

  const data = await wishlistService.getWishlistStatus(req.user.sub, req.params.productId);
  return ok(res, data, "Wishlist status retrieved");
});

/**
 * GUEST WISHLIST VALIDATION ENDPOINTS
 * Allow guests to check product availability for wishlist
 */

const validateProduct = asyncHandler(async (req, res) => {
  const productId = req.params.productId;
  const { variantId = "" } = req.body || {};

  const validation = await guestWishlistService.validateProduct(productId, variantId);
  return ok(res, validation, "Product validated");
});

const getProductStatus = asyncHandler(async (req, res) => {
  const productId = req.params.productId;

  const status = await guestWishlistService.getProductStatus(productId);
  return ok(res, status, "Product status retrieved");
});

const validateWishlistItems = asyncHandler(async (req, res) => {
  const { items = [] } = req.body || {};

  const validation = await guestWishlistService.validateWishlistItems(items);
  return ok(res, validation, "Wishlist items validated");
});

/**
 * WISHLIST MERGE ENDPOINT
 * Called after login to merge guest wishlist into user wishlist
 */

const mergeGuestWishlist = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
  }

  const { guestWishlistItems = [] } = req.body || {};

  const mergeResult = await wishlistMergeService.mergeGuestWishlistIntoUserWishlist(req.user.sub, guestWishlistItems);
  return ok(res, mergeResult, "Guest wishlist merged successfully");
});

module.exports = {
  // Authenticated endpoints
  list,
  add,
  remove,
  status,
  // Guest validation endpoints
  validateProduct,
  getProductStatus,
  validateWishlistItems,
  // Merge endpoints
  mergeGuestWishlist,
};
