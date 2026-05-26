const path = require("path");
const express = require("express");
const Joi = require("joi");
const { authRequired, authOptional, requireRole } = require("../../middleware/auth");
const { validate } = require("../../middleware/validate");
const { optionalReelVideoUpload } = require("../../middleware/reelUpload");
const controller = require("./controller");

const router = express.Router();

function prepareReelUploadBody(req, _res, next) {
  let productIds = req.body.productIds;
  if (productIds === undefined || productIds === "") {
    productIds = [];
  } else if (typeof productIds === "string") {
    try {
      productIds = JSON.parse(productIds);
    } catch {
      productIds = [];
    }
  }
  if (!Array.isArray(productIds)) productIds = [];
  req.body.productIds = productIds;

  if (req.file) {
    req.body.videoUrl = `/uploads/reels/${path.basename(req.file.path)}`;
  }
  next();
}

router.post(
  "/upload",
  authRequired,
  requireRole("influencer"),
  optionalReelVideoUpload,
  prepareReelUploadBody,
  validate(
    Joi.object({
      campaignId: Joi.string().allow("").optional(),
      productIds: Joi.array().items(Joi.string()).default([]),
      collectionIds: Joi.array().items(Joi.string()).default([]),
      videoUrl: Joi.string().min(8).max(2000).required(),
      thumbnailUrl: Joi.string().allow("").max(2000).optional(),
      title: Joi.string().allow("").max(160).optional(),
      description: Joi.string().allow("").max(2000).optional(),
      contentType: Joi.string().valid("product_video", "review", "tutorial", "unboxing", "lifestyle", "campaign", "affiliate", "brand_collaboration", "short", "reel", "live").default("reel"),
      category: Joi.string().allow("").optional(),
      tags: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string().allow("")).optional(),
      language: Joi.string().allow("").optional(),
      brand: Joi.string().allow("").optional(),
      visibility: Joi.string().valid("draft", "scheduled", "published", "private", "unlisted", "archived").optional(),
      scheduledAt: Joi.date().iso().allow(null).optional(),
      caption: Joi.string().allow("").max(1000).default(""),
    })
  ),
  controller.upload
);

const contentQuery = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(50).optional(),
  search: Joi.string().allow("").optional(),
  state: Joi.string().valid("uploaded", "pending_review", "approved", "published", "rejected").optional(),
  contentType: Joi.string().allow("").optional(),
  visibility: Joi.string().allow("").optional(),
  category: Joi.string().allow("").optional(),
  campaignId: Joi.string().allow("").optional(),
  productId: Joi.string().allow("").optional(),
  scheduled: Joi.string().valid("true", "false").optional(),
  sort: Joi.string().valid("newest", "views", "revenue").optional(),
});

const contentUpdateSchema = Joi.object({
  title: Joi.string().allow("").max(160).optional(),
  description: Joi.string().allow("").max(2000).optional(),
  caption: Joi.string().allow("").max(1000).optional(),
  thumbnailUrl: Joi.string().allow("").max(2000).optional(),
  contentType: Joi.string().allow("").optional(),
  category: Joi.string().allow("").optional(),
  tags: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string().allow("")).optional(),
  language: Joi.string().allow("").optional(),
  productIds: Joi.array().items(Joi.string()).optional(),
  collectionIds: Joi.array().items(Joi.string()).optional(),
  campaignId: Joi.string().allow("").optional(),
  visibility: Joi.string().valid("draft", "scheduled", "published", "private", "unlisted", "archived").optional(),
  scheduledAt: Joi.date().iso().allow(null).optional(),
  seo: Joi.object().unknown(true).optional(),
  action: Joi.string().valid("publish", "archive", "save").optional(),
});

router.post(
  "/publish",
  authRequired,
  requireRole("influencer", "admin", "super_admin", "support_admin", "finance_admin"),
  validate(
    Joi.object({
      reelId: Joi.string().required(),
      action: Joi.string().valid("publish", "reject").default("publish"),
      notes: Joi.string().allow("").max(1000).default(""),
    })
  ),
  controller.publish
);

router.get("/feed", authOptional, controller.feed);
router.get("/content", authRequired, requireRole("influencer"), validate(contentQuery, "query"), controller.contentList);
router.get("/content/analytics", authRequired, requireRole("influencer"), validate(contentQuery, "query"), controller.contentAnalytics);
router.get("/content/media-library", authRequired, requireRole("influencer"), validate(contentQuery, "query"), controller.mediaLibrary);
router.get("/content/live", authRequired, requireRole("influencer"), validate(contentQuery, "query"), controller.liveSessions);
router.post("/content/live", authRequired, requireRole("influencer"), validate(contentUpdateSchema), controller.createLiveSession);
router.patch("/content/:id", authRequired, requireRole("influencer"), validate(contentUpdateSchema), controller.contentUpdate);
router.get("/mine", authRequired, requireRole("influencer"), controller.influencerList);
router.get(
  "/influencer",
  authRequired,
  requireRole("influencer"),
  validate(
    Joi.object({
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(50).optional(),
      state: Joi.string().valid("uploaded", "pending_review", "approved", "published", "rejected").optional(),
    }),
    "query"
  ),
  controller.influencerPaginated
);
router.get("/admin/list", authRequired, requireRole("admin", "super_admin", "support_admin", "finance_admin"), controller.adminList);
router.get("/:id", authOptional, controller.getById);

module.exports = router;
