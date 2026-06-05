const mongoose = require("mongoose");

const STATUS_VALUES = ["draft", "review", "approved", "active", "inactive", "archived"];
const BILLING_CYCLES = ["monthly", "quarterly", "half_yearly", "yearly", "custom"];
const SUBSCRIPTION_STATUSES = ["not_subscribed", "active", "expired", "cancelled", "pending_payment", "payment_failed", "grace_period", "suspended", "trialing", "past_due"];

const approvalSchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUS_VALUES, default: "draft", index: true },
    version: { type: Number, min: 1, default: 1, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    archivedAt: { type: Date },
    reason: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  { _id: false }
);

const scoreConfigSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 120, default: "Default influencer score formula" },
    followersWeight: { type: Number, min: 0, max: 100, default: 30 },
    engagementWeight: { type: Number, min: 0, max: 100, default: 25 },
    conversionWeight: { type: Number, min: 0, max: 100, default: 20 },
    completionWeight: { type: Number, min: 0, max: 100, default: 15 },
    revenueWeight: { type: Number, min: 0, max: 100, default: 10 },
    normalization: {
      followersMax: { type: Number, min: 1, default: 1000000 },
      engagementMax: { type: Number, min: 1, default: 20 },
      conversionMax: { type: Number, min: 1, default: 25 },
      completionMax: { type: Number, min: 1, default: 100 },
      revenueMax: { type: Number, min: 1, default: 1000000 },
    },
    approval: { type: approvalSchema, default: () => ({}) },
  },
  { timestamps: true, collection: "influencer_score_configs" }
);

scoreConfigSchema.index({ "approval.status": 1, "approval.version": -1 });

const tierSchema = new mongoose.Schema(
  {
    tierName: { type: String, trim: true, required: true, maxlength: 80 },
    badge: { type: String, trim: true, maxlength: 120, default: "" },
    color: { type: String, trim: true, maxlength: 40, default: "#475569" },
    priority: { type: Number, default: 0, index: true },
    minScore: { type: Number, min: 0, max: 100, default: 0 },
    maxScore: { type: Number, min: 0, max: 100, default: 100 },
    minFollowers: { type: Number, min: 0, default: 0 },
    maxFollowers: { type: Number, min: 0, default: 0 },
    benefits: { type: [String], default: [] },
    visibilityRules: { type: mongoose.Schema.Types.Mixed, default: {} },
    linkedPlanId: { type: mongoose.Schema.Types.ObjectId, ref: "VendorSubscriptionPlan", index: true },
    displayOrder: { type: Number, default: 0, index: true },
    approval: { type: approvalSchema, default: () => ({ status: "active" }) },
  },
  { timestamps: true, collection: "influencer_tiers" }
);

tierSchema.index({ "approval.status": 1, minScore: 1, maxScore: 1 });

const vendorSubscriptionPlanSchema = new mongoose.Schema(
  {
    planName: { type: String, trim: true, required: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    monthlyPrice: { type: Number, min: 0, default: 0 },
    quarterlyPrice: { type: Number, min: 0, default: 0 },
    halfYearlyPrice: { type: Number, min: 0, default: 0 },
    yearlyPrice: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, uppercase: true, default: "INR" },
    durationDays: { type: Number, min: 1, default: 30 },
    monthlyDurationDays: { type: Number, min: 1, default: 30 },
    quarterlyDurationDays: { type: Number, min: 1, default: 90 },
    halfYearlyDurationDays: { type: Number, min: 1, default: 180 },
    yearlyDurationDays: { type: Number, min: 1, default: 365 },
    customDurationDays: { type: Number, min: 1, default: 30 },
    autoRenewAllowed: { type: Boolean, default: false },
    campaignLimit: { type: Number, min: -1, default: 1 },
    influencerVisibilityLimit: { type: Number, min: -1, default: 20 },
    linkedTierId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerTier", index: true },
    allowedTiers: [{ type: mongoose.Schema.Types.ObjectId, ref: "InfluencerTier" }],
    allowAllTiers: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
    featuredCampaigns: { type: Boolean, default: false },
    advancedAnalytics: { type: Boolean, default: false },
    dedicatedManager: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    approval: { type: approvalSchema, default: () => ({ status: "active" }) },
  },
  { timestamps: true, collection: "vendor_subscription_plans" }
);

vendorSubscriptionPlanSchema.index({ "approval.status": 1, displayOrder: 1 });

const vendorSubscriptionSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "VendorSubscriptionPlan", required: true },
    billingCycle: { type: String, enum: BILLING_CYCLES, default: "monthly" },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    expiredAt: { type: Date },
    status: { type: String, enum: SUBSCRIPTION_STATUSES, default: "active", index: true },
    autoRenew: { type: Boolean, default: false, index: true },
    paymentReference: { type: String, trim: true, default: "" },
    campaignLimit: { type: Number, min: -1, default: 1 },
    visibilityLimit: { type: Number, min: -1, default: 20 },
    allowedTiers: [{ type: mongoose.Schema.Types.ObjectId, ref: "InfluencerTier" }],
    entitlementsSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "vendor_subscriptions" }
);

vendorSubscriptionSchema.index({ vendorId: 1, status: 1, endDate: 1 });

const subscriptionPaymentSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "VendorSubscriptionPlan", required: true, index: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "VendorSubscription", index: true },
    billingCycle: { type: String, enum: BILLING_CYCLES, default: "monthly" },
    amount: { type: Number, min: 0, required: true },
    currency: { type: String, trim: true, uppercase: true, default: "INR" },
    razorpayOrderId: { type: String, trim: true, unique: true, sparse: true, index: true },
    razorpayPaymentId: { type: String, trim: true, unique: true, sparse: true, index: true },
    signature: { type: String, trim: true, default: "" },
    receipt: { type: String, trim: true, default: "" },
    invoiceId: { type: String, trim: true, index: true, default: "" },
    status: { type: String, enum: ["created", "pending", "paid", "failed", "cancelled", "refunded"], default: "created", index: true },
    failureReason: { type: String, trim: true, default: "" },
    gatewayResponse: { type: mongoose.Schema.Types.Mixed, default: {} },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "subscription_payments" }
);

const subscriptionRevenueSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "VendorSubscriptionPlan", required: true, index: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "VendorSubscription", required: true, index: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "SubscriptionPayment", required: true, index: true },
    grossAmount: { type: Number, min: 0, default: 0 },
    tax: { type: Number, min: 0, default: 0 },
    gatewayFee: { type: Number, min: 0, default: 0 },
    netAmount: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, uppercase: true, default: "INR" },
    invoiceId: { type: String, trim: true, index: true, default: "" },
    status: { type: String, enum: ["recognized", "refunded", "failed"], default: "recognized", index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "subscription_revenue" }
);

const vendorSubscriptionChangeSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    oldSubscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "VendorSubscription", index: true },
    newSubscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "VendorSubscription", index: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "SubscriptionPayment", index: true },
    oldPlanId: { type: mongoose.Schema.Types.ObjectId, ref: "VendorSubscriptionPlan", index: true },
    newPlanId: { type: mongoose.Schema.Types.ObjectId, ref: "VendorSubscriptionPlan", required: true, index: true },
    oldCycle: { type: String, enum: BILLING_CYCLES, default: "monthly" },
    newCycle: { type: String, enum: BILLING_CYCLES, default: "monthly" },
    remainingDays: { type: Number, min: 0, default: 0 },
    remainingCredit: { type: Number, min: 0, default: 0 },
    newPlanPrice: { type: Number, min: 0, default: 0 },
    creditApplied: { type: Number, min: 0, default: 0 },
    finalAmountPaid: { type: Number, min: 0, default: 0 },
    changeType: { type: String, enum: ["new", "upgrade", "downgrade", "cycle_change", "renewal"], default: "new", index: true },
    status: { type: String, enum: ["previewed", "pending_payment", "completed", "failed", "cancelled"], default: "previewed", index: true },
    reason: { type: String, trim: true, maxlength: 1000, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "vendor_subscription_changes" }
);

const subscriptionCreditWalletSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    creditAmount: { type: Number, min: 0, required: true },
    remainingAmount: { type: Number, min: 0, required: true },
    currency: { type: String, trim: true, uppercase: true, default: "INR" },
    source: { type: String, trim: true, maxlength: 120, default: "subscription_change" },
    sourcePlanId: { type: mongoose.Schema.Types.ObjectId, ref: "VendorSubscriptionPlan", index: true },
    targetPlanId: { type: mongoose.Schema.Types.ObjectId, ref: "VendorSubscriptionPlan", index: true },
    changeId: { type: mongoose.Schema.Types.ObjectId, ref: "VendorSubscriptionChange", index: true },
    status: { type: String, enum: ["active", "applied", "expired", "cancelled"], default: "active", index: true },
    expiresAt: { type: Date, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "subscription_credit_wallet" }
);

const campaignBudgetControlSchema = new mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true, unique: true, index: true },
    budget: { type: Number, min: 0, default: 0 },
    spentAmount: { type: Number, min: 0, default: 0 },
    remainingAmount: { type: Number, min: 0, default: 0 },
    expectedCommission: { type: Number, min: 0, default: 0 },
    projectedSpend: { type: Number, min: 0, default: 0 },
    warningSent: { type: Boolean, default: false },
    criticalWarningSent: { type: Boolean, default: false },
    paused: { type: Boolean, default: false, index: true },
    lastEvaluatedAt: { type: Date },
    settingsSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "campaign_budget_controls" }
);

const budgetProtectionRuleSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 120, default: "Default campaign budget protection" },
    warningThresholdPercent: { type: Number, min: 0, max: 100, default: 20 },
    criticalThresholdPercent: { type: Number, min: 0, max: 100, default: 10 },
    pauseWhenExhausted: { type: Boolean, default: true },
    stopApplicationsWhenExhausted: { type: Boolean, default: true },
    stopCommissionAllocationWhenExhausted: { type: Boolean, default: true },
    notifyVendor: { type: Boolean, default: true },
    notifyAdmin: { type: Boolean, default: true },
    approval: { type: approvalSchema, default: () => ({ status: "active" }) },
  },
  { timestamps: true, collection: "campaign_budget_protection_rules" }
);

const marketplaceRankingRuleSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 120, default: "Default marketplace ranking formula" },
    scoreWeight: { type: Number, min: 0, max: 100, default: 35 },
    revenueWeight: { type: Number, min: 0, max: 100, default: 20 },
    ordersWeight: { type: Number, min: 0, max: 100, default: 10 },
    conversionWeight: { type: Number, min: 0, max: 100, default: 15 },
    campaignSuccessWeight: { type: Number, min: 0, max: 100, default: 10 },
    storefrontRevenueWeight: { type: Number, min: 0, max: 100, default: 5 },
    engagementWeight: { type: Number, min: 0, max: 100, default: 5 },
    followersWeight: { type: Number, min: 0, max: 100, default: 5 },
    approval: { type: approvalSchema, default: () => ({ status: "active" }) },
  },
  { timestamps: true, collection: "marketplace_ranking_rules" }
);

marketplaceRankingRuleSchema.index({ "approval.status": 1, "approval.version": -1 });

const platformConfigurationSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true, required: true, unique: true, index: true },
    label: { type: String, trim: true, maxlength: 160, default: "" },
    module: { type: String, trim: true, default: "influencer_commerce", index: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    valueType: { type: String, enum: ["boolean", "number", "string", "json", "array"], default: "json" },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    approval: { type: approvalSchema, default: () => ({ status: "active" }) },
  },
  { timestamps: true, collection: "influencer_platform_configurations" }
);

const configVersionSchema = new mongoose.Schema(
  {
    module: { type: String, trim: true, required: true, index: true },
    entityType: { type: String, trim: true, required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    version: { type: Number, min: 1, required: true },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    reason: { type: String, trim: true, maxlength: 1000, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "influencer_config_versions" }
);

configVersionSchema.index({ entityType: 1, entityId: 1, version: -1 });

const configAuditLogSchema = new mongoose.Schema(
  {
    module: { type: String, trim: true, required: true, index: true },
    entityType: { type: String, trim: true, required: true, index: true },
    entityId: { type: String, trim: true, default: "", index: true },
    action: { type: String, trim: true, required: true, index: true },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    reason: { type: String, trim: true, maxlength: 1000, default: "" },
    ipAddress: { type: String, trim: true, maxlength: 100, default: "" },
    userAgent: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true, collection: "config_audit_logs" }
);

configAuditLogSchema.index({ createdAt: -1, module: 1 });

module.exports = {
  InfluencerScoreConfig: mongoose.models.InfluencerScoreConfig || mongoose.model("InfluencerScoreConfig", scoreConfigSchema),
  InfluencerTier: mongoose.models.InfluencerTier || mongoose.model("InfluencerTier", tierSchema),
  VendorSubscriptionPlan: mongoose.models.VendorSubscriptionPlan || mongoose.model("VendorSubscriptionPlan", vendorSubscriptionPlanSchema),
  VendorSubscription: mongoose.models.VendorSubscription || mongoose.model("VendorSubscription", vendorSubscriptionSchema),
  SubscriptionPayment: mongoose.models.SubscriptionPayment || mongoose.model("SubscriptionPayment", subscriptionPaymentSchema),
  SubscriptionRevenue: mongoose.models.SubscriptionRevenue || mongoose.model("SubscriptionRevenue", subscriptionRevenueSchema),
  VendorSubscriptionChange: mongoose.models.VendorSubscriptionChange || mongoose.model("VendorSubscriptionChange", vendorSubscriptionChangeSchema),
  SubscriptionCreditWallet: mongoose.models.SubscriptionCreditWallet || mongoose.model("SubscriptionCreditWallet", subscriptionCreditWalletSchema),
  CampaignBudgetControl: mongoose.models.CampaignBudgetControl || mongoose.model("CampaignBudgetControl", campaignBudgetControlSchema),
  BudgetProtectionRule: mongoose.models.BudgetProtectionRule || mongoose.model("BudgetProtectionRule", budgetProtectionRuleSchema),
  MarketplaceRankingRule: mongoose.models.MarketplaceRankingRule || mongoose.model("MarketplaceRankingRule", marketplaceRankingRuleSchema),
  InfluencerPlatformConfiguration: mongoose.models.InfluencerPlatformConfiguration || mongoose.model("InfluencerPlatformConfiguration", platformConfigurationSchema),
  InfluencerConfigVersion: mongoose.models.InfluencerConfigVersion || mongoose.model("InfluencerConfigVersion", configVersionSchema),
  ConfigAuditLog: mongoose.models.ConfigAuditLog || mongoose.model("ConfigAuditLog", configAuditLogSchema),
  STATUS_VALUES,
  BILLING_CYCLES,
  SUBSCRIPTION_STATUSES,
};
