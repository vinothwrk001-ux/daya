const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const cartService = require("../services/cart.service");
const guestCartService = require("../services/guestCart.service");
const cartMergeService = require("../services/cartMerge.service");

/**
 * AUTHENTICATED USER CART ENDPOINTS
 */

const getCart = asyncHandler(async (req, res) => {
  // Authenticated users only
  if (!req.user) {
    return ok(res, { items: [], totalAmount: 0 }, "Guest cart (empty)");
  }

  const cart = await cartService.getCart(req.user.sub);
  return ok(res, cart, "Cart loaded");
});

const add = asyncHandler(async (req, res) => {
  // Authenticated users only
  if (!req.user) {
    throw new AppError("Login required to add items to cart", 401, "AUTH_REQUIRED");
  }

  const cart = await cartService.addItem(req.user.sub, req.body || {});
  return ok(res, cart, "Added to cart");
});

const update = asyncHandler(async (req, res) => {
  // Authenticated users only
  if (!req.user) {
    throw new AppError("Login required to update cart", 401, "AUTH_REQUIRED");
  }

  const cart = await cartService.updateItem(req.user.sub, req.body || {});
  return ok(res, cart, "Cart updated");
});

const remove = asyncHandler(async (req, res) => {
  // Authenticated users only
  if (!req.user) {
    throw new AppError("Login required to modify cart", 401, "AUTH_REQUIRED");
  }

  const productId = req.body?.productId || req.query?.productId;
  const variantId = req.body?.variantId || req.query?.variantId || "";
  const cart = await cartService.removeItem(req.user.sub, { productId, variantId });
  return ok(res, cart, "Removed from cart");
});

const clear = asyncHandler(async (req, res) => {
  // Authenticated users only
  if (!req.user) {
    throw new AppError("Login required to clear cart", 401, "AUTH_REQUIRED");
  }

  const cart = await cartService.clearCart(req.user.sub);
  return ok(res, cart, "Cart cleared");
});

/**
 * GUEST CART VALIDATION ENDPOINTS
 * Used by frontend to validate guest cart items before checkout
 */

const validateItem = asyncHandler(async (req, res) => {
  const { productId, quantity = 1, variantId = "" } = req.body || {};

  const enrichedItem = await guestCartService.validateAndEnrichItem(productId, quantity, variantId);
  return ok(res, enrichedItem, "Item validated");
});

const validateCart = asyncHandler(async (req, res) => {
  const { items = [] } = req.body || {};

  const validation = await guestCartService.validateCartItems(items);
  return ok(res, validation, "Cart validated");
});

const getCartSummary = asyncHandler(async (req, res) => {
  const { items = [] } = req.body || {};

  const summary = await guestCartService.getCartSummary(items);
  return ok(res, summary, "Cart summary retrieved");
});

/**
 * CART MERGE ENDPOINT
 * Called after login to merge guest cart into user cart
 */

const mergeGuestCart = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
  }

  const { guestCartItems = [] } = req.body || {};

  if (!cartMergeService.hasGuestCartItems(guestCartItems)) {
    return ok(res, { merged: 0, userCart: await cartService.getCart(req.user.sub) }, "No items to merge");
  }

  const mergeResult = await cartMergeService.mergeGuestCartIntoUserCart(req.user.sub, guestCartItems);
  return ok(res, mergeResult, "Guest cart merged successfully");
});

const getMergeSummary = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
  }

  const { guestCartItems = [] } = req.body || {};

  const summary = await cartMergeService.getMergeSummary(req.user.sub, guestCartItems);
  return ok(res, summary, "Merge summary retrieved");
});

module.exports = {
  // Authenticated endpoints
  getCart,
  add,
  update,
  remove,
  clear,
  // Guest validation endpoints
  validateItem,
  validateCart,
  getCartSummary,
  // Merge endpoints
  mergeGuestCart,
  getMergeSummary,
};

