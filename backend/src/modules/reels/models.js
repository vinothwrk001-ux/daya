const mongoose = require("mongoose");

const reelSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    videoUrl: { type: String, required: true },
    thumbnailUrl: { type: String, default: "" },
    cloudinaryPublicId: { type: String, default: "" },
    category: { type: String, trim: true, default: "" },
    tags: [{ type: String, trim: true }],
    musicName: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    visibility: {
      type: String,
      enum: ["public", "private", "unlisted"],
      default: "public",
    },
    attributionWindowDays: { type: Number, default: 30, min: 1, max: 365 },
    publishDate: { type: Date },
    associatedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    viewsCount: { type: Number, default: 0, min: 0 },
    uniqueViewsCount: { type: Number, default: 0, min: 0 },
    likesCount: { type: Number, default: 0, min: 0 },
    commentsCount: { type: Number, default: 0, min: 0 },
    sharesCount: { type: Number, default: 0, min: 0 },
    savesCount: { type: Number, default: 0, min: 0 },
    productClicksCount: { type: Number, default: 0, min: 0 },
    productViewsCount: { type: Number, default: 0, min: 0 },
    addToCartCount: { type: Number, default: 0, min: 0 },
    ordersCount: { type: Number, default: 0, min: 0 },
    revenueTotal: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, collection: "reels" }
);

reelSchema.index({ status: 1, visibility: 1, publishDate: -1, createdAt: -1 });
reelSchema.index({ tags: 1 });
reelSchema.index({ category: 1 });
reelSchema.index({ likesCount: -1 });
reelSchema.index({ viewsCount: -1 });

const reelLikeSchema = new mongoose.Schema(
  {
    reelId: { type: mongoose.Schema.Types.ObjectId, ref: "Reel", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "reel_likes" }
);
reelLikeSchema.index({ reelId: 1, userId: 1 }, { unique: true });

const reelCommentSchema = new mongoose.Schema(
  {
    reelId: { type: mongoose.Schema.Types.ObjectId, ref: "Reel", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    comment: { type: String, required: true, trim: true, maxlength: 1000 },
    parentCommentId: { type: mongoose.Schema.Types.ObjectId, ref: "ReelComment", default: null },
    isDeleted: { type: Boolean, default: false },
    moderatedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "reel_comments" }
);
reelCommentSchema.index({ reelId: 1, createdAt: -1 });
reelCommentSchema.index({ parentCommentId: 1 });

const reelReplySchema = new mongoose.Schema(
  {
    reelId: { type: mongoose.Schema.Types.ObjectId, ref: "Reel", required: true, index: true },
    commentId: { type: mongoose.Schema.Types.ObjectId, ref: "ReelComment", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reply: { type: String, required: true, trim: true, maxlength: 1000 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "reel_replies" }
);
reelReplySchema.index({ commentId: 1, createdAt: 1 });

const reelSaveSchema = new mongoose.Schema(
  {
    reelId: { type: mongoose.Schema.Types.ObjectId, ref: "Reel", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "reel_saves" }
);
reelSaveSchema.index({ reelId: 1, userId: 1 }, { unique: true });

const reelShareSchema = new mongoose.Schema(
  {
    reelId: { type: mongoose.Schema.Types.ObjectId, ref: "Reel", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    platform: {
      type: String,
      enum: ["whatsapp", "facebook", "instagram", "twitter", "telegram", "copy_link", "other"],
      default: "other",
    },
    sessionId: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "reel_shares" }
);
reelShareSchema.index({ reelId: 1, createdAt: -1 });

const reelViewSchema = new mongoose.Schema(
  {
    reelId: { type: mongoose.Schema.Types.ObjectId, ref: "Reel", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sessionId: { type: String, required: true, index: true },
    viewDuration: { type: Number, default: 0, min: 0 },
    videoDuration: { type: Number, default: 0, min: 0 },
    completionPercent: { type: Number, default: 0, min: 0, max: 100 },
    qualified: { type: Boolean, default: false },
    ipHash: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "reel_views" }
);
reelViewSchema.index({ reelId: 1, sessionId: 1 }, { unique: true });

const reelProductClickSchema = new mongoose.Schema(
  {
    reelId: { type: mongoose.Schema.Types.ObjectId, ref: "Reel", required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sessionId: { type: String, required: true, index: true },
    clickedAt: { type: Date, default: Date.now },
  },
  { collection: "reel_product_clicks" }
);
reelProductClickSchema.index({ reelId: 1, productId: 1, sessionId: 1, clickedAt: -1 });

const reelProductViewSchema = new mongoose.Schema(
  {
    reelId: { type: mongoose.Schema.Types.ObjectId, ref: "Reel", required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sessionId: { type: String, required: true, index: true },
    viewedAt: { type: Date, default: Date.now },
  },
  { collection: "reel_product_views" }
);
reelProductViewSchema.index({ reelId: 1, productId: 1, sessionId: 1 }, { unique: true });

const reelAttributionSchema = new mongoose.Schema(
  {
    reelId: { type: mongoose.Schema.Types.ObjectId, ref: "Reel", required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sessionId: { type: String, required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    revenue: { type: Number, default: 0, min: 0 },
    addToCartAt: { type: Date },
    attributed: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "reel_attributions" }
);
reelAttributionSchema.index({ reelId: 1, orderId: 1 });
reelAttributionSchema.index({ sessionId: 1, productId: 1 });

const reelPurchaseConversionSchema = new mongoose.Schema(
  {
    reelId: { type: mongoose.Schema.Types.ObjectId, ref: "Reel", required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    sessionId: { type: String, default: "" },
    revenue: { type: Number, default: 0, min: 0 },
    commission: { type: Number, default: 0, min: 0 },
    attributedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "reel_purchase_conversions" }
);
reelPurchaseConversionSchema.index({ reelId: 1, orderId: 1 });

module.exports = {
  Reel: mongoose.model("Reel", reelSchema),
  ReelLike: mongoose.model("ReelLike", reelLikeSchema),
  ReelComment: mongoose.model("ReelComment", reelCommentSchema),
  ReelReply: mongoose.model("ReelReply", reelReplySchema),
  ReelSave: mongoose.model("ReelSave", reelSaveSchema),
  ReelShare: mongoose.model("ReelShare", reelShareSchema),
  ReelView: mongoose.model("ReelView", reelViewSchema),
  ReelProductClick: mongoose.model("ReelProductClick", reelProductClickSchema),
  ReelProductView: mongoose.model("ReelProductView", reelProductViewSchema),
  ReelAttribution: mongoose.model("ReelAttribution", reelAttributionSchema),
  ReelPurchaseConversion: mongoose.model("ReelPurchaseConversion", reelPurchaseConversionSchema),
};
