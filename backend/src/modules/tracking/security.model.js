const mongoose = require("mongoose");

const baseEventFields = {
  eventType: { type: String, required: true, index: true },
  status: { type: String, enum: ["verified", "duplicate", "rate_limited", "fraud"], required: true, index: true },
  visitorId: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, default: null },
  anonymousId: { type: String, trim: true, index: true, default: "" },
  ipHash: { type: String, index: true, default: "" },
  userAgentHash: { type: String, index: true, default: "" },
  deviceFingerprint: { type: String, index: true, default: "" },
  sessionFingerprint: { type: String, index: true, default: "" },
  trackingTokenId: { type: String, index: true, default: "" },
  dedupKey: { type: String, index: true, default: "" },
  reelId: { type: mongoose.Schema.Types.ObjectId, ref: "Reel", index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", index: true },
  storefrontId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerStorefront", index: true },
  collectionId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerCollection", index: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerPost", index: true },
  influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", index: true },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", index: true },
  fraudScore: { type: Number, min: 0, max: 100, default: 0, index: true },
  fraudLevel: { type: String, enum: ["low", "medium", "high", "critical"], default: "low", index: true },
  reason: { type: String, trim: true, default: "" },
  source: { type: String, trim: true, default: "" },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  expiresAt: { type: Date, required: true, index: true },
};

const trackingEventSchema = new mongoose.Schema(baseEventFields, {
  timestamps: true,
  collection: "tracking_events",
});

const verifiedEventSchema = new mongoose.Schema(baseEventFields, {
  timestamps: true,
  collection: "verified_events",
});

const fraudEventSchema = new mongoose.Schema(baseEventFields, {
  timestamps: true,
  collection: "fraud_events",
});

const dedupEventSchema = new mongoose.Schema(
  {
    dedupKey: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true, index: true },
    visitorId: { type: String, required: true, index: true },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    duplicateCount: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true, collection: "dedup_events" }
);

const visitorProfileSchema = new mongoose.Schema(
  {
    visitorId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, default: null },
    anonymousId: { type: String, trim: true, index: true, default: "" },
    ipHash: { type: String, index: true, default: "" },
    userAgentHash: { type: String, index: true, default: "" },
    deviceFingerprint: { type: String, index: true, default: "" },
    sessionFingerprint: { type: String, index: true, default: "" },
    eventCount: { type: Number, default: 0, min: 0 },
    fraudScore: { type: Number, min: 0, max: 100, default: 0 },
    lastSeenAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: "visitor_profiles" }
);

for (const schema of [trackingEventSchema, verifiedEventSchema, fraudEventSchema, dedupEventSchema]) {
  schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}

trackingEventSchema.index({ eventType: 1, visitorId: 1, createdAt: -1 });
trackingEventSchema.index({ eventType: 1, ipHash: 1, createdAt: -1 });
trackingEventSchema.index({ status: 1, fraudScore: -1, createdAt: -1 });
verifiedEventSchema.index({ eventType: 1, visitorId: 1, createdAt: -1 });
fraudEventSchema.index({ eventType: 1, fraudScore: -1, createdAt: -1 });

module.exports = {
  TrackingEvent:
    mongoose.models.TrackingEvent ||
    mongoose.model("TrackingEvent", trackingEventSchema),
  VerifiedEvent:
    mongoose.models.VerifiedEvent ||
    mongoose.model("VerifiedEvent", verifiedEventSchema),
  FraudEvent:
    mongoose.models.FraudEvent ||
    mongoose.model("FraudEvent", fraudEventSchema),
  DedupEvent:
    mongoose.models.DedupEvent ||
    mongoose.model("DedupEvent", dedupEventSchema),
  VisitorProfile:
    mongoose.models.VisitorProfile ||
    mongoose.model("VisitorProfile", visitorProfileSchema),
};
