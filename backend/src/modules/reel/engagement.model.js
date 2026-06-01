const mongoose = require("mongoose");

const objectId = { type: mongoose.Schema.Types.ObjectId };
const metadata = { type: mongoose.Schema.Types.Mixed, default: {} };

const reelLikeSchema = new mongoose.Schema({
  reelId: { ...objectId, ref: "Reel", required: true, index: true },
  userId: { ...objectId, ref: "User", required: true, index: true },
  influencerId: { ...objectId, ref: "InfluencerProfile", index: true },
}, { timestamps: true, collection: "reel_likes" });

const reelCommentSchema = new mongoose.Schema({
  reelId: { ...objectId, ref: "Reel", required: true, index: true },
  userId: { ...objectId, ref: "User", required: true, index: true },
  influencerId: { ...objectId, ref: "InfluencerProfile", index: true },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  mentions: { type: [String], default: [] },
  emojiReactions: { type: Map, of: Number, default: {} },
  likesCount: { type: Number, min: 0, default: 0 },
  repliesCount: { type: Number, min: 0, default: 0 },
  reportsCount: { type: Number, min: 0, default: 0 },
  likedBy: [{ ...objectId, ref: "User" }],
  reportedBy: [{ ...objectId, ref: "User" }],
  status: { type: String, enum: ["visible", "hidden", "reported", "deleted"], default: "visible", index: true },
}, { timestamps: true, collection: "reel_comments" });

const reelCommentReplySchema = new mongoose.Schema({
  reelId: { ...objectId, ref: "Reel", required: true, index: true },
  commentId: { ...objectId, ref: "ReelComment", required: true, index: true },
  parentReplyId: { ...objectId, ref: "ReelCommentReply", index: true },
  userId: { ...objectId, ref: "User", required: true, index: true },
  influencerId: { ...objectId, ref: "InfluencerProfile", index: true },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  mentions: { type: [String], default: [] },
  emojiReactions: { type: Map, of: Number, default: {} },
  likesCount: { type: Number, min: 0, default: 0 },
  reportsCount: { type: Number, min: 0, default: 0 },
  likedBy: [{ ...objectId, ref: "User" }],
  reportedBy: [{ ...objectId, ref: "User" }],
  status: { type: String, enum: ["visible", "hidden", "reported", "deleted"], default: "visible", index: true },
}, { timestamps: true, collection: "reel_comment_replies" });

const reelShareSchema = new mongoose.Schema({
  reelId: { ...objectId, ref: "Reel", required: true, index: true },
  userId: { ...objectId, ref: "User", index: true, default: null },
  anonymousId: { type: String, trim: true, index: true, default: "" },
  influencerId: { ...objectId, ref: "InfluencerProfile", index: true },
  source: { type: String, trim: true, default: "reel" },
  destination: { type: String, trim: true, lowercase: true, default: "copy_link", index: true },
  metadata,
}, { timestamps: true, collection: "reel_shares" });

const reelSaveSchema = new mongoose.Schema({
  reelId: { ...objectId, ref: "Reel", required: true, index: true },
  userId: { ...objectId, ref: "User", required: true, index: true },
  influencerId: { ...objectId, ref: "InfluencerProfile", index: true },
  collectionName: { type: String, trim: true, maxlength: 120, default: "Saved reels" },
}, { timestamps: true, collection: "reel_saves" });

const reelViewSchema = new mongoose.Schema({
  reelId: { ...objectId, ref: "Reel", required: true, index: true },
  userId: { ...objectId, ref: "User", index: true, default: null },
  anonymousId: { type: String, trim: true, index: true, default: "" },
  influencerId: { ...objectId, ref: "InfluencerProfile", index: true },
  source: { type: String, trim: true, default: "feed" },
  watchTimeSeconds: { type: Number, min: 0, default: 0 },
  completed: { type: Boolean, default: false },
  metadata,
}, { timestamps: true, collection: "reel_views" });

const reelWatchHistorySchema = new mongoose.Schema({
  reelId: { ...objectId, ref: "Reel", required: true, index: true },
  userId: { ...objectId, ref: "User", index: true, default: null },
  anonymousId: { type: String, trim: true, index: true, default: "" },
  influencerId: { ...objectId, ref: "InfluencerProfile", index: true },
  lastWatchedAt: { type: Date, default: Date.now, index: true },
  watchTimeSeconds: { type: Number, min: 0, default: 0 },
  progressPercent: { type: Number, min: 0, max: 100, default: 0 },
  metadata,
}, { timestamps: true, collection: "reel_watch_history" });

const reelProductClickSchema = new mongoose.Schema({
  reelId: { ...objectId, ref: "Reel", required: true, index: true },
  productId: { ...objectId, ref: "Product", required: true, index: true },
  campaignId: { ...objectId, ref: "Campaign", index: true },
  influencerId: { ...objectId, ref: "InfluencerProfile", required: true, index: true },
  userId: { ...objectId, ref: "User", index: true, default: null },
  anonymousId: { type: String, trim: true, index: true, default: "" },
  source: { type: String, trim: true, default: "reel_product_card" },
  trackingTokenId: { type: String, trim: true, index: true, default: "" },
  attributionWindowDays: { type: Number, enum: [7, 30, 60, 90], default: 30 },
  metadata,
}, { timestamps: true, collection: "reel_product_clicks" });

const reelStoreVisitSchema = new mongoose.Schema({
  reelId: { ...objectId, ref: "Reel", required: true, index: true },
  influencerId: { ...objectId, ref: "InfluencerProfile", required: true, index: true },
  userId: { ...objectId, ref: "User", index: true, default: null },
  anonymousId: { type: String, trim: true, index: true, default: "" },
  source: { type: String, trim: true, default: "reel_creator_panel" },
  metadata,
}, { timestamps: true, collection: "reel_store_visits" });

const creatorFollowSchema = new mongoose.Schema({
  influencerId: { ...objectId, ref: "InfluencerProfile", required: true, index: true },
  customerId: { ...objectId, ref: "User", required: true, index: true },
  source: { type: String, trim: true, default: "reel" },
  status: { type: String, enum: ["active", "unfollowed"], default: "active", index: true },
  followedAt: { type: Date, default: Date.now, index: true },
  unfollowedAt: { type: Date },
}, { timestamps: true, collection: "creator_follows" });

const creatorFollowerSchema = new mongoose.Schema({
  influencerId: { ...objectId, ref: "InfluencerProfile", required: true, index: true },
  customerId: { ...objectId, ref: "User", required: true, index: true },
  source: { type: String, trim: true, default: "reel" },
  notificationEnabled: { type: Boolean, default: true },
  followedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true, collection: "creator_followers" });

const affiliateClickSchema = new mongoose.Schema({
  reelId: { ...objectId, ref: "Reel", index: true },
  productId: { ...objectId, ref: "Product", required: true, index: true },
  campaignId: { ...objectId, ref: "Campaign", index: true },
  influencerId: { ...objectId, ref: "InfluencerProfile", required: true, index: true },
  userId: { ...objectId, ref: "User", index: true, default: null },
  anonymousId: { type: String, trim: true, index: true, default: "" },
  trackingTokenId: { type: String, trim: true, index: true, default: "" },
  sourceType: { type: String, trim: true, default: "reel" },
  source: { type: String, trim: true, default: "product_click" },
  attributionWindowDays: { type: Number, enum: [7, 30, 60, 90], default: 30 },
  metadata,
}, { timestamps: true, collection: "affiliate_clicks" });

const affiliateAttributionSchema = new mongoose.Schema({
  affiliateClickId: { ...objectId, ref: "AffiliateClick", index: true },
  influencerId: { ...objectId, ref: "InfluencerProfile", required: true, index: true },
  productId: { ...objectId, ref: "Product", required: true, index: true },
  campaignId: { ...objectId, ref: "Campaign", index: true },
  userId: { ...objectId, ref: "User", index: true, default: null },
  anonymousId: { type: String, trim: true, index: true, default: "" },
  orderId: { ...objectId, ref: "Order", index: true },
  status: { type: String, enum: ["pending", "converted", "expired", "reversed"], default: "pending", index: true },
  expiresAt: { type: Date, required: true, index: true },
  metadata,
}, { timestamps: true, collection: "affiliate_attributions" });

const commerceEventSchema = new mongoose.Schema({
  eventType: { type: String, required: true, trim: true, index: true },
  reelId: { ...objectId, ref: "Reel", index: true },
  productId: { ...objectId, ref: "Product", index: true },
  campaignId: { ...objectId, ref: "Campaign", index: true },
  influencerId: { ...objectId, ref: "InfluencerProfile", index: true },
  userId: { ...objectId, ref: "User", index: true, default: null },
  anonymousId: { type: String, trim: true, index: true, default: "" },
  source: { type: String, trim: true, default: "reel" },
  value: { type: Number, default: 0 },
  metadata,
}, { timestamps: true, collection: "commerce_events" });

function analyticsSchema(collection) {
  return new mongoose.Schema({
    reelId: { ...objectId, ref: "Reel", index: true },
    productId: { ...objectId, ref: "Product", index: true },
    campaignId: { ...objectId, ref: "Campaign", index: true },
    influencerId: { ...objectId, ref: "InfluencerProfile", index: true },
    date: { type: String, required: true, index: true },
    metrics: {
      views: { type: Number, min: 0, default: 0 },
      likes: { type: Number, min: 0, default: 0 },
      comments: { type: Number, min: 0, default: 0 },
      replies: { type: Number, min: 0, default: 0 },
      shares: { type: Number, min: 0, default: 0 },
      saves: { type: Number, min: 0, default: 0 },
      follows: { type: Number, min: 0, default: 0 },
      storeVisits: { type: Number, min: 0, default: 0 },
      productClicks: { type: Number, min: 0, default: 0 },
      watchTimeSeconds: { type: Number, min: 0, default: 0 },
      revenue: { type: Number, min: 0, default: 0 },
      commission: { type: Number, min: 0, default: 0 },
    },
    metadata,
  }, { timestamps: true, collection });
}

reelLikeSchema.index({ reelId: 1, userId: 1 }, { unique: true });
reelSaveSchema.index({ reelId: 1, userId: 1 }, { unique: true });
creatorFollowSchema.index({ influencerId: 1, customerId: 1 }, { unique: true });
creatorFollowerSchema.index({ influencerId: 1, customerId: 1 }, { unique: true });

module.exports = {
  ReelLike: mongoose.models.ReelLike || mongoose.model("ReelLike", reelLikeSchema),
  ReelComment: mongoose.models.ReelComment || mongoose.model("ReelComment", reelCommentSchema),
  ReelCommentReply: mongoose.models.ReelCommentReply || mongoose.model("ReelCommentReply", reelCommentReplySchema),
  ReelShare: mongoose.models.ReelShare || mongoose.model("ReelShare", reelShareSchema),
  ReelSave: mongoose.models.ReelSave || mongoose.model("ReelSave", reelSaveSchema),
  ReelView: mongoose.models.ReelView || mongoose.model("ReelView", reelViewSchema),
  ReelWatchHistory: mongoose.models.ReelWatchHistory || mongoose.model("ReelWatchHistory", reelWatchHistorySchema),
  ReelProductClick: mongoose.models.ReelProductClick || mongoose.model("ReelProductClick", reelProductClickSchema),
  ReelStoreVisit: mongoose.models.ReelStoreVisit || mongoose.model("ReelStoreVisit", reelStoreVisitSchema),
  CreatorFollow: mongoose.models.CreatorFollow || mongoose.model("CreatorFollow", creatorFollowSchema),
  CreatorFollower: mongoose.models.CreatorFollower || mongoose.model("CreatorFollower", creatorFollowerSchema),
  AffiliateClick: mongoose.models.AffiliateClick || mongoose.model("AffiliateClick", affiliateClickSchema),
  AffiliateAttribution: mongoose.models.AffiliateAttribution || mongoose.model("AffiliateAttribution", affiliateAttributionSchema),
  CommerceEvent: mongoose.models.CommerceEvent || mongoose.model("CommerceEvent", commerceEventSchema),
  EngagementAnalytics: mongoose.models.EngagementAnalytics || mongoose.model("EngagementAnalytics", analyticsSchema("engagement_analytics")),
  CreatorAnalytics: mongoose.models.CreatorAnalytics || mongoose.model("CreatorAnalytics", analyticsSchema("creator_analytics")),
  CampaignAnalytics: mongoose.models.CampaignAnalytics || mongoose.model("CampaignAnalytics", analyticsSchema("campaign_analytics")),
  ProductEngagementAnalytics: mongoose.models.ProductEngagementAnalytics || mongoose.model("ProductEngagementAnalytics", analyticsSchema("product_analytics")),
};
