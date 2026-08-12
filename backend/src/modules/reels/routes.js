const express = require("express");
const Joi = require("joi");
const { authOptional, authRequired } = require("../../middleware/auth");
const { adminWorkspaceAuthRequired, requireWorkspacePermission } = require("../../middleware/adminAccess");
const { upload } = require("../../middleware/upload");
const { validate } = require("../../middleware/validate");
const controller = require("./controller");

const router = express.Router();

router.get(
  "/admin/list",
  adminWorkspaceAuthRequired,
  requireWorkspacePermission("products.read"),
  controller.listAdmin
);

router.get(
  "/admin/analytics",
  adminWorkspaceAuthRequired,
  requireWorkspacePermission("analytics.read"),
  controller.analytics
);

router.get(
  "/admin/attribution",
  adminWorkspaceAuthRequired,
  requireWorkspacePermission("analytics.read"),
  controller.attribution
);

router.get(
  "/admin/analytics/performance",
  adminWorkspaceAuthRequired,
  requireWorkspacePermission("analytics.read"),
  controller.reelPerformance
);

router.get(
  "/admin/:reelId/products",
  adminWorkspaceAuthRequired,
  requireWorkspacePermission("products.read"),
  controller.getAdminReelProducts
);

router.put(
  "/admin/:reelId/products",
  adminWorkspaceAuthRequired,
  requireWorkspacePermission("products.update"),
  controller.setReelProducts
);

router.post(
  "/admin/:reelId/products",
  adminWorkspaceAuthRequired,
  requireWorkspacePermission("products.update"),
  controller.addReelProducts
);

router.delete(
  "/admin/:reelId/products/:productId",
  adminWorkspaceAuthRequired,
  requireWorkspacePermission("products.update"),
  controller.removeReelProduct
);

router.get(
  "/admin/:reelId",
  adminWorkspaceAuthRequired,
  requireWorkspacePermission("products.read"),
  controller.getAdmin
);

router.post(
  "/admin",
  adminWorkspaceAuthRequired,
  requireWorkspacePermission("products.create"),
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
    { name: "pngText", maxCount: 1 },
  ]),
  controller.create
);

router.put(
  "/admin/:reelId",
  adminWorkspaceAuthRequired,
  requireWorkspacePermission("products.update"),
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
    { name: "pngText", maxCount: 1 },
  ]),
  controller.update
);

router.delete(
  "/admin/:reelId",
  adminWorkspaceAuthRequired,
  requireWorkspacePermission("products.delete"),
  controller.remove
);

router.post(
  "/admin/:reelId/publish",
  adminWorkspaceAuthRequired,
  requireWorkspacePermission("products.update"),
  controller.publish
);

router.delete(
  "/admin/:reelId/comments/:commentId",
  adminWorkspaceAuthRequired,
  requireWorkspacePermission("products.update"),
  controller.deleteComment
);

router.get("/", authOptional, controller.listPublic);
router.get("/saved", authRequired, controller.listSaved);

router.post(
  "/track/cart",
  authOptional,
  validate(
    Joi.object({
      reelId: Joi.string().required(),
      productId: Joi.string().required(),
      sessionId: Joi.string().required(),
    })
  ),
  controller.trackAddToCart
);

router.get("/:reelId/products", authOptional, controller.getReelProducts);

router.post(
  "/:reelId/product-widget-open",
  authOptional,
  validate(
    Joi.object({
      sessionId: Joi.string().required(),
    })
  ),
  controller.trackProductWidgetOpen
);

router.get("/:reelId", authOptional, controller.getPublic);

router.post(
  "/:reelId/view",
  authOptional,
  validate(
    Joi.object({
      sessionId: Joi.string().required(),
      viewDuration: Joi.number().min(0).optional(),
      videoDuration: Joi.number().min(0).optional(),
    })
  ),
  controller.trackView
);

router.post("/:reelId/like", authRequired, controller.like);
router.delete("/:reelId/like", authRequired, controller.unlike);

router.get("/:reelId/comments", authOptional, controller.listComments);
router.post(
  "/:reelId/comments",
  authRequired,
  validate(
    Joi.object({
      comment: Joi.string().min(1).max(1000).required(),
      parentCommentId: Joi.string().allow(null, "").optional(),
    })
  ),
  controller.addComment
);

router.post(
  "/:reelId/share",
  authOptional,
  validate(
    Joi.object({
      platform: Joi.string()
        .valid("whatsapp", "facebook", "instagram", "twitter", "telegram", "copy_link", "other")
        .optional(),
      sessionId: Joi.string().optional(),
    })
  ),
  controller.share
);

router.post("/:reelId/save", authRequired, controller.save);
router.delete("/:reelId/save", authRequired, controller.unsave);

router.delete("/:reelId/comments/:commentId", authRequired, controller.deleteOwnComment);

router.post(
  "/:reelId/product-click",
  authOptional,
  validate(
    Joi.object({
      productId: Joi.string().required(),
      sessionId: Joi.string().required(),
    })
  ),
  controller.trackProductClick
);

router.post(
  "/:reelId/product-view",
  authOptional,
  validate(
    Joi.object({
      productId: Joi.string().required(),
      sessionId: Joi.string().required(),
    })
  ),
  controller.trackProductView
);

module.exports = router;
