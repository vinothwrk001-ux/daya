const mongoose = require("mongoose");

const statusBreakdownSchema = new mongoose.Schema(
  {
    placed: { type: Number, default: 0, min: 0 },
    packed: { type: Number, default: 0, min: 0 },
    shipped: { type: Number, default: 0, min: 0 },
    outForDelivery: { type: Number, default: 0, min: 0 },
    delivered: { type: Number, default: 0, min: 0 },
    returned: { type: Number, default: 0, min: 0 },
    cancelled: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const paymentBreakdownSchema = new mongoose.Schema(
  {
    codOrders: { type: Number, default: 0, min: 0 },
    onlineOrders: { type: Number, default: 0, min: 0 },
    codRevenue: { type: Number, default: 0, min: 0 },
    onlineRevenue: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const statsBucketSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    unitsSold: { type: Number, default: 0, min: 0 },
    grossRevenue: { type: Number, default: 0, min: 0 },
    netRevenue: { type: Number, default: 0, min: 0 },
    ordersCount: { type: Number, default: 0, min: 0 },
    returnCount: { type: Number, default: 0, min: 0 },
    refundCount: { type: Number, default: 0, min: 0 },
    cancelledCount: { type: Number, default: 0, min: 0 },
    refundedAmount: { type: Number, default: 0, min: 0 },
    paymentBreakdown: {
      type: paymentBreakdownSchema,
      default: () => ({}),
    },
    statusBreakdown: {
      type: statusBreakdownSchema,
      default: () => ({}),
    },
  },
  { _id: false }
);

const productAnalyticsSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      index: true,
    },
    subCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
      index: true,
    },
    productName: { type: String, trim: true, default: "" },
    productSlug: { type: String, trim: true, default: "" },
    productNumber: { type: String, trim: true, default: "" },
    sku: { type: String, trim: true, default: "" },
    categoryName: { type: String, trim: true, default: "" },
    subCategoryName: { type: String, trim: true, default: "" },
    productStatus: { type: String, trim: true, default: "" },
    productIsActive: { type: Boolean, default: true },
    productDeleted: { type: Boolean, default: false, index: true },
    totalUnitsSold: { type: Number, default: 0, min: 0 },
    totalRevenue: { type: Number, default: 0, min: 0 },
    totalNetRevenue: { type: Number, default: 0, min: 0 },
    totalOrders: { type: Number, default: 0, min: 0 },
    totalReturns: { type: Number, default: 0, min: 0 },
    totalRefunds: { type: Number, default: 0, min: 0 },
    totalRefundedAmount: { type: Number, default: 0, min: 0 },
    totalCancelled: { type: Number, default: 0, min: 0 },
    uniqueCustomers: { type: Number, default: 0, min: 0 },
    repeatCustomers: { type: Number, default: 0, min: 0 },
    repeatPurchaseRate: { type: Number, default: 0, min: 0 },
    conversionRate: { type: Number, default: 0, min: 0 },
    returnRate: { type: Number, default: 0, min: 0 },
    refundRate: { type: Number, default: 0, min: 0 },
    cancellationRate: { type: Number, default: 0, min: 0 },
    rtoRate: { type: Number, default: 0, min: 0 },
    paymentBreakdown: {
      type: paymentBreakdownSchema,
      default: () => ({}),
    },
    statusBreakdown: {
      type: statusBreakdownSchema,
      default: () => ({}),
    },
    currentStock: { type: Number, default: 0, min: 0 },
    reservedStock: { type: Number, default: 0, min: 0 },
    availableStock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 0, min: 0 },
    stockVelocity: { type: Number, default: 0, min: 0 },
    estimatedDaysToStockout: { type: Number, default: 0, min: 0 },
    inventoryMovementScore: { type: Number, default: 0, min: 0 },
    lastSoldAt: { type: Date, index: true },
    dailyStats: {
      type: [statsBucketSchema],
      default: [],
    },
    monthlyStats: {
      type: [statsBucketSchema],
      default: [],
    },
    lastComputedAt: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: true,
    collection: "product_analytics",
  }
);

productAnalyticsSchema.index({ categoryId: 1, updatedAt: -1 });
productAnalyticsSchema.index({ "dailyStats.key": 1 });
productAnalyticsSchema.index({ "monthlyStats.key": 1 });

module.exports = {
  ProductAnalytics:
    mongoose.models.ProductAnalytics || mongoose.model("ProductAnalytics", productAnalyticsSchema),
};
