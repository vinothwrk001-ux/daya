const mongoose = require("mongoose");

const RELATIONSHIP_STATUSES = ["viewed", "saved", "invited", "applied", "approved", "active", "paused", "blacklisted"];
const SERVICE_STATUSES = ["draft", "active", "inactive", "archived"];
const PAYMENT_MODEL_TYPES = ["fixed", "commission", "hybrid", "free_product"];

const vendorInfluencerRelationshipSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    influencerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InfluencerProfile",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: RELATIONSHIP_STATUSES,
      default: "saved",
      index: true,
    },
    source: {
      type: String,
      enum: ["discovery", "campaign_invite", "campaign_application", "content", "order_attribution", "manual"],
      default: "manual",
      index: true,
    },
    activeCampaignIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Campaign" }],
    saved: { type: Boolean, default: false, index: true },
    visited: { type: Boolean, default: false, index: true },
    visitCount: { type: Number, min: 0, default: 0 },
    firstVisitedAt: { type: Date },
    lastVisitedAt: { type: Date, index: true },
    lastActivityAt: { type: Date, default: Date.now, index: true },
    pausedAt: { type: Date },
    blacklistedAt: { type: Date },
    blacklistReason: { type: String, trim: true, maxlength: 500, default: "" },
    notes: { type: String, trim: true, maxlength: 1200, default: "" },
    metricsSnapshot: {
      revenue: { type: Number, min: 0, default: 0 },
      commission: { type: Number, min: 0, default: 0 },
      orders: { type: Number, min: 0, default: 0 },
      clicks: { type: Number, min: 0, default: 0 },
      conversionRate: { type: Number, min: 0, default: 0 },
      activeCampaigns: { type: Number, min: 0, default: 0 },
      calculatedAt: { type: Date },
    },
  },
  {
    timestamps: true,
    collection: "vendor_influencer_relationships",
  }
);

vendorInfluencerRelationshipSchema.index({ vendorId: 1, influencerId: 1 }, { unique: true });
vendorInfluencerRelationshipSchema.index({ vendorId: 1, status: 1, lastActivityAt: -1 });

const influencerServicePackageSchema = new mongoose.Schema(
  {
    packageName: { type: String, trim: true, required: true, maxlength: 160 },
    quantity: { type: Number, min: 1, default: 1 },
    price: { type: Number, min: 0, required: true },
    currency: { type: String, trim: true, uppercase: true, default: "INR" },
    deliveryDays: { type: Number, min: 0, default: 0 },
    deliveryLabel: { type: String, trim: true, maxlength: 120, default: "" },
    revisionCount: { type: Number, min: 0, default: 0 },
    description: { type: String, trim: true, maxlength: 1200, default: "" },
    status: { type: String, enum: SERVICE_STATUSES, default: "active", index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: true }
);

const influencerServiceSchema = new mongoose.Schema(
  {
    influencerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InfluencerProfile",
      required: true,
      index: true,
    },
    serviceTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerServiceType", index: true },
    serviceTypeKey: { type: String, trim: true, lowercase: true, required: true, index: true },
    serviceName: { type: String, trim: true, required: true, maxlength: 160 },
    serviceCategory: { type: String, trim: true, maxlength: 120, default: "" },
    price: { type: Number, min: 0, required: true },
    currency: { type: String, trim: true, uppercase: true, default: "INR" },
    deliveryDays: { type: Number, min: 0, default: 0 },
    deliveryLabel: { type: String, trim: true, maxlength: 120, default: "" },
    revisionCount: { type: Number, min: 0, default: 0 },
    minimumNoticePeriod: { type: Number, min: 0, default: 0 },
    contentApprovalRequired: { type: Boolean, default: false },
    brandApprovalRequired: { type: Boolean, default: false },
    description: { type: String, trim: true, maxlength: 1200, default: "" },
    status: { type: String, enum: SERVICE_STATUSES, default: "active", index: true },
    packages: { type: [influencerServicePackageSchema], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: "influencer_services",
  }
);

influencerServiceSchema.index({ influencerId: 1, status: 1, serviceTypeKey: 1 });
influencerServiceSchema.index({ influencerId: 1, serviceName: 1 });
influencerServiceSchema.index({ influencerId: 1, "packages.status": 1, "packages.price": 1 });

const influencerRequirementSchema = new mongoose.Schema(
  {
    influencerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InfluencerProfile",
      required: true,
      unique: true,
      index: true,
    },
    minimumBudget: { type: Number, min: 0, default: 0 },
    minimumAttributionDays: { type: Number, min: 0, default: 0 },
    productRequired: { type: Boolean, default: false },
    sampleRequired: { type: Boolean, default: false },
    productReturnRequired: { type: Boolean, default: false },
    shippingRequired: { type: Boolean, default: false },
    brandGuidelinesRequired: { type: Boolean, default: false },
    creativeApprovalRequired: { type: Boolean, default: false },
    contentApprovalRequired: { type: Boolean, default: false },
    approvalRequired: { type: Boolean, default: false },
    languages: { type: [String], default: [] },
    categories: { type: [String], default: [] },
    preferredCategories: { type: [String], default: [] },
    targetAudience: { type: String, trim: true, maxlength: 1200, default: "" },
    deliveryTime: { type: String, trim: true, maxlength: 160, default: "" },
    communicationPreferences: { type: String, trim: true, maxlength: 1200, default: "" },
    location: {
      country: { type: String, trim: true, default: "" },
      state: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
    },
    shippingAddress: { type: mongoose.Schema.Types.Mixed, default: {} },
    notes: { type: String, trim: true, maxlength: 2000, default: "" },
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: "influencer_requirements",
  }
);

const campaignPaymentModelSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      unique: true,
      index: true,
    },
    paymentType: { type: String, enum: PAYMENT_MODEL_TYPES, required: true, index: true },
    fixedFee: { type: Number, min: 0, default: 0 },
    commissionPercentage: { type: Number, min: 0, max: 100, default: 0 },
    attributionDays: { type: Number, min: 0, default: 0 },
    productValue: { type: Number, min: 0, default: 0 },
    shippingCost: { type: Number, min: 0, default: 0 },
    productCost: { type: Number, min: 0, default: 0 },
    taxes: { type: Number, min: 0, default: 0 },
    platformFees: { type: Number, min: 0, default: 0 },
    commissionReserve: { type: Number, min: 0, default: 0 },
    totalBudget: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, uppercase: true, default: "INR" },
    selectedServices: { type: [mongoose.Schema.Types.Mixed], default: [] },
    snapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["draft", "proposed", "locked", "cancelled"], default: "proposed", index: true },
    lockedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: "campaign_payment_models",
  }
);

const campaignServiceSnapshotSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", index: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerService", index: true },
    packageId: { type: mongoose.Schema.Types.ObjectId, index: true },
    serviceTypeKey: { type: String, trim: true, lowercase: true, default: "", index: true },
    serviceName: { type: String, trim: true, maxlength: 160, default: "" },
    packageName: { type: String, trim: true, maxlength: 160, default: "" },
    quantity: { type: Number, min: 1, default: 1 },
    packageQuantity: { type: Number, min: 1, default: 1 },
    price: { type: Number, min: 0, default: 0 },
    total: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, uppercase: true, default: "INR" },
    deliveryDays: { type: Number, min: 0, default: 0 },
    revisionCount: { type: Number, min: 0, default: 0 },
    snapshotJson: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["proposed", "locked", "cancelled"], default: "proposed", index: true },
    lockedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: "campaign_service_snapshots",
  }
);

campaignServiceSnapshotSchema.index({ campaignId: 1, serviceId: 1, packageId: 1 });

const campaignAttributionRuleSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      unique: true,
      index: true,
    },
    attributionDays: { type: Number, min: 0, default: 0 },
    trackingEnabled: { type: Boolean, default: true, index: true },
    startsOn: { type: Date },
    endsOn: { type: Date },
    source: { type: String, trim: true, maxlength: 120, default: "campaign_payment_model" },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "campaign_attribution_rules",
  }
);

module.exports = {
  RELATIONSHIP_STATUSES,
  SERVICE_STATUSES,
  PAYMENT_MODEL_TYPES,
  VendorInfluencerRelationship:
    mongoose.models.VendorInfluencerRelationship ||
    mongoose.model("VendorInfluencerRelationship", vendorInfluencerRelationshipSchema),
  InfluencerService:
    mongoose.models.InfluencerService ||
    mongoose.model("InfluencerService", influencerServiceSchema),
  InfluencerRequirement:
    mongoose.models.InfluencerRequirement ||
    mongoose.model("InfluencerRequirement", influencerRequirementSchema),
  CampaignPaymentModel:
    mongoose.models.CampaignPaymentModel ||
    mongoose.model("CampaignPaymentModel", campaignPaymentModelSchema),
  CampaignServiceSnapshot:
    mongoose.models.CampaignServiceSnapshot ||
    mongoose.model("CampaignServiceSnapshot", campaignServiceSnapshotSchema),
  CampaignAttributionRule:
    mongoose.models.CampaignAttributionRule ||
    mongoose.model("CampaignAttributionRule", campaignAttributionRuleSchema),
};
