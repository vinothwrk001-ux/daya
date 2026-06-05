const mongoose = require("mongoose");

const RELATIONSHIP_STATUSES = ["viewed", "saved", "invited", "applied", "approved", "active", "paused", "blacklisted"];

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

module.exports = {
  RELATIONSHIP_STATUSES,
  VendorInfluencerRelationship:
    mongoose.models.VendorInfluencerRelationship ||
    mongoose.model("VendorInfluencerRelationship", vendorInfluencerRelationshipSchema),
};
