const mongoose = require("mongoose");
const { REEL_STATES } = require("../shared/constants");

const reelSchema = new mongoose.Schema(
  {
    influencerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InfluencerProfile",
      required: true,
      index: true,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    productIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
      default: [],
    },
    videoUrl: {
      type: String,
      required: true,
      trim: true,
    },
    caption: { type: String, trim: true, maxlength: 1000, default: "" },
    state: {
      type: String,
      enum: REEL_STATES,
      default: "uploaded",
      index: true,
    },
    publishedAt: { type: Date, index: true },
    metrics: {
      views: { type: Number, min: 0, default: 0 },
      clicks: { type: Number, min: 0, default: 0 },
      orders: { type: Number, min: 0, default: 0 },
    },
    moderation: {
      reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      notes: { type: String, trim: true, default: "" },
      reviewedAt: { type: Date },
    },
  },
  {
    timestamps: true,
    collection: "reels",
  }
);

reelSchema.index({ state: 1, publishedAt: -1 });
reelSchema.index({ influencerId: 1, createdAt: -1 });

module.exports = {
  Reel: mongoose.models.Reel || mongoose.model("Reel", reelSchema),
};
