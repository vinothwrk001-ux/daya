const mongoose = require("mongoose");

const homepageBannerAnalyticsSchema = new mongoose.Schema(
  {
    bannerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HomepageBanner",
      required: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    eventType: {
      type: String,
      enum: ["view", "click", "category_click", "conversion"],
      required: true,
      index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sessionId: { type: String, default: "", index: true },
    revenue: { type: Number, default: 0, min: 0 },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "homepage_banner_analytics" }
);

homepageBannerAnalyticsSchema.index({ bannerId: 1, eventType: 1, createdAt: -1 });

module.exports = {
  HomepageBannerAnalytics:
    mongoose.models.HomepageBannerAnalytics ||
    mongoose.model("HomepageBannerAnalytics", homepageBannerAnalyticsSchema),
};
