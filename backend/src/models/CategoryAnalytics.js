const mongoose = require("mongoose");

const categoryAnalyticsSchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: ["view", "click", "product_view", "add_to_cart", "order"],
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    sessionId: { type: String, default: "", index: true },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    revenue: { type: Number, default: 0, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "category_analytics" }
);

categoryAnalyticsSchema.index({ categoryId: 1, eventType: 1, createdAt: -1 });

module.exports = {
  CategoryAnalytics: mongoose.model("CategoryAnalytics", categoryAnalyticsSchema),
};
