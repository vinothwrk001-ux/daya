const express = require("express");
const Joi = require("joi");
const { authOptional, authRequired, requirePermission } = require("../../middleware/auth");
const { validate } = require("../../middleware/validate");
const controller = require("./controller");

const router = express.Router();

router.get("/product/:productId", authOptional, controller.getProductRecommendations);
router.get("/cart", authOptional, controller.getCartRecommendations);
router.get("/checkout", authOptional, controller.getCheckoutRecommendations);
router.get("/home", authOptional, controller.getHomeRecommendations);
router.get("/recently-viewed", authRequired, controller.getRecentlyViewed);
router.post(
  "/recently-viewed",
  authRequired,
  validate(Joi.object({ productId: Joi.string().required() })),
  controller.trackRecentlyViewed
);
router.post(
  "/events",
  authOptional,
  validate(
    Joi.object({
      recommendationType: Joi.string().required(),
      surface: Joi.string().required(),
      eventType: Joi.string().valid("VIEW", "CLICK", "CONVERSION").required(),
      productId: Joi.string().allow("", null),
      recommendedProductId: Joi.string().allow("", null),
      orderId: Joi.string().allow("", null),
      metadata: Joi.object().default({}),
    })
  ),
  controller.trackEvent
);

router.get("/admin/settings", authRequired, requirePermission("analytics:read"), controller.getSettings);
router.put("/admin/settings", authRequired, requirePermission("settings:update"), controller.updateSettings);
router.get("/admin/preview/:productId", authRequired, requirePermission("analytics:read"), controller.preview);
router.post("/admin/rebuild", authRequired, requirePermission("settings:update"), controller.rebuild);
router.post("/admin/cache/clear", authRequired, requirePermission("settings:update"), controller.clearCache);
router.get("/admin/analytics", authRequired, requirePermission("analytics:read"), controller.analytics);

module.exports = router;
