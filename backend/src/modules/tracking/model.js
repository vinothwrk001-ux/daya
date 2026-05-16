const mongoose = require("mongoose");

const trackingSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    anonymousId: {
      type: String,
      trim: true,
      index: true,
      default: null,
    },
    reelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reel",
      required: true,
      index: true,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    influencerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InfluencerProfile",
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    trackingTokenId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "tracking_sessions",
  }
);

trackingSessionSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    name: "tracking_session_ttl",
  }
);
trackingSessionSchema.index(
  { userId: 1, productId: 1, createdAt: -1 },
  { name: "tracking_session_user_product_created_at" }
);
trackingSessionSchema.index(
  { anonymousId: 1, productId: 1, createdAt: -1 },
  { name: "tracking_session_anonymous_product_created_at" }
);

module.exports = {
  TrackingSession:
    mongoose.models.TrackingSession ||
    mongoose.model("TrackingSession", trackingSessionSchema),
};
