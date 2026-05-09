const express = require("express");
const Joi = require("joi");
const { authRequired, requireRole } = require("../../middleware/auth");
const { validate } = require("../../middleware/validate");
const controller = require("./controller");
const { INFLUENCER_CATEGORIES, INFLUENCER_STATES } = require("../shared/constants");

const router = express.Router();

const saveSchema = Joi.object({
  categories: Joi.array().items(Joi.string().valid(...INFLUENCER_CATEGORIES)).default([]),
  followers: Joi.number().min(0).default(0),
  bio: Joi.string().allow("").max(1200).default(""),
  socialHandles: Joi.object({
    instagram: Joi.string().allow("").default(""),
    youtube: Joi.string().allow("").default(""),
    website: Joi.string().allow("").default(""),
  }).default({}),
  submit: Joi.boolean().default(false),
});

const moderateSchema = Joi.object({
  state: Joi.string().valid(...INFLUENCER_STATES).required(),
  notes: Joi.string().allow("").max(1000).default(""),
});

const dashboardQuery = Joi.object({
  refresh: Joi.string().optional(),
});

const earningsQuery = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  type: Joi.string().valid("CREDIT", "DEBIT").optional(),
  source: Joi.string().valid("COMMISSION", "REVERSAL").optional(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
});

router.post("/register", authRequired, requireRole("influencer", "user"), validate(saveSchema), controller.register);
router.get("/profile", authRequired, requireRole("influencer"), controller.profile);
router.put("/profile", authRequired, requireRole("influencer"), validate(saveSchema), controller.update);
router.get("/dashboard", authRequired, requireRole("influencer"), validate(dashboardQuery, "query"), controller.dashboard);
router.get("/earnings", authRequired, requireRole("influencer"), validate(earningsQuery, "query"), controller.earnings);
router.get("/list", controller.list);
router.get("/admin/list", authRequired, requireRole("admin", "super_admin", "support_admin", "finance_admin"), controller.list);
router.patch("/admin/:id/status", authRequired, requireRole("admin", "super_admin", "support_admin", "finance_admin"), validate(moderateSchema), controller.moderate);

module.exports = router;
