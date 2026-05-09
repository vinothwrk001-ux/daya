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
      required: true,
      index: true,
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

module.exports = {
  Campaign: mongoose.models.Campaign || mongoose.model("Campaign", campaignSchema),
};
