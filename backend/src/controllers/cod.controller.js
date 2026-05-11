const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const codService = require("../services/cod.service");
const checkoutService = require("../services/checkout.service");
const { UserAddress } = require("../models/UserAddress");

const checkAvailability = asyncHandler(async (req, res) => {
  let shippingAddress = req.body?.shippingAddress || null;
  if (!shippingAddress && req.body?.addressId) {
    const address = await UserAddress.findOne({ _id: req.body.addressId, userId: req.user.sub }).lean();
    shippingAddress = address
      ? {
          fullName: address.fullName,
          phone: address.phone,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
        }
      : null;
  }
  const prepared = await checkoutService.prepare(req.user.sub, {
    shippingAddress,
    paymentMethod: "COD",
  });
  const result = prepared?.codAvailability || { codAvailable: false, reasons: ["ADDRESS_REQUIRED"] };
  return ok(res, result, "COD availability checked");
});

const collect = asyncHandler(async (req, res) => {
  const result = await codService.collectPayment({
    orderId: req.body?.orderId || null,
    orderGroupId: req.body?.orderGroupId || null,
    collectedAmount: req.body?.amount,
    reference: req.body?.reference || "",
    actor: req.user?.role || "ADMIN",
    actorId: req.user?.sub || null,
  });
  return ok(res, result, "COD payment collected");
});

const getSettings = asyncHandler(async (req, res) => {
  const config = await codService.getConfig();
  return ok(res, config, "COD settings retrieved");
});

const updateSettings = asyncHandler(async (req, res) => {
  const config = await codService.updateConfig(req.body || {}, req.user?.sub || null);
  return ok(res, config, "COD settings updated");
});

const getAnalytics = asyncHandler(async (req, res) => {
  const analytics = await codService.getAnalytics({ days: req.query?.days || 30 });
  return ok(res, analytics, "COD analytics retrieved");
});

module.exports = {
  checkAvailability,
  collect,
  getSettings,
  updateSettings,
  getAnalytics,
};
