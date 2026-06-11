const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const checkoutService = require("../services/checkout.service");

/**
 * AUTHENTICATED USER CHECKOUT
 * Uses user's backend cart
 */

const prepare = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AppError("Login required for checkout", 401, "AUTH_REQUIRED");
  }

  const result = await checkoutService.prepare(req.user.sub, req.body || {});
  return ok(res, result, "Checkout prepared");
});

const createOrder = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AppError("Login required to create order", 401, "AUTH_REQUIRED");
  }

  const { shippingAddress, paymentMethod } = req.body;
  const result = await checkoutService.createOrder(req.user.sub, {
    shippingAddress,
    paymentMethod,
  });
  return ok(res, result, "Order created");
});

/**
 * GUEST CHECKOUT
 * Uses guest cart items provided in request body
 */

const prepareGuestCheckout = asyncHandler(async (req, res) => {
  const { guestCartItems = [], shippingAddress, paymentMethod, currency } = req.body || {};
  const result = await checkoutService.prepareGuestCheckout(guestCartItems, {
    shippingAddress,
    paymentMethod,
    currency,
  });
  return ok(res, result, "Guest checkout prepared");
});

module.exports = {
  // Authenticated endpoints
  prepare,
  createOrder,
  // Guest endpoints
  prepareGuestCheckout,
};

