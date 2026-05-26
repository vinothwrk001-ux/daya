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
    title: { type: String, trim: true, maxlength: 160, default: "" },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    thumbnailUrl: { type: String, trim: true, default: "" },
    contentType: {
      type: String,
      enum: ["product_video", "review", "tutorial", "unboxing", "lifestyle", "campaign", "affiliate", "brand_collaboration", "short", "reel", "live"],
      default: "reel",
      index: true,
    },
    category: { type: String, trim: true, default: "", index: true },
    tags: { type: [String], default: [] },
    language: { type: String, trim: true, default: "en" },
    collectionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "InfluencerCollection" }],
    brand: { type: String, trim: true, default: "" },
    visibility: { type: String, enum: ["draft", "scheduled", "published", "private", "unlisted", "archived"], default: "draft", index: true },
    scheduledAt: { type: Date, index: true },
    durationSeconds: { type: Number, min: 0, default: 0 },
    processing: {
      status: { type: String, enum: ["pending", "processing", "ready", "failed"], default: "ready", index: true },
      resolutions: { type: [String], default: [] },
      cdnUrl: { type: String, trim: true, default: "" },
      error: { type: String, trim: true, default: "" },
    },
    live: {
      status: { type: String, enum: ["draft", "scheduled", "live", "ended", "cancelled"], default: "draft", index: true },
      startedAt: { type: Date },
      endedAt: { type: Date },
      viewers: { type: Number, min: 0, default: 0 },
      peakViewers: { type: Number, min: 0, default: 0 },
      replayUrl: { type: String, trim: true, default: "" },
      pinnedProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
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
      uniqueViews: { type: Number, min: 0, default: 0 },
      clicks: { type: Number, min: 0, default: 0 },
      orders: { type: Number, min: 0, default: 0 },
      watchTimeSeconds: { type: Number, min: 0, default: 0 },
      averageViewDuration: { type: Number, min: 0, default: 0 },
      likes: { type: Number, min: 0, default: 0 },
      comments: { type: Number, min: 0, default: 0 },
      shares: { type: Number, min: 0, default: 0 },
      bookmarks: { type: Number, min: 0, default: 0 },
      revenue: { type: Number, min: 0, default: 0 },
      commission: { type: Number, min: 0, default: 0 },
    },
    seo: {
      metaTitle: { type: String, trim: true, maxlength: 160, default: "" },
      metaDescription: { type: String, trim: true, maxlength: 300, default: "" },
      keywords: { type: [String], default: [] },
      openGraphImage: { type: String, trim: true, default: "" },
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
reelSchema.index({ influencerId: 1, contentType: 1, createdAt: -1 });
reelSchema.index({ influencerId: 1, visibility: 1, scheduledAt: 1 });

module.exports = {
  Reel: mongoose.models.Reel || mongoose.model("Reel", reelSchema),
};
