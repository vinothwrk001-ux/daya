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
      campaignId: Joi.string().required(),
      productIds: Joi.array().items(Joi.string()).default([]),
      videoUrl: Joi.string().min(8).max(2000).required(),
      caption: Joi.string().allow("").max(1000).default(""),
    })
  ),
  controller.upload
);

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
