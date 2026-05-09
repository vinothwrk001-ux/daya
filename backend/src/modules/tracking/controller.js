const { ok } = require("../../utils/apiResponse");
const { asyncHandler } = require("../../utils/asyncHandler");
const trackingService = require("./service");

const click = asyncHandler(async (req, res) => {
  const result = await trackingService.click({
    user: req.user,
    reelId: req.body.reelId,
    productId: req.body.productId,
    anonymousId: req.body.anonymousId,
  });
  return ok(res, result, "Tracking session created");
});

module.exports = { click };
