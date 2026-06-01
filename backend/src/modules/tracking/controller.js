const { ok } = require("../../utils/apiResponse");
const { asyncHandler } = require("../../utils/asyncHandler");
const trackingService = require("./service");

const click = asyncHandler(async (req, res) => {
  const result = await trackingService.click({
    user: req.user,
    reelId: req.body.reelId,
    productId: req.body.productId,
    anonymousId: req.body.anonymousId,
    storefrontId: req.body.storefrontId,
    collectionId: req.body.collectionId,
    postId: req.body.postId,
    influencerId: req.body.influencerId,
    trackingCode: req.body.trackingCode,
    surface: req.body.surface,
    security: req.trackingSecurity,
  });
  return ok(res, result, "Tracking session created");
});

const event = asyncHandler(async (req, res) => {
  const result = await trackingService.event({
    user: req.user,
    trackingToken: req.body.trackingToken,
    anonymousId: req.body.anonymousId,
    eventType: req.body.eventType,
    metadata: req.body.metadata || {},
    security: req.trackingSecurity,
  });
  return ok(res, result, "Tracking event recorded");
});

module.exports = { click, event };
