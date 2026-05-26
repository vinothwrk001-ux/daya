const mongoose = require("mongoose");
const { CAMPAIGN_STATES } = require("../shared/constants");

const campaignSchema = new mongoose.Schema(
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
      index: true,
    },
    title: { type: String, trim: true, maxlength: 180, default: "" },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    banner: { type: String, trim: true, default: "" },
    campaignType: {
      type: String,
      enum: ["affiliate", "sponsored", "product_review", "ugc", "video", "live_commerce", "brand_ambassador", "custom"],
      default: "affiliate",
      index: true,
    },
    category: { type: String, trim: true, default: "", index: true },
    country: { type: String, trim: true, default: "" },
    language: { type: String, trim: true, default: "en" },
    marketplace: {
      public: { type: Boolean, default: false, index: true },
      applicationDeadline: { type: Date, index: true },
      availableSlots: { type: Number, min: 0, default: 1 },
      requiredDeliverables: { type: [String], default: [] },
      requirements: { type: mongoose.Schema.Types.Mixed, default: {} },
      assets: { type: [mongoose.Schema.Types.Mixed], default: [] },
      savedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile" }],
    },
    applications: {
      type: [{
        influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", index: true },
        status: { type: String, enum: ["draft", "submitted", "pending_review", "shortlisted", "approved", "rejected", "withdrawn"], default: "submitted", index: true },
        profileSummary: { type: String, trim: true, default: "" },
        audienceStats: { type: mongoose.Schema.Types.Mixed, default: {} },
        portfolio: { type: String, trim: true, default: "" },
        attachments: { type: [mongoose.Schema.Types.Mixed], default: [] },
        expectedEarnings: { type: Number, min: 0, default: 0 },
        submittedAt: { type: Date, default: Date.now },
        reviewedAt: { type: Date },
      }],
      default: [],
    },
    deliverables: {
      type: [{
        influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", index: true },
        type: { type: String, trim: true, default: "video" },
        title: { type: String, trim: true, default: "" },
        dueDate: { type: Date },
        contentId: { type: mongoose.Schema.Types.ObjectId, ref: "Reel" },
        status: { type: String, enum: ["draft", "submitted", "under_review", "approved", "rejected"], default: "draft" },
        notes: { type: String, trim: true, default: "" },
        submittedAt: { type: Date },
      }],
      default: [],
    },
    analytics: {
      views: { type: Number, min: 0, default: 0 },
      clicks: { type: Number, min: 0, default: 0 },
      orders: { type: Number, min: 0, default: 0 },
      revenue: { type: Number, min: 0, default: 0 },
      commission: { type: Number, min: 0, default: 0 },
      engagement: { type: Number, min: 0, default: 0 },
    },
    productIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "Campaign requires at least one product",
      },
    },
    commissionPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 50,
    },
    fixedFee: {
      type: Number,
      min: 0,
      default: 0,
    },
    deadline: { type: Date },
    state: {
      type: String,
      enum: CAMPAIGN_STATES,
      default: "draft",
      index: true,
    },
    termsFrozen: {
      commissionPercent: { type: Number, min: 0, max: 50 },
      fixedFee: { type: Number, min: 0 },
      productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
      deadline: { type: Date },
      frozenAt: { type: Date },
    },
    history: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "campaigns",
  }
);

campaignSchema.index({ vendorId: 1, state: 1, createdAt: -1 });
campaignSchema.index({ influencerId: 1, state: 1, createdAt: -1 });
campaignSchema.index({ "marketplace.public": 1, state: 1, createdAt: -1 });
campaignSchema.index({ "applications.influencerId": 1, "applications.status": 1 });

module.exports = {
  Campaign: mongoose.models.Campaign || mongoose.model("Campaign", campaignSchema),
};
