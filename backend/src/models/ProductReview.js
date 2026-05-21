const mongoose = require("mongoose");

const REVIEW_STATUS = ["pending", "approved", "rejected", "hidden", "deleted"];
const REVIEW_RECOMMENDATION = ["yes", "no", null];

const reviewMediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, default: null },
    originalName: { type: String, trim: true, default: "" },
    mimeType: { type: String, trim: true, default: "" },
    size: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const moderationSignalsSchema = new mongoose.Schema(
  {
    spamScore: { type: Number, min: 0, max: 1, default: null },
    toxicityScore: { type: Number, min: 0, max: 1, default: null },
    duplicateScore: { type: Number, min: 0, max: 1, default: null },
    sentiment: { type: String, trim: true, default: "" },
    flags: { type: [String], default: [] },
    provider: { type: String, trim: true, default: "" },
    checkedAt: { type: Date, default: null },
  },
  { _id: false }
);

const productReviewSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5, index: true },
    title: { type: String, trim: true, maxlength: 160, default: "" },
    review: { type: String, trim: true, maxlength: 2000, default: "" },
    images: { type: [reviewMediaSchema], default: [] },
    videos: { type: [reviewMediaSchema], default: [] },
    wouldRecommend: {
      type: String,
      enum: REVIEW_RECOMMENDATION,
      default: null,
    },
    verifiedPurchase: { type: Boolean, default: true, index: true },
    status: { type: String, enum: REVIEW_STATUS, default: "pending", index: true },
    helpfulCount: { type: Number, min: 0, default: 0 },
    notHelpfulCount: { type: Number, min: 0, default: 0 },
    vendorReply: { type: String, trim: true, maxlength: 1200, default: null },
    vendorReplyDate: { type: Date, default: null },
    reportCount: { type: Number, min: 0, default: 0 },
    featured: { type: Boolean, default: false, index: true },
    moderationSignals: { type: moderationSignalsSchema, default: () => ({}) },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    moderatedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, maxlength: 500, default: "" },
  },
  {
    timestamps: true,
    collection: "product_reviews",
  }
);

productReviewSchema.index({ productId: 1, status: 1, createdAt: -1 });
productReviewSchema.index({ productId: 1, status: 1, rating: 1 });
productReviewSchema.index({ vendorId: 1, status: 1, createdAt: -1 });
productReviewSchema.index({ customerId: 1, createdAt: -1 });
productReviewSchema.index({ orderId: 1, productId: 1, customerId: 1 }, { unique: true });
productReviewSchema.index({ helpfulCount: -1, createdAt: -1 });

module.exports = {
  ProductReview: mongoose.models.ProductReview || mongoose.model("ProductReview", productReviewSchema),
  REVIEW_STATUS,
};
