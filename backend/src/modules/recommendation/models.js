const mongoose = require("mongoose");

const recommendationWeightSchema = new mongoose.Schema(
  {
    category: { type: Number, default: 40, min: 0, max: 100 },
    brand: { type: Number, default: 25, min: 0, max: 100 },
    attribute: { type: Number, default: 10, min: 0, max: 100 },
    price: { type: Number, default: 15, min: 0, max: 100 },
    sales: { type: Number, default: 5, min: 0, max: 100 },
    rating: { type: Number, default: 5, min: 0, max: 100 },
  },
  { _id: false }
);

const metricWeightSchema = new mongoose.Schema(
  {
    sales: { type: Number, default: 25, min: 0, max: 100 },
    views: { type: Number, default: 20, min: 0, max: 100 },
    wishlist: { type: Number, default: 15, min: 0, max: 100 },
    cartAdds: { type: Number, default: 10, min: 0, max: 100 },
    conversionRate: { type: Number, default: 15, min: 0, max: 100 },
    reviewCount: { type: Number, default: 5, min: 0, max: 100 },
    rating: { type: Number, default: 10, min: 0, max: 100 },
  },
  { _id: false }
);

const bundleWeightSchema = new mongoose.Schema(
  {
    frequency: { type: Number, default: 50, min: 0, max: 100 },
    conversionRate: { type: Number, default: 20, min: 0, max: 100 },
    revenueImpact: { type: Number, default: 15, min: 0, max: 100 },
    rating: { type: Number, default: 15, min: 0, max: 100 },
  },
  { _id: false }
);

const recommendationSettingsSchema = new mongoose.Schema(
  {
    singletonKey: { type: String, required: true, unique: true, default: "default" },
    enabled: {
      related: { type: Boolean, default: true },
      frequentlyBoughtTogether: { type: Boolean, default: true },
      crossSell: { type: Boolean, default: true },
      upsell: { type: Boolean, default: true },
      recentlyViewed: { type: Boolean, default: true },
      trending: { type: Boolean, default: true },
      personalized: { type: Boolean, default: true },
      similar: { type: Boolean, default: true },
    },
    weights: { type: recommendationWeightSchema, default: () => ({}) },
    matchingRules: {
      category: { type: Boolean, default: true },
      brand: { type: Boolean, default: true },
      attribute: { type: Boolean, default: true },
      price: { type: Boolean, default: true },
      inventory: { type: Boolean, default: true },
      vendor: { type: Boolean, default: false },
      rating: { type: Boolean, default: true },
      popularity: { type: Boolean, default: true },
      newArrival: { type: Boolean, default: false },
      discount: { type: Boolean, default: false },
    },
    priceSimilarity: {
      mode: { type: String, default: "PERCENT", enum: ["PERCENT", "ABSOLUTE"] },
      rangeValue: { type: Number, default: 20, min: 0 },
    },
    attributeKeys: {
      type: [String],
      default: ["color", "size", "storage", "capacity", "material", "gender", "model"],
    },
    popularityWeights: { type: metricWeightSchema, default: () => ({}) },
    trendingWeights: { type: metricWeightSchema, default: () => ({}) },
    bundleRules: {
      minFrequency: { type: Number, default: 2, min: 1 },
      minConversionRate: { type: Number, default: 0, min: 0 },
      maxBundleSize: { type: Number, default: 3, min: 2, max: 10 },
      displayCount: { type: Number, default: 3, min: 1, max: 20 },
      bundlePriority: { type: String, default: "AUTO", enum: ["AUTO", "REVENUE", "CONVERSION", "FREQUENCY"] },
    },
    bundleWeights: { type: bundleWeightSchema, default: () => ({}) },
    upsellRules: {
      minUpgradePercent: { type: Number, default: 5, min: 0 },
      maxUpgradePercent: { type: Number, default: 35, min: 0 },
      requireBrandMatch: { type: Boolean, default: false },
      requireCategoryMatch: { type: Boolean, default: true },
      requireInventory: { type: Boolean, default: true },
    },
    limits: {
      related: { type: Number, default: 8, min: 1, max: 50 },
      frequentlyBoughtTogether: { type: Number, default: 3, min: 1, max: 10 },
      crossSell: { type: Number, default: 6, min: 1, max: 20 },
      upsell: { type: Number, default: 4, min: 1, max: 20 },
      recentlyViewed: { type: Number, default: 10, min: 1, max: 50 },
      trending: { type: Number, default: 12, min: 1, max: 50 },
      personalized: { type: Number, default: 12, min: 1, max: 50 },
      similar: { type: Number, default: 8, min: 1, max: 50 },
    },
    display: {
      minimumProducts: { type: Number, default: 2, min: 0 },
      desktopLimit: { type: Number, default: 6, min: 1 },
      tabletLimit: { type: Number, default: 4, min: 1 },
      mobileLimit: { type: Number, default: 2, min: 1 },
      mode: { type: String, default: "CAROUSEL", enum: ["CAROUSEL", "GRID", "MIXED"] },
    },
    recentlyViewed: {
      maxHistorySize: { type: Number, default: 20, min: 1, max: 100 },
      expirationDays: { type: Number, default: 30, min: 1, max: 365 },
      anonymousTracking: { type: Boolean, default: true },
      mergeOnLogin: { type: Boolean, default: true },
    },
    cacheTtlSeconds: {
      related: { type: Number, default: 3600, min: 60 },
      bundle: { type: Number, default: 3600, min: 60 },
      crossSell: { type: Number, default: 3600, min: 60 },
      upsell: { type: Number, default: 3600, min: 60 },
      trending: { type: Number, default: 900, min: 60 },
      personalized: { type: Number, default: 1800, min: 60 },
      preview: { type: Number, default: 300, min: 60 },
    },
    aiRules: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    scheduling: {
      rebuildCron: { type: String, trim: true, default: "0 */6 * * *" },
      analyticsCron: { type: String, trim: true, default: "*/30 * * * *" },
      cacheRefreshCron: { type: String, trim: true, default: "0 * * * *" },
    },
    lastRebuiltAt: { type: Date },
    lastAnalyticsAggregatedAt: { type: Date },
    lastCacheClearedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: "recommendation_settings",
  }
);

const relatedProductCacheSchema = new mongoose.Schema(
  {
    recommendationType: {
      type: String,
      required: true,
      enum: ["related", "similar", "trending", "cross_sell", "upsell", "bundle", "personalized"],
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    items: {
      type: [
        {
          productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
          score: { type: Number, default: 0 },
          reasons: { type: [String], default: [] },
          metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
        },
      ],
      default: [],
    },
    scoreBreakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
    expiresAt: { type: Date, required: true, index: true },
    lastComputedAt: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: true,
    collection: "related_product_cache",
  }
);

relatedProductCacheSchema.index(
  { recommendationType: 1, productId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { productId: { $exists: true } } }
);

const bundleRelationshipSchema = new mongoose.Schema(
  {
    baseProductId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    associatedProductId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    frequencyScore: { type: Number, default: 0, min: 0 },
    revenueContribution: { type: Number, default: 0, min: 0 },
    conversionRate: { type: Number, default: 0, min: 0 },
    bundleRevenue: { type: Number, default: 0, min: 0 },
    orderCount: { type: Number, default: 0, min: 0 },
    lastPurchasedAt: { type: Date, index: true },
    relationshipStrength: { type: Number, default: 0, min: 0, index: true },
  },
  {
    timestamps: true,
    collection: "bundle_relationships",
  }
);

bundleRelationshipSchema.index({ baseProductId: 1, associatedProductId: 1 }, { unique: true });

const ruleConditionSchema = new mongoose.Schema(
  {
    field: { type: String, required: true, trim: true },
    operator: { type: String, required: true, trim: true, default: "eq" },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const crossSellRuleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true, index: true },
    priority: { type: Number, default: 100, min: 0 },
    type: { type: String, default: "AUTO", enum: ["AUTO", "MANUAL", "CATEGORY", "BRAND", "PRODUCT"] },
    sourceProductIds: { type: [mongoose.Schema.Types.ObjectId], ref: "Product", default: [] },
    sourceCategoryIds: { type: [mongoose.Schema.Types.ObjectId], ref: "Category", default: [] },
    sourceBrands: { type: [String], default: [] },
    targetProductIds: { type: [mongoose.Schema.Types.ObjectId], ref: "Product", default: [] },
    targetCategoryIds: { type: [mongoose.Schema.Types.ObjectId], ref: "Category", default: [] },
    targetBrands: { type: [String], default: [] },
    conditions: { type: [ruleConditionSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    collection: "cross_sell_rules",
  }
);

const upsellRuleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true, index: true },
    priority: { type: Number, default: 100, min: 0 },
    sourceProductIds: { type: [mongoose.Schema.Types.ObjectId], ref: "Product", default: [] },
    sourceCategoryIds: { type: [mongoose.Schema.Types.ObjectId], ref: "Category", default: [] },
    targetProductIds: { type: [mongoose.Schema.Types.ObjectId], ref: "Product", default: [] },
    minUpgradePercent: { type: Number, default: 5, min: 0 },
    maxUpgradePercent: { type: Number, default: 40, min: 0 },
    requireBrandMatch: { type: Boolean, default: false },
    requireCategoryMatch: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    collection: "upsell_rules",
  }
);

const recentlyViewedSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    lastViewedAt: { type: Date, default: Date.now, index: true },
    viewCount: { type: Number, default: 1, min: 1 },
  },
  {
    timestamps: true,
    collection: "recently_viewed",
  }
);

recentlyViewedSchema.index({ userId: 1, productId: 1 }, { unique: true });

const recommendationAnalyticsSchema = new mongoose.Schema(
  {
    dateKey: { type: String, required: true, index: true },
    recommendationType: { type: String, required: true, index: true },
    surface: { type: String, required: true, index: true },
    views: { type: Number, default: 0, min: 0 },
    clicks: { type: Number, default: 0, min: 0 },
    conversions: { type: Number, default: 0, min: 0 },
    revenue: { type: Number, default: 0, min: 0 },
    bundleRevenue: { type: Number, default: 0, min: 0 },
    ctr: { type: Number, default: 0, min: 0 },
    conversionRate: { type: Number, default: 0, min: 0 },
    topProductIds: { type: [mongoose.Schema.Types.ObjectId], ref: "Product", default: [] },
    topBundlePairs: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  {
    timestamps: true,
    collection: "recommendation_analytics",
  }
);

recommendationAnalyticsSchema.index({ dateKey: 1, recommendationType: 1, surface: 1 }, { unique: true });

const recommendationLogSchema = new mongoose.Schema(
  {
    recommendationType: { type: String, required: true, index: true },
    surface: { type: String, required: true, index: true },
    eventType: { type: String, required: true, enum: ["VIEW", "CLICK", "CONVERSION", "REBUILD", "CACHE_CLEAR"] },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", index: true },
    recommendedProductId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: "recommendation_logs",
  }
);

const recommendationJobSchema = new mongoose.Schema(
  {
    job_type: { type: String, required: true, enum: ["rebuild", "cache_clear"], index: true },
    status: { type: String, required: true, enum: ["queued", "running", "completed", "failed"], default: "queued", index: true },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    started_at: { type: Date },
    completed_at: { type: Date },
    error_message: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    result: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: "recommendation_jobs",
  }
);

recommendationJobSchema.index({ createdAt: -1 });
recommendationJobSchema.index({ status: 1, createdAt: -1 });

module.exports = {
  RecommendationSettings:
    mongoose.models.RecommendationSettings ||
    mongoose.model("RecommendationSettings", recommendationSettingsSchema),
  RelatedProductCache:
    mongoose.models.RelatedProductCache ||
    mongoose.model("RelatedProductCache", relatedProductCacheSchema),
  BundleRelationship:
    mongoose.models.BundleRelationship ||
    mongoose.model("BundleRelationship", bundleRelationshipSchema),
  CrossSellRule:
    mongoose.models.CrossSellRule ||
    mongoose.model("CrossSellRule", crossSellRuleSchema),
  UpsellRule:
    mongoose.models.UpsellRule ||
    mongoose.model("UpsellRule", upsellRuleSchema),
  RecentlyViewed:
    mongoose.models.RecentlyViewed ||
    mongoose.model("RecentlyViewed", recentlyViewedSchema),
  RecommendationAnalytics:
    mongoose.models.RecommendationAnalytics ||
    mongoose.model("RecommendationAnalytics", recommendationAnalyticsSchema),
  RecommendationLog:
    mongoose.models.RecommendationLog ||
    mongoose.model("RecommendationLog", recommendationLogSchema),
  RecommendationJob:
    mongoose.models.RecommendationJob ||
    mongoose.model("RecommendationJob", recommendationJobSchema),
};
