const mongoose = require("mongoose");

const FIXED_CAMPAIGN_STATUSES = [
  "draft",
  "proposed",
  "accepted",
  "content_submitted",
  "changes_requested",
  "approved",
  "payment_released",
  "completed",
  "cancelled",
  "rejected",
];

const CONTENT_SUBMISSION_STATUSES = [
  "submitted",
  "under_review",
  "approved",
  "changes_requested",
  "rejected",
];

const FIXED_CAMPAIGN_EVENT_TYPES = [
  "CONTENT_VIEW",
  "PRODUCT_CLICK",
  "PRODUCT_VIEW",
  "ADD_TO_CART",
  "CHECKOUT_STARTED",
  "ORDER_COMPLETED",
  "ORDER_CANCELLED",
  "ORDER_REFUNDED",
];

const CONTENT_TYPES = [
  "storefront",
  "reel",
  "post",
  "story",
  "collection",
  "live",
  "campaign",
  "product",
  "other",
];

const sourceTypes = CONTENT_TYPES;

const fixedCampaignSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", required: true, index: true },
    productIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
      default: [],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "Fixed campaign requires at least one product",
      },
    },
    title: { type: String, trim: true, maxlength: 180, default: "" },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    banner: { type: String, trim: true, default: "" },
    category: { type: String, trim: true, default: "", index: true },
    country: { type: String, trim: true, default: "" },
    language: { type: String, trim: true, default: "en" },
    budget: { type: Number, min: 0, required: true, default: 0 },
    spend: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, uppercase: true, default: "INR" },
    status: { type: String, enum: FIXED_CAMPAIGN_STATUSES, default: "proposed", index: true },
    attributionWindowDays: { type: Number, enum: [30, 60, 90], default: 30, index: true },
    startDate: { type: Date },
    endDate: { type: Date },
    acceptedAt: { type: Date },
    completedAt: { type: Date },
    paymentReleasedAt: { type: Date },
    paymentReference: { type: String, trim: true, default: "", index: true },
    paymentRelease: {
      releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      releasedAt: { type: Date },
      reference: { type: String, trim: true, default: "" },
      notes: { type: String, trim: true, maxlength: 1000, default: "" },
    },
    analytics: {
      contentViews: { type: Number, min: 0, default: 0 },
      productClicks: { type: Number, min: 0, default: 0 },
      productViews: { type: Number, min: 0, default: 0 },
      addToCart: { type: Number, min: 0, default: 0 },
      checkoutStarted: { type: Number, min: 0, default: 0 },
      orders: { type: Number, min: 0, default: 0 },
      revenue: { type: Number, min: 0, default: 0 },
      cancelledOrders: { type: Number, min: 0, default: 0 },
      refundedOrders: { type: Number, min: 0, default: 0 },
      lastEventAt: { type: Date },
    },
    pricingSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    influencerRateSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    settingsSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    history: { type: [mongoose.Schema.Types.Mixed], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "fixed_campaigns" }
);

fixedCampaignSchema.index({ vendorId: 1, status: 1, createdAt: -1 });
fixedCampaignSchema.index({ influencerId: 1, status: 1, createdAt: -1 });
fixedCampaignSchema.index({ productIds: 1, status: 1 });

const fixedCampaignDeliverableSchema = new mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "FixedCampaign", required: true, index: true },
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", required: true, index: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerService", index: true },
    packageId: { type: mongoose.Schema.Types.ObjectId, index: true },
    serviceType: { type: String, trim: true, required: true, index: true },
    serviceName: { type: String, trim: true, maxlength: 160, default: "" },
    packageName: { type: String, trim: true, maxlength: 160, default: "" },
    quantity: { type: Number, min: 1, required: true },
    unitPrice: { type: Number, min: 0, required: true },
    totalPrice: { type: Number, min: 0, required: true },
    currency: { type: String, trim: true, uppercase: true, default: "INR" },
    status: { type: String, enum: ["proposed", "accepted", "submitted", "approved", "cancelled"], default: "proposed", index: true },
    dueDate: { type: Date },
    snapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "fixed_campaign_deliverables" }
);

fixedCampaignDeliverableSchema.index({ campaignId: 1, serviceType: 1 });

const campaignContentSubmissionSchema = new mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "FixedCampaign", required: true, index: true },
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", required: true, index: true },
    contentUrl: { type: String, trim: true, required: true },
    contentType: { type: String, enum: CONTENT_TYPES, default: "campaign", index: true },
    contentId: { type: mongoose.Schema.Types.ObjectId, index: true },
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    status: { type: String, enum: CONTENT_SUBMISSION_STATUSES, default: "submitted", index: true },
    notes: { type: String, trim: true, maxlength: 1000, default: "" },
    requestedChanges: { type: String, trim: true, maxlength: 1000, default: "" },
    submittedAt: { type: Date, default: Date.now, index: true },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "campaign_content_submissions" }
);

campaignContentSubmissionSchema.index({ campaignId: 1, status: 1, submittedAt: -1 });

const campaignAnalyticsEventSchema = new mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "FixedCampaign", required: true, index: true },
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", index: true },
    contentType: { type: String, enum: CONTENT_TYPES, default: "campaign", index: true },
    contentId: { type: mongoose.Schema.Types.ObjectId, index: true },
    visitorId: { type: String, trim: true, required: true, index: true },
    sessionId: { type: String, trim: true, required: true, index: true },
    eventType: { type: String, enum: FIXED_CAMPAIGN_EVENT_TYPES, required: true, index: true },
    sourceType: { type: String, enum: sourceTypes, default: "campaign", index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", index: true },
    saleAmount: { type: Number, min: 0, default: 0 },
    trackingTokenId: { type: String, trim: true, default: "", index: true },
    dedupKey: { type: String, trim: true, unique: true, sparse: true, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: { createdAt: false, updatedAt: false }, collection: "campaign_analytics_events" }
);

campaignAnalyticsEventSchema.index({ campaignId: 1, eventType: 1, createdAt: -1 });
campaignAnalyticsEventSchema.index({ visitorId: 1, productId: 1, createdAt: -1 });
campaignAnalyticsEventSchema.index({ sessionId: 1, campaignId: 1, createdAt: -1 });

const campaignOrderAttributionSchema = new mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "FixedCampaign", required: true, index: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", required: true, index: true },
    saleAmount: { type: Number, min: 0, required: true },
    sourceType: { type: String, enum: sourceTypes, default: "campaign", index: true },
    attributedAt: { type: Date, default: Date.now, index: true },
    analyticsEventId: { type: mongoose.Schema.Types.ObjectId, ref: "CampaignAnalyticsEvent" },
    trackingTokenId: { type: String, trim: true, default: "", index: true },
    analyticsOnly: { type: Boolean, default: true },
    payoutExcluded: { type: Boolean, default: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "campaign_order_attributions" }
);

campaignOrderAttributionSchema.index({ orderId: 1, campaignId: 1, productId: 1 }, { unique: true });
campaignOrderAttributionSchema.index({ campaignId: 1, attributedAt: -1 });
campaignOrderAttributionSchema.index({ influencerId: 1, attributedAt: -1 });

const fixedCampaignSettingSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true, default: "default", unique: true, index: true },
    attributionWindowDays: { type: Number, enum: [30, 60, 90], default: 30 },
    contentApprovalRules: {
      requireVendorApproval: { type: Boolean, default: true },
      allowChangeRequests: { type: Boolean, default: true },
    },
    deliverableTemplates: { type: [mongoose.Schema.Types.Mixed], default: [] },
    analyticsSettings: {
      dedupeMinutes: { type: Number, min: 0, default: 10 },
      trackViews: { type: Boolean, default: true },
      trackProductEvents: { type: Boolean, default: true },
    },
    campaignStatusRules: { type: mongoose.Schema.Types.Mixed, default: {} },
    paymentReleaseRules: {
      requireAcceptedCampaign: { type: Boolean, default: true },
      requireApprovedContent: { type: Boolean, default: true },
      autoReleaseOnApproval: { type: Boolean, default: false },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "fixed_campaign_settings" }
);

const fixedCampaignAuditLogSchema = new mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "FixedCampaign", index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    role: { type: String, trim: true, default: "" },
    action: { type: String, trim: true, required: true, index: true },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "fixed_campaign_audit_logs" }
);

fixedCampaignAuditLogSchema.index({ campaignId: 1, createdAt: -1 });

module.exports = {
  FixedCampaign: mongoose.models.FixedCampaign || mongoose.model("FixedCampaign", fixedCampaignSchema),
  FixedCampaignDeliverable:
    mongoose.models.FixedCampaignDeliverable ||
    mongoose.model("FixedCampaignDeliverable", fixedCampaignDeliverableSchema),
  CampaignContentSubmission:
    mongoose.models.CampaignContentSubmission ||
    mongoose.model("CampaignContentSubmission", campaignContentSubmissionSchema),
  CampaignAnalyticsEvent:
    mongoose.models.CampaignAnalyticsEvent ||
    mongoose.model("CampaignAnalyticsEvent", campaignAnalyticsEventSchema),
  CampaignOrderAttribution:
    mongoose.models.CampaignOrderAttribution ||
    mongoose.model("CampaignOrderAttribution", campaignOrderAttributionSchema),
  FixedCampaignSetting:
    mongoose.models.FixedCampaignSetting ||
    mongoose.model("FixedCampaignSetting", fixedCampaignSettingSchema),
  FixedCampaignAuditLog:
    mongoose.models.FixedCampaignAuditLog ||
    mongoose.model("FixedCampaignAuditLog", fixedCampaignAuditLogSchema),
  FIXED_CAMPAIGN_STATUSES,
  FIXED_CAMPAIGN_EVENT_TYPES,
  CONTENT_SUBMISSION_STATUSES,
  CONTENT_TYPES,
};
