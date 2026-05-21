const mongoose = require("mongoose");

const productReviewSummarySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
      index: true,
    },
    averageRating: { type: Number, min: 0, max: 5, default: 0 },
    totalRatings: { type: Number, min: 0, default: 0 },
    totalReviews: { type: Number, min: 0, default: 0 },
    ratingBreakdown: {
      5: { type: Number, min: 0, default: 0 },
      4: { type: Number, min: 0, default: 0 },
      3: { type: Number, min: 0, default: 0 },
      2: { type: Number, min: 0, default: 0 },
      1: { type: Number, min: 0, default: 0 },
    },
    refreshedAt: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: true,
    collection: "product_review_summaries",
  }
);

module.exports = {
  ProductReviewSummary:
    mongoose.models.ProductReviewSummary || mongoose.model("ProductReviewSummary", productReviewSummarySchema),
};
