const express = require("express");
const Joi = require("joi");
const { authOptional, authRequired } = require("../../middleware/auth");
const { hasPermission } = require("../../utils/adminPermissions");
const { validate } = require("../../middleware/validate");
const controller = require("./controller");

const router = express.Router();

function requireAnyPermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) {
      const { AppError } = require("../../utils/AppError");
      return next(new AppError("Unauthorized", 401, "UNAUTHORIZED"));
    }
    if (!permissions.some((permission) => hasPermission(req.user.role, permission))) {
      const { AppError } = require("../../utils/AppError");
      return next(new AppError("Forbidden", 403, "FORBIDDEN"));
    }
    return next();
  };
}

router.get("/product/:productId", authOptional, controller.getProductRecommendations);
router.get("/fbt/:productId", authOptional, controller.frequentlyBought);
router.get("/frequently-bought", authOptional, controller.frequentlyBought);
router.get("/featured", authOptional, controller.featured);
router.get("/trending", authOptional, controller.trending);
router.get("/related", authOptional, controller.related);
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

router.get("/admin/settings", authRequired, requireAnyPermission("recommendation.view", "analytics:read"), controller.getSettings);
router.put("/admin/settings", authRequired, requireAnyPermission("recommendation.manage", "settings:update"), controller.updateSettings);
router.get("/admin/preview/:productId", authRequired, requireAnyPermission("recommendation.view", "analytics:read"), controller.preview);
router.post("/admin/rebuild", authRequired, requireAnyPermission("recommendation.rebuild", "settings:update"), controller.rebuild);
router.post("/admin/cache/clear", authRequired, requireAnyPermission("recommendation.cache.clear", "settings:update"), controller.clearCache);
router.get("/admin/jobs/:id", authRequired, requireAnyPermission("recommendation.view", "analytics:read"), controller.getJob);
router.get("/admin/analytics", authRequired, requireAnyPermission("recommendation.view", "analytics:read"), controller.analytics);

router.post("/rebuild", authRequired, requireAnyPermission("recommendation.rebuild", "settings:update"), controller.rebuild);
router.post("/cache/clear", authRequired, requireAnyPermission("recommendation.cache.clear", "settings:update"), controller.clearCache);
router.get("/jobs/:id", authRequired, requireAnyPermission("recommendation.view", "analytics:read"), controller.getJob);

module.exports = router;
