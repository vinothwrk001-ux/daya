const express = require("express");
const Joi = require("joi");
const { authRequired, requireRole } = require("../../middleware/auth");
const { validate } = require("../../middleware/validate");
const controller = require("./controller");

const router = express.Router();
const adminRoles = ["admin", "super_admin", "finance_admin", "commerce_admin"];

const ruleSchema = Joi.object({
  ruleName: Joi.string().trim().max(180).required(),
  ruleCode: Joi.string().trim().max(80).allow("", null),
  ruleType: Joi.string().valid("global", "category", "product", "campaign", "influencer", "traffic_source", "performance", "affiliate", "custom_formula").required(),
  priority: Joi.number().integer().min(0).default(0),
  commissionMethod: Joi.string().valid("percentage", "fixed", "hybrid", "tiered", "performance_bonus", "revenue_share", "custom_formula").required(),
  commissionValue: Joi.number().min(0).max(100).default(0),
  fixedAmount: Joi.number().min(0).default(0),
  revenueSharePercent: Joi.number().min(0).max(100).default(0),
  tiers: Joi.array().items(Joi.object().unknown(true)).default([]),
  bonuses: Joi.array().items(Joi.object().unknown(true)).default([]),
  customFormula: Joi.string().trim().max(2000).allow("").default(""),
  effectiveDate: Joi.date().required(),
  expiryDate: Joi.date().allow(null),
  status: Joi.string().valid("draft", "pending_approval", "active", "inactive", "expired", "rejected", "archived").default("draft"),
  description: Joi.string().trim().max(2000).allow("").default(""),
  categoryId: Joi.string().allow("", null),
  productId: Joi.string().allow("", null),
  campaignId: Joi.string().allow("", null),
  influencerId: Joi.string().allow("", null),
  affiliateId: Joi.string().allow("", null),
  trafficSource: Joi.string().trim().allow("", null),
  metadata: Joi.object().unknown(true).default({}),
  conditions: Joi.array().items(Joi.object({
    field: Joi.string().trim().max(120).required(),
    operator: Joi.string().valid("eq", "ne", "in", "nin", "gt", "gte", "lt", "lte", "exists", "between").default("eq"),
    value: Joi.any(),
    valueTo: Joi.any(),
  })).default([]),
  reason: Joi.string().trim().max(1000).allow("").default(""),
});

const partialRuleSchema = Joi.object({
  ruleName: Joi.string().trim().max(180),
  ruleCode: Joi.string().trim().max(80).allow("", null),
  ruleType: Joi.string().valid("global", "category", "product", "campaign", "influencer", "traffic_source", "performance", "affiliate", "custom_formula"),
  priority: Joi.number().integer().min(0),
  commissionMethod: Joi.string().valid("percentage", "fixed", "hybrid", "tiered", "performance_bonus", "revenue_share", "custom_formula"),
  commissionValue: Joi.number().min(0).max(100),
  fixedAmount: Joi.number().min(0),
  revenueSharePercent: Joi.number().min(0).max(100),
  tiers: Joi.array().items(Joi.object().unknown(true)),
  bonuses: Joi.array().items(Joi.object().unknown(true)),
  customFormula: Joi.string().trim().max(2000).allow(""),
  effectiveDate: Joi.date(),
  expiryDate: Joi.date().allow(null),
  status: Joi.string().valid("draft", "pending_approval", "active", "inactive", "expired", "rejected", "archived"),
  description: Joi.string().trim().max(2000).allow(""),
  categoryId: Joi.string().allow("", null),
  productId: Joi.string().allow("", null),
  campaignId: Joi.string().allow("", null),
  influencerId: Joi.string().allow("", null),
  affiliateId: Joi.string().allow("", null),
  trafficSource: Joi.string().trim().allow("", null),
  metadata: Joi.object().unknown(true),
  conditions: Joi.array().items(Joi.object({
    field: Joi.string().trim().max(120).required(),
    operator: Joi.string().valid("eq", "ne", "in", "nin", "gt", "gte", "lt", "lte", "exists", "between").default("eq"),
    value: Joi.any(),
    valueTo: Joi.any(),
  })),
  reason: Joi.string().trim().max(1000).allow(""),
}).min(1);

router.get("/wallet", authRequired, requireRole("influencer"), controller.wallet);
router.get("/earnings", authRequired, requireRole("influencer"), controller.earnings);
router.get("/withdrawals", authRequired, requireRole("influencer"), controller.withdrawals);
router.post(
  "/withdrawals",
  authRequired,
  requireRole("influencer"),
  validate(
    Joi.object({
      amount: Joi.number().positive().precision(2).required(),
      payoutAccountId: Joi.string().allow("", null),
      paymentMethod: Joi.string().valid("bank_transfer", "upi", "paypal", "stripe_connect", "wise", "manual").default("bank_transfer"),
      remarks: Joi.string().trim().max(1000).allow("").default(""),
    })
  ),
  controller.requestWithdrawal
);
router.post("/withdrawals/:requestId/cancel", authRequired, requireRole("influencer"), controller.cancelWithdrawal);
router.get("/payout-accounts", authRequired, requireRole("influencer"), controller.payoutAccounts);
router.post(
  "/payout-accounts",
  authRequired,
  requireRole("influencer"),
  validate(
    Joi.object({
      accountHolderName: Joi.string().trim().max(160).allow("", null),
      accountNumber: Joi.string().trim().max(40).allow("", null),
      ifscCode: Joi.string().trim().max(20).allow("", null),
      bankName: Joi.string().trim().max(160).allow("", null),
      upiId: Joi.string().trim().max(160).allow("", null),
      paypalEmail: Joi.string().email().allow("", null),
      paymentMethod: Joi.string().valid("bank_transfer", "upi", "paypal", "stripe_connect", "wise", "manual").default("bank_transfer"),
      updateReason: Joi.string().trim().max(500).allow("").default(""),
    })
  ),
  controller.savePayoutAccount
);
router.get("/admin/overview", authRequired, requireRole("admin", "super_admin", "support_admin", "finance_admin"), controller.overview);
router.get("/admin/engine/dashboard", authRequired, requireRole(...adminRoles, "read_only_admin"), controller.dashboard);
router.get("/admin/engine/rules", authRequired, requireRole(...adminRoles, "read_only_admin"), controller.listRules);
router.post("/admin/engine/rules", authRequired, requireRole(...adminRoles), validate(ruleSchema), controller.createRule);
router.patch("/admin/engine/rules/:ruleId", authRequired, requireRole(...adminRoles), validate(partialRuleSchema), controller.updateRule);
router.post("/admin/engine/rules/:ruleId/approve", authRequired, requireRole("admin", "super_admin", "finance_admin"), controller.approveRule);
router.post(
  "/admin/engine/rules/:ruleId/deactivate",
  authRequired,
  requireRole(...adminRoles),
  validate(Joi.object({ reason: Joi.string().trim().max(1000).allow("").default("") })),
  controller.deactivateRule
);
router.post(
  "/admin/engine/simulate",
  authRequired,
  requireRole(...adminRoles, "read_only_admin"),
  validate(
    Joi.object({
      influencerId: Joi.string().allow("", null),
      campaignId: Joi.string().allow("", null),
      productId: Joi.string().allow("", null),
      categoryId: Joi.string().allow("", null),
      vendorId: Joi.string().allow("", null),
      trafficSource: Joi.string().trim().allow("", null),
      revenue: Joi.number().min(0).required(),
      discounts: Joi.number().min(0).default(0),
      platformAdjustments: Joi.number().min(0).default(0),
      expectedOrders: Joi.number().min(0).default(1),
      conversionRate: Joi.number().min(0).default(0),
      campaignCompletion: Joi.number().min(0).default(0),
      reelEngagement: Joi.number().min(0).default(0),
      reelEngagementTarget: Joi.number().min(0).default(0),
      cycle: Joi.string().valid("daily", "weekly", "bi_weekly", "monthly").default("weekly"),
    })
  ),
  controller.simulate
);
router.post(
  "/admin/engine/settlements",
  authRequired,
  requireRole("admin", "super_admin", "finance_admin"),
  validate(
    Joi.object({
      cycle: Joi.string().valid("daily", "weekly", "bi_weekly", "monthly").default("weekly"),
      periodStart: Joi.date().required(),
      periodEnd: Joi.date().required(),
      reason: Joi.string().trim().max(1000).allow("").default(""),
    })
  ),
  controller.createSettlement
);
router.post("/admin/engine/settlements/:settlementId/approve", authRequired, requireRole("admin", "super_admin", "finance_admin"), controller.approveSettlement);
router.post("/admin/engine/settlements/:settlementId/payout-batch", authRequired, requireRole("admin", "super_admin", "finance_admin"), controller.preparePayoutBatch);
router.get("/admin/engine/audit-logs", authRequired, requireRole(...adminRoles, "read_only_admin"), controller.auditLogs);

module.exports = router;
