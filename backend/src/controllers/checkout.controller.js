const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const checkoutService = require("../services/checkout.service");

const prepare = asyncHandler(async (req, res) => {
  const result = await checkoutService.prepare(req.user.sub, req.body || {});
  return ok(res, result, "Checkout prepared");
});

const createOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod, trackingToken } = req.body;
  const result = await checkoutService.createOrder(req.user.sub, { shippingAddress, paymentMethod, trackingToken });
  return ok(res, result, "Order created");
});

module.exports = { prepare, createOrder };

