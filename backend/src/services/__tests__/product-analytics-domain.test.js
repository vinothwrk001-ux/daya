const { logger } = require("../../utils/logger");
const assert = require("assert");
process.env.ENCRYPTION_MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY || "12345678901234567890123456789012";
const {
  buildLifecycleSummaryFromOrders,
  summarizeDocForRange,
  buildCategoryPerformance,
  buildOverview,
} = require("../product-analytics.service").__private__;
const { buildExportFile } = require("../export.service");

async function main() {
  const product = {
    _id: "prod_1",
    categoryId: "cat_1",
    category: "Electronics",
    name: "Noise Cancelling Headphones",
    slug: "noise-cancelling-headphones",
    productNumber: "PRD-1001",
    status: "APPROVED",
    analytics: {
      views: 200,
      salesCount: 10,
    },
    variants: [{ variantId: "black", sku: "NC-HEAD-BLK", isDefault: true, stock: 20, reservedStock: 2, threshold: 5 }],
  };

  const orders = [
    {
      _id: "order_1",
      createdAt: new Date("2026-05-10T10:00:00.000Z"),
      userId: "user_1",
      subtotal: 4000,
      status: "Delivered",
      paymentMethod: "ONLINE",
      items: [
        {
          productId: "prod_1",
          quantity: 2,
          price: 2000,
        },
      ],
    },
    {
      _id: "order_2",
      createdAt: new Date("2026-05-11T10:00:00.000Z"),
      userId: "user_1",
      subtotal: 2000,
      status: "Returned",
      paymentMethod: "COD",
      items: [
        {
          productId: "prod_1",
          quantity: 1,
          price: 2000,
        },
      ],
    },
    {
      _id: "order_3",
      createdAt: new Date("2026-05-12T10:00:00.000Z"),
      userId: "user_2",
      subtotal: 2000,
      status: "Cancelled",
      paymentMethod: "COD",
      items: [
        {
          productId: "prod_1",
          quantity: 1,
          price: 2000,
        },
      ],
    },
  ];

  const refundsByOrderId = new Map([
    [
      "order_2",
      [
        {
          amount: 2000,
        },
      ],
    ],
  ]);
  const returnsByOrderId = new Map([
    [
      "order_2",
      {
        status: "REFUNDED",
      },
    ],
  ]);

  const summary = buildLifecycleSummaryFromOrders(product, orders, refundsByOrderId, returnsByOrderId);

  assert.equal(summary.totalUnitsSold, 3, "delivered and returned units should count as sold");
  assert.equal(summary.totalRevenue, 6000, "gross revenue should accumulate product line revenue");
  assert.equal(summary.totalNetRevenue, 6000, "net revenue should follow product line revenue");
  assert.equal(summary.totalOrders, 2, "cancelled orders should not count as sold orders");
  assert.equal(summary.totalReturns, 1, "approved/refunded returns should count");
  assert.equal(summary.totalRefunds, 1, "refund count should reflect linked refunds");
  assert.equal(summary.totalRefundedAmount, 2000, "refund amount should be allocated to the product");
  assert.equal(summary.totalCancelled, 1, "cancelled orders should be tracked");
  assert.equal(summary.uniqueCustomers, 2, "customer set should dedupe repeated purchasers");
  assert.equal(summary.repeatCustomers, 1, "repeat customer count should be preserved");
  assert.equal(summary.repeatPurchaseRate, 50, "repeat purchase rate should be calculated");
  assert.equal(summary.conversionRate, 5, "conversion rate should use product views and sales count");
  assert.equal(summary.returnRate, 50, "return rate should use sold order volume");
  assert.equal(summary.refundRate, 50, "refund rate should use sold order volume");
  assert.equal(summary.cancellationRate, 50, "cancel rate should use sold order volume");

  const docSummary = summarizeDocForRange(
    {
      productId: "prod_1",
      categoryId: "cat_1",
      productName: "Noise Cancelling Headphones",
      categoryName: "Electronics",
      productStatus: "APPROVED",
      totalUnitsSold: summary.totalUnitsSold,
      totalRevenue: summary.totalRevenue,
      totalNetRevenue: summary.totalNetRevenue,
      totalOrders: summary.totalOrders,
      totalReturns: summary.totalReturns,
      totalRefunds: summary.totalRefunds,
      totalRefundedAmount: summary.totalRefundedAmount,
      totalCancelled: summary.totalCancelled,
      uniqueCustomers: summary.uniqueCustomers,
      repeatCustomers: summary.repeatCustomers,
      repeatPurchaseRate: summary.repeatPurchaseRate,
      conversionRate: summary.conversionRate,
      returnRate: summary.returnRate,
      refundRate: summary.refundRate,
      cancellationRate: summary.cancellationRate,
      rtoRate: summary.rtoRate,
      paymentBreakdown: summary.paymentBreakdown,
      statusBreakdown: summary.statusBreakdown,
      currentStock: 20,
      availableStock: 18,
      reservedStock: 2,
      lowStockThreshold: 5,
      stockVelocity: 1,
      estimatedDaysToStockout: 18,
      inventoryMovementScore: 20,
      dailyStats: summary.dailyStats,
      monthlyStats: summary.monthlyStats,
      lastSoldAt: summary.lastSoldAt,
    },
    {
      startDate: "2026-05-10",
      endDate: "2026-05-11",
      paymentMethod: "ONLINE",
    }
  );

  assert.equal(docSummary.totalOrders, 1, "payment filtering should isolate online orders");
  assert.equal(docSummary.totalRevenue, 4000, "payment filtering should isolate online revenue");

  const categoryRows = buildCategoryPerformance([
    docSummary,
    {
      ...docSummary,
      productId: "prod_2",
      categoryId: "cat_2",
      categoryName: "Accessories",
      totalRevenue: 1000,
      totalNetRevenue: 1000,
      totalOrders: 1,
      totalReturns: 0,
      totalUnitsSold: 1,
    },
  ]);
  assert.equal(categoryRows.length, 2, "category performance should group products by category");
  assert.equal(categoryRows[0].categoryName, "Electronics", "highest revenue category should sort first");

  const overview = buildOverview([docSummary]);
  assert.equal(overview.totalProductRevenue, 4000, "overview should sum product revenue");
  assert.equal(overview.avgOrderValue, 4000, "overview should compute average order value correctly");

  const exportFile = await buildExportFile({
    rows: [{ Product: "Noise Cancelling Headphones", Revenue: 4000 }],
    title: "product analytics",
    filenameBase: "product-analytics",
    format: "csv",
  });
  assert.ok(exportFile.buffer.length > 0, "export generation should create a file buffer");

  logger.info("script_output", { value: "Product analytics domain checks passed." });
}

main().catch((error) => {
  logger.error("script_error", { error: error });
  process.exit(1);
});
