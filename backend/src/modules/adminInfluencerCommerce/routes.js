const express = require("express");
const Joi = require("joi");
const { validate } = require("../../middleware/validate");
const controller = require("./controller");

const router = express.Router();

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  search: Joi.string().trim().allow("").optional(),
  status: Joi.string().trim().allow("").optional(),
  state: Joi.string().trim().allow("").optional(),
  severity: Joi.string().trim().allow("").optional(),
  category: Joi.string().trim().allow("").optional(),
  country: Joi.string().trim().allow("").optional(),
  campaignType: Joi.string().trim().allow("").optional(),
  contentType: Joi.string().trim().allow("").optional(),
  vendorId: Joi.string().trim().allow("").optional(),
  influencerId: Joi.string().trim().allow("").optional(),
  campaignId: Joi.string().trim().allow("").optional(),
  productId: Joi.string().trim().allow("").optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  sort: Joi.string().trim().allow("").optional(),
});

router.get("/dashboard", validate(querySchema, "query"), controller.dashboard);
router.get("/influencers", validate(querySchema, "query"), controller.influencers);
router.get("/vendors", validate(querySchema, "query"), controller.vendors);
router.get("/campaigns", validate(querySchema, "query"), controller.campaigns);
router.patch(
  "/campaigns/:campaignId",
  validate(
    Joi.object({
      title: Joi.string().trim().max(180).allow("").optional(),
      description: Joi.string().trim().max(2000).allow("").optional(),
      campaignType: Joi.string().trim().allow("").optional(),
      category: Joi.string().trim().allow("").optional(),
      country: Joi.string().trim().allow("").optional(),
      language: Joi.string().trim().allow("").optional(),
      commissionPercent: Joi.number().min(0).max(50).optional(),
      fixedFee: Joi.number().min(0).optional(),
      deadline: Joi.date().iso().allow(null).optional(),
      state: Joi.string().valid("draft", "proposed", "accepted", "active", "completed", "cancelled").optional(),
      note: Joi.string().trim().max(1000).allow("").optional(),
    })
  ),
  controller.updateCampaign
);
router.get("/campaign-applications", validate(querySchema, "query"), controller.applications);
router.patch(
  "/campaigns/:campaignId/applications/:influencerId",
  validate(Joi.object({ decision: Joi.string().valid("approve", "reject", "reopen").required(), note: Joi.string().trim().max(1000).allow("").default("") })),
  controller.reviewCampaignApplication
);
router.get("/matching", validate(querySchema, "query"), controller.matching);
router.get("/affiliate-products", validate(querySchema, "query"), controller.affiliateProducts);
router.get("/affiliate-tracking", validate(querySchema, "query"), controller.tracking);
router.get("/content-moderation", validate(querySchema, "query"), controller.content);
router.patch(
  "/content-moderation/:reelId",
  validate(Joi.object({ decision: Joi.string().valid("approve", "reject", "changes", "publish").required(), note: Joi.string().trim().max(1000).allow("").default(""), requestedChanges: Joi.string().trim().max(1000).allow("").default("") })),
  controller.moderateContent
);
router.get("/product-promotions", validate(querySchema, "query"), controller.productPromotions);
router.get("/commissions", validate(querySchema, "query"), controller.commissions);
router.patch(
  "/commissions/:commissionId",
  validate(Joi.object({ state: Joi.string().valid("HOLD", "SETTLED", "CANCELLED", "REVERSED").optional(), note: Joi.string().trim().max(1000).allow("").optional() })),
  controller.updateCommission
);
router.get("/settlements", validate(querySchema, "query"), controller.settlements);
router.get("/payouts", validate(querySchema, "query"), controller.payouts);
router.get("/withdrawals", validate(querySchema, "query"), controller.withdrawals);
router.patch(
  "/withdrawals/:requestId",
  validate(Joi.object({ action: Joi.string().valid("approve", "reject", "process", "paid", "review").optional(), status: Joi.string().trim().allow("").optional(), note: Joi.string().trim().max(1000).allow("").default("") })),
  controller.updateWithdrawal
);
router.get("/creator-performance", validate(querySchema, "query"), controller.creatorPerformance);
router.get("/vendor-performance", validate(querySchema, "query"), controller.vendorPerformance);
router.get("/campaign-analytics", validate(querySchema, "query"), controller.campaignAnalytics);
router.get("/revenue-analytics", validate(querySchema, "query"), controller.revenueAnalytics);
router.get("/fraud", validate(querySchema, "query"), controller.fraud);
router.patch(
  "/fraud/:alertId",
  validate(Joi.object({ status: Joi.string().valid("OPEN", "UNDER_REVIEW", "SAFE", "ESCALATED", "RESOLVED").required(), notes: Joi.string().trim().max(2000).allow("").default("") })),
  controller.updateFraud
);
router.get("/communication", validate(querySchema, "query"), controller.communication);
router.get("/reports", validate(querySchema, "query"), controller.reports);
router.post(
  "/reports/schedules",
  validate(Joi.object({ reportType: Joi.string().required(), frequency: Joi.string().valid("daily", "weekly", "monthly").required(), format: Joi.string().valid("csv", "excel", "pdf").default("csv"), recipients: Joi.array().items(Joi.string().email()).default([]), filters: Joi.object().unknown(true).default({}), enabled: Joi.boolean().default(true) })),
  controller.saveReportSchedule
);
router.get("/settings", controller.settings);
router.patch("/settings", validate(Joi.object({ enabled: Joi.boolean().optional() }).unknown(true)), controller.updateSettings);
router.get("/audit-logs", validate(querySchema, "query"), controller.auditLogs);

module.exports = router;
