const mongoose = require("mongoose");
const { INFLUENCER_CATEGORIES, INFLUENCER_STATES } = require("../shared/constants");

const influencerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    categories: {
      type: [{ type: String, enum: INFLUENCER_CATEGORIES }],
      default: [],
    },
    state: {
      type: String,
      enum: INFLUENCER_STATES,
      default: "draft",
      index: true,
    },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    followers: { type: Number, min: 0, default: 0 },
    verified: { type: Boolean, default: false, index: true },
    bio: { type: String, trim: true, maxlength: 1200, default: "" },
    socialHandles: {
      instagram: { type: String, trim: true, default: "" },
      youtube: { type: String, trim: true, default: "" },
      website: { type: String, trim: true, default: "" },
    },
    stats: {
      views: { type: Number, min: 0, default: 0 },
      clicks: { type: Number, min: 0, default: 0 },
      sales: { type: Number, min: 0, default: 0 },
      revenue: { type: Number, min: 0, default: 0 },
    },
    moderation: {
      submittedAt: { type: Date },
      verifiedAt: { type: Date },
      suspendedAt: { type: Date },
      notes: { type: String, trim: true, default: "" },
    },
  },
  {
    timestamps: true,
    collection: "influencer_profiles",
  }
);

influencerProfileSchema.index({ state: 1, verified: 1, followers: -1 });
influencerProfileSchema.index({ categories: 1, rating: -1 });

module.exports = {
  InfluencerProfile:
    mongoose.models.InfluencerProfile ||
    mongoose.model("InfluencerProfile", influencerProfileSchema),
};
