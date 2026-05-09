const express = require("express");
const Joi = require("joi");
const { authRequired, requireRole } = require("../../middleware/auth");
const { validate } = require("../../middleware/validate");
const controller = require("./controller");

const router = express.Router();

router.post(
  "/create",
  authRequired,
  requireRole("vendor"),
  validate(
    Joi.object({
      influencerId: Joi.string().required(),
      productIds: Joi.array().items(Joi.string().required()).min(1).required(),
      commissionPercent: Joi.number().min(0).max(50).required(),
      fixedFee: Joi.number().min(0).default(0),
      deadline: Joi.date().iso().allow(null),
    })
  ),
  controller.create
);

router.post(
  "/accept",
  authRequired,
  requireRole("influencer"),
  validate(Joi.object({ campaignId: Joi.string().required() })),
  controller.accept
);

router.post(
  "/reject",
  authRequired,
  requireRole("influencer"),
  validate(
    Joi.object({
      campaignId: Joi.string().required(),
      note: Joi.string().allow("").max(500).default(""),
    })
  ),
  controller.reject
);

router.get("/vendor", authRequired, requireRole("vendor"), controller.vendor);
router.get("/influencer", authRequired, requireRole("influencer"), controller.influencer);
router.get("/admin/list", authRequired, requireRole("admin", "super_admin", "support_admin", "finance_admin"), controller.admin);

module.exports = router;
