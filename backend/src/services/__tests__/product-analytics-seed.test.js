const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const productAnalyticsService = require("../product-analytics.service");
const { ProductAnalytics } = require("../../models/ProductAnalytics");
const {
  buildProductMetadataSync,
  buildAnalyticsSeedUpsertPayload,
  buildLifecycleSummaryFromOrders,
} = require("../product-analytics.service").__private__;

test("buildAnalyticsSeedUpsertPayload keeps $set and $setOnInsert paths disjoint", () => {
  const productId = new mongoose.Types.ObjectId();
  const insertDoc = {
    productId,
    productName: "Demo T Shirt",
    categoryName: "Clothing",
    productStatus: "APPROVED",
    productIsActive: true,
    productDeleted: false,
    totalUnitsSold: 0,
    totalRevenue: 0,
    dailyStats: [],
  };
  const metadataSync = buildProductMetadataSync({
    _id: productId,
    name: "Demo T Shirt",
    category: "Clothing",
    status: "APPROVED",
    isActive: true,
    slug: "demo-t-shirt",
    productNumber: "PRD-001",
    categoryId: new mongoose.Types.ObjectId(),
    subCategoryId: new mongoose.Types.ObjectId(),
    subCategory: "Tshirt",
    variants: [],
    stock: 10,
    reservedStock: 0,
    lowStockThreshold: 5,
  });

  const payload = buildAnalyticsSeedUpsertPayload(insertDoc, metadataSync);
  const setOnInsertKeys = Object.keys(payload.$setOnInsert);
  const setKeys = Object.keys(payload.$set);
  const overlap = setOnInsertKeys.filter((key) => setKeys.includes(key));

  assert.equal(overlap.length, 0, `Overlapping upsert paths: ${overlap.join(", ")}`);
  assert.equal(payload.$set.productName, "Demo T Shirt");
  assert.equal(payload.$setOnInsert.productName, undefined);
  assert.equal(payload.$setOnInsert.totalUnitsSold, 0);
});

test("ensureProductAnalyticsSeed writes non-conflicting upsert payload", async () => {
  const productId = new mongoose.Types.ObjectId();
  const product = {
    _id: productId,
    name: "Demo T Shirt",
    slug: "demo-t-shirt",
    productNumber: "PRD-001",
    category: "Clothing",
    subCategory: "Tshirt",
    categoryId: new mongoose.Types.ObjectId(),
    subCategoryId: new mongoose.Types.ObjectId(),
    status: "APPROVED",
    isActive: true,
    variants: [],
    stock: 10,
    reservedStock: 0,
    lowStockThreshold: 5,
    analytics: { views: 0, salesCount: 0 },
  };

  let capturedUpdate = null;
  const originalUpdateOne = ProductAnalytics.updateOne;
  const originalFindOne = ProductAnalytics.findOne;

  ProductAnalytics.updateOne = async (filter, update) => {
    capturedUpdate = update;
    return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
  };
  ProductAnalytics.findOne = () => ({
    lean: async () => ({ productId, productName: product.name }),
  });

  try {
    const result = await productAnalyticsService.ensureProductAnalyticsSeed(product);
    assert.ok(result, "seed should return analytics doc");
    assert.ok(capturedUpdate?.$set, "update should include $set metadata sync");
    assert.ok(capturedUpdate?.$setOnInsert, "update should include $setOnInsert seed metrics");

    const overlap = Object.keys(capturedUpdate.$setOnInsert).filter((key) =>
      Object.prototype.hasOwnProperty.call(capturedUpdate.$set, key)
    );
    assert.equal(overlap.length, 0, `Mongo upsert conflict paths: ${overlap.join(", ")}`);
    assert.equal(capturedUpdate.$set.productName, "Demo T Shirt");
  } finally {
    ProductAnalytics.updateOne = originalUpdateOne;
    ProductAnalytics.findOne = originalFindOne;
  }
});

test("buildLifecycleSummaryFromOrders remains unchanged for product analytics refresh", () => {
  const summary = buildLifecycleSummaryFromOrders(
    {
      _id: "prod_1",
      name: "Demo T Shirt",
      category: "Clothing",
      status: "APPROVED",
      analytics: { views: 10, salesCount: 1 },
      variants: [],
    },
    [],
    new Map(),
    new Map()
  );

  assert.equal(summary.productName, "Demo T Shirt");
  assert.equal(summary.totalUnitsSold, 0);
});
