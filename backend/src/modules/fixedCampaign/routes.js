const express = require("express");
const Joi = require("joi");
const { authRequired, authOptional, requireRole } = require("../../middleware/auth");
const { requireApprovedVendor } = require("../../middleware/vendorApproval");
const { validate } = require("../../middleware/validate");
const { eventSecurity } = require("../tracking/security.middleware");
const controller = require("./controller");

const router = express.Router();
const vendorAuth = [authRequired, requireRole("vendor"), requireApprovedVendor];

const listQuery = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  search: Joi.string().trim().allow("").optional(),
  status: Joi.string().trim().allow("").optional(),
  category: Joi.string().trim().allow("").optional(),
  productId: Joi.string().trim().allow("").optional(),
  influencerId: Joi.string().trim().allow("").optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
});

const campaignPayload = Joi.object({
  influencerId: Joi.string().required(),
  productIds: Joi.array().items(Joi.string().required()).min(1).required(),
  title: Joi.string().trim().max(180).allow("").default(""),
  description: Joi.string().trim().max(2000).allow("").default(""),
  banner: Joi.string().trim().allow("").default(""),
  category: Joi.string().trim().allow("").default(""),
  country: Joi.string().trim().allow("").default(""),
  language: Joi.string().trim().allow("").default("en"),
  selectedServices: Joi.array().items(Joi.object().unknown(true)).default([]),
  services: Joi.array().items(Joi.object().unknown(true)).default([]),
  paymentModel: Joi.object({
    selectedServices: Joi.array().items(Joi.object().unknown(true)).default([]),
    services: Joi.array().items(Joi.object().unknown(true)).default([]),
    currency: Joi.string().trim().max(8).optional(),
  }).unknown(true).optional(),
  attributionWindowDays: Joi.number().valid(30, 60, 90).optional(),
  startDate: Joi.date().iso().allow(null).optional(),
  endDate: Joi.date().iso().allow(null).optional(),
  deadline: Joi.date().iso().allow(null).optional(),
  currency: Joi.string().trim().max(8).optional(),
  metadata: Joi.object().unknown(true).default({}),
});

const contentPayload = Joi.object({
  contentUrl: Joi.string().trim().uri({ allowRelative: true }).required(),
  contentType: Joi.string().trim().allow("").default("campaign"),
  contentId: Joi.string().allow("", null),
  productIds: Joi.array().items(Joi.string().required()).default([]),
  notes: Joi.string().trim().max(1000).allow("").default(""),
  metadata: Joi.object().unknown(true).default({}),
});

const trackingPayload = Joi.object({
  campaignId: Joi.string().required(),
  productId: Joi.string().allow("", null),
  contentType: Joi.string().allow("", null),
  contentId: Joi.string().allow("", null),
  sourceType: Joi.string().allow("", null),
  visitorId: Joi.string().trim().max(200).allow("", null),
  anonymousId: Joi.string().trim().max(200).allow("", null),
  sessionId: Joi.string().trim().max(200).allow("", null),
  eventType: Joi.string()
    .valid("CONTENT_VIEW", "PRODUCT_CLICK", "PRODUCT_VIEW", "ADD_TO_CART", "CHECKOUT_STARTED")
    .required(),
  metadata: Joi.object().unknown(true).default({}),
});

router.post("/preview", vendorAuth, validate(campaignPayload), controller.preview);
router.post("/", vendorAuth, validate(campaignPayload), controller.create);
router.get("/vendor", vendorAuth, validate(listQuery, "query"), controller.listVendor);
router.get("/vendor/analytics", vendorAuth, validate(listQuery, "query"), controller.vendorAnalytics);
router.get("/vendor/products/:productId/analytics", vendorAuth, validate(listQuery, "query"), controller.productAnalytics);
router.post(
  "/:campaignId/release-payment",
  vendorAuth,
  validate(Joi.object({ reference: Joi.string().trim().max(160).allow("").default(""), paymentReference: Joi.string().trim().max(160).allow("").default(""), notes: Joi.string().trim().max(1000).allow("").default("") })),
  controller.releasePayment
);
router.post(
  "/:campaignId/cancel",
  vendorAuth,
  validate(Joi.object({ note: Joi.string().trim().max(1000).allow("").default("") })),
  controller.cancel
);
router.patch(
  "/content/:submissionId/review",
  vendorAuth,
  validate(
    Joi.object({
      decision: Joi.string().valid("approve", "reject", "changes").required(),
      note: Joi.string().trim().max(1000).allow("").default(""),
      requestedChanges: Joi.string().trim().max(1000).allow("").default(""),
    })
  ),
  controller.reviewContent
);

router.get("/influencer", authRequired, requireRole("influencer"), validate(listQuery, "query"), controller.listInfluencer);
router.get("/influencer/analytics", authRequired, requireRole("influencer"), validate(listQuery, "query"), controller.influencerAnalytics);
router.post("/:campaignId/accept", authRequired, requireRole("influencer"), controller.accept);
router.post(
  "/:campaignId/reject",
  authRequired,
  requireRole("influencer"),
  validate(Joi.object({ note: Joi.string().trim().max(1000).allow("").default("") })),
  controller.reject
);
router.post("/:campaignId/content", authRequired, requireRole("influencer"), validate(contentPayload), controller.submitContent);

router.post(
  "/track",
  authOptional,
  eventSecurity("product_click", { blockOnLimit: false }),
  validate(trackingPayload),
  controller.track
);

router.get("/settings", authRequired, requireRole("admin", "super_admin", "support_admin", "finance_admin"), controller.getSettings);
router.put(
  "/settings",
  authRequired,
  requireRole("admin", "super_admin", "support_admin", "finance_admin"),
  validate(
    Joi.object({
      attributionWindowDays: Joi.number().valid(30, 60, 90).optional(),
      contentApprovalRules: Joi.object().unknown(true).optional(),
      deliverableTemplates: Joi.array().items(Joi.object().unknown(true)).optional(),
      analyticsSettings: Joi.object().unknown(true).optional(),
      campaignStatusRules: Joi.object().unknown(true).optional(),
      paymentReleaseRules: Joi.object().unknown(true).optional(),
    })
  ),
  controller.updateSettings
);
router.get("/admin", authRequired, requireRole("admin", "super_admin", "support_admin", "finance_admin"), validate(listQuery, "query"), controller.adminList);

module.exports = router;
