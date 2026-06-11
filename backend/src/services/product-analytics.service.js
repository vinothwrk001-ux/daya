const mongoose = require("mongoose");
const { ProductAnalytics } = require("../models/ProductAnalytics");
const { Product } = require("../models/Product");
const { Order } = require("../models/Order");
const { Refund } = require("../models/Refund");
const { ReturnRequest } = require("../models/ReturnRequest");
const { AppError } = require("../utils/AppError");
const { normalizeDateRange } = require("../utils/dateRange");

const FULFILLED_ORDER_STATUSES = new Set(["Placed", "Packed", "Shipped", "Out for Delivery", "Delivered", "Returned"]);
const STATUS_KEY_MAP = {
  Placed: "placed",
  Packed: "packed",
  Shipped: "shipped",
  "Out for Delivery": "outForDelivery",
  Delivered: "delivered",
  Returned: "returned",
  Cancelled: "cancelled",
};

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function buildEmptyStatusBreakdown() {
  return {
    placed: 0,
    packed: 0,
    shipped: 0,
    outForDelivery: 0,
    delivered: 0,
    returned: 0,
    cancelled: 0,
  };
}

function buildEmptyPaymentBreakdown() {
  return {
    codOrders: 0,
    onlineOrders: 0,
    codRevenue: 0,
    onlineRevenue: 0,
  };
}

function buildEmptyBucket(key = "") {
  return {
    key,
    unitsSold: 0,
    grossRevenue: 0,
    netRevenue: 0,
    ordersCount: 0,
    returnCount: 0,
    refundCount: 0,
    cancelledCount: 0,
    refundedAmount: 0,
    paymentBreakdown: buildEmptyPaymentBreakdown(),
    statusBreakdown: buildEmptyStatusBreakdown(),
  };
}

function cloneBucket(bucket = {}) {
  return {
    key: bucket.key || "",
    unitsSold: Number(bucket.unitsSold || 0),
    grossRevenue: roundMoney(bucket.grossRevenue || 0),
    netRevenue: roundMoney(bucket.netRevenue || 0),
    ordersCount: Number(bucket.ordersCount || 0),
    returnCount: Number(bucket.returnCount || 0),
    refundCount: Number(bucket.refundCount || 0),
    cancelledCount: Number(bucket.cancelledCount || 0),
    refundedAmount: roundMoney(bucket.refundedAmount || 0),
    paymentBreakdown: {
      codOrders: Number(bucket.paymentBreakdown?.codOrders || 0),
      onlineOrders: Number(bucket.paymentBreakdown?.onlineOrders || 0),
      codRevenue: roundMoney(bucket.paymentBreakdown?.codRevenue || 0),
      onlineRevenue: roundMoney(bucket.paymentBreakdown?.onlineRevenue || 0),
    },
    statusBreakdown: {
      placed: Number(bucket.statusBreakdown?.placed || 0),
      packed: Number(bucket.statusBreakdown?.packed || 0),
      shipped: Number(bucket.statusBreakdown?.shipped || 0),
      outForDelivery: Number(bucket.statusBreakdown?.outForDelivery || 0),
      delivered: Number(bucket.statusBreakdown?.delivered || 0),
      returned: Number(bucket.statusBreakdown?.returned || 0),
      cancelled: Number(bucket.statusBreakdown?.cancelled || 0),
    },
  };
}

function addBucketMetrics(target, source) {
  const next = cloneBucket(target);
  next.unitsSold += Number(source.unitsSold || 0);
  next.grossRevenue = roundMoney(next.grossRevenue + Number(source.grossRevenue || 0));
  next.netRevenue = roundMoney(next.netRevenue + Number(source.netRevenue || 0));
  next.ordersCount += Number(source.ordersCount || 0);
  next.returnCount += Number(source.returnCount || 0);
  next.refundCount += Number(source.refundCount || 0);
  next.cancelledCount += Number(source.cancelledCount || 0);
  next.refundedAmount = roundMoney(next.refundedAmount + Number(source.refundedAmount || 0));

  next.paymentBreakdown.codOrders += Number(source.paymentBreakdown?.codOrders || 0);
  next.paymentBreakdown.onlineOrders += Number(source.paymentBreakdown?.onlineOrders || 0);
  next.paymentBreakdown.codRevenue = roundMoney(
    next.paymentBreakdown.codRevenue + Number(source.paymentBreakdown?.codRevenue || 0)
  );
  next.paymentBreakdown.onlineRevenue = roundMoney(
    next.paymentBreakdown.onlineRevenue + Number(source.paymentBreakdown?.onlineRevenue || 0)
  );

  next.statusBreakdown.placed += Number(source.statusBreakdown?.placed || 0);
  next.statusBreakdown.packed += Number(source.statusBreakdown?.packed || 0);
  next.statusBreakdown.shipped += Number(source.statusBreakdown?.shipped || 0);
  next.statusBreakdown.outForDelivery += Number(source.statusBreakdown?.outForDelivery || 0);
  next.statusBreakdown.delivered += Number(source.statusBreakdown?.delivered || 0);
  next.statusBreakdown.returned += Number(source.statusBreakdown?.returned || 0);
  next.statusBreakdown.cancelled += Number(source.statusBreakdown?.cancelled || 0);

  return next;
}

function getDateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function getMonthKey(value) {
  return getDateKey(value).slice(0, 7);
}

function safeNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateRate(numerator, denominator) {
  if (!denominator) return 0;
  return roundMoney((Number(numerator || 0) / Number(denominator || 0)) * 100);
}

function resolveRange(query = {}) {
  const preset = String(query.range || "").trim().toLowerCase();
  if (preset && !query.startDate && !query.endDate) {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (preset === "today") return { $gte: start, $lte: end };
    if (preset === "yesterday") {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
      return { $gte: start, $lte: end };
    }
    if (preset === "weekly" || preset === "week") {
      start.setDate(start.getDate() - 6);
      return { $gte: start, $lte: end };
    }
    if (preset === "monthly" || preset === "month") {
      start.setDate(1);
      return { $gte: start, $lte: end };
    }
    if (preset === "yearly" || preset === "year") {
      start.setMonth(0, 1);
      return { $gte: start, $lte: end };
    }
  }
  return normalizeDateRange({
    startDate: query.startDate,
    endDate: query.endDate,
  });
}

function bucketInRange(bucketKey, range, bucketType = "day") {
  if (!range) return true;
  const bucketDate = bucketType === "month" ? new Date(`${bucketKey}-01T00:00:00.000Z`) : new Date(`${bucketKey}T00:00:00.000Z`);
  if (range.$gte && bucketDate < range.$gte) return false;
  if (range.$lte) {
    const compareDate = bucketType === "month"
      ? new Date(Date.UTC(bucketDate.getUTCFullYear(), bucketDate.getUTCMonth() + 1, 0, 23, 59, 59, 999))
      : new Date(`${bucketKey}T23:59:59.999Z`);
    if (compareDate > range.$lte && bucketDate > range.$lte) return false;
  }
  return true;
}

function pickBucketValue(bucket, filters = {}) {
  const statusFilter = String(filters.orderStatus || "").trim();
  const paymentMethod = String(filters.paymentMethod || "").trim().toUpperCase();

  let selected = cloneBucket(bucket);

  if (paymentMethod === "COD") {
    selected.ordersCount = Number(bucket.paymentBreakdown?.codOrders || 0);
    selected.grossRevenue = roundMoney(bucket.paymentBreakdown?.codRevenue || 0);
  } else if (paymentMethod === "ONLINE") {
    selected.ordersCount = Number(bucket.paymentBreakdown?.onlineOrders || 0);
    selected.grossRevenue = roundMoney(bucket.paymentBreakdown?.onlineRevenue || 0);
  }

  if (statusFilter) {
    const normalizedStatus = statusFilter.toLowerCase();
    if (normalizedStatus === "cancelled") {
      return {
        ...buildEmptyBucket(bucket.key),
        cancelledCount: Number(bucket.cancelledCount || 0),
        ordersCount: Number(bucket.cancelledCount || 0),
        statusBreakdown: {
          ...buildEmptyStatusBreakdown(),
          cancelled: Number(bucket.cancelledCount || 0),
        },
      };
    }
    if (normalizedStatus === "returned") {
      return {
        ...buildEmptyBucket(bucket.key),
        returnCount: Number(bucket.returnCount || 0),
        ordersCount: Number(bucket.returnCount || 0),
        statusBreakdown: {
          ...buildEmptyStatusBreakdown(),
          returned: Number(bucket.returnCount || 0),
        },
      };
    }
    const mappedKey = normalizedStatus.replace(/\s+/g, "");
    const lookup = {
      placed: "placed",
      packed: "packed",
      shipped: "shipped",
      outfordelivery: "outForDelivery",
      delivered: "delivered",
    };
    const statusKey = lookup[mappedKey];
    if (statusKey) {
      return {
        ...buildEmptyBucket(bucket.key),
        ordersCount: Number(bucket.statusBreakdown?.[statusKey] || 0),
        unitsSold: statusKey === "placed" || statusKey === "packed" || statusKey === "shipped" || statusKey === "outForDelivery" || statusKey === "delivered"
          ? Number(bucket.unitsSold || 0)
          : 0,
        grossRevenue: roundMoney(bucket.grossRevenue || 0),
        netRevenue: roundMoney(bucket.netRevenue || 0),
        statusBreakdown: {
          ...buildEmptyStatusBreakdown(),
          [statusKey]: Number(bucket.statusBreakdown?.[statusKey] || 0),
        },
      };
    }
  }

  return selected;
}

function summarizeDocForRange(doc, filters = {}) {
  const range = resolveRange(filters);
  const sourceBuckets =
    range && !filters.forceMonthly ? (Array.isArray(doc.dailyStats) ? doc.dailyStats : []) : (Array.isArray(doc.monthlyStats) ? doc.monthlyStats : []);
  const bucketType = range && !filters.forceMonthly ? "day" : "month";

  if (!range && !filters.orderStatus && !filters.paymentMethod) {
    return {
      key: String(doc.productId),
      productId: doc.productId,
      categoryId: doc.categoryId,
      productName: doc.productName,
      categoryName: doc.categoryName,
      productStatus: doc.productStatus,
      productDeleted: Boolean(doc.productDeleted),
      totalUnitsSold: safeNumber(doc.totalUnitsSold),
      totalRevenue: roundMoney(doc.totalRevenue || 0),
      totalNetRevenue: roundMoney(doc.totalNetRevenue || 0),
      totalOrders: safeNumber(doc.totalOrders),
      totalReturns: safeNumber(doc.totalReturns),
      totalRefunds: safeNumber(doc.totalRefunds),
      totalRefundedAmount: roundMoney(doc.totalRefundedAmount || 0),
      totalCancelled: safeNumber(doc.totalCancelled),
      uniqueCustomers: safeNumber(doc.uniqueCustomers),
      repeatCustomers: safeNumber(doc.repeatCustomers),
      repeatPurchaseRate: safeNumber(doc.repeatPurchaseRate),
      conversionRate: safeNumber(doc.conversionRate),
      returnRate: safeNumber(doc.returnRate),
      refundRate: safeNumber(doc.refundRate),
      cancellationRate: safeNumber(doc.cancellationRate),
      rtoRate: safeNumber(doc.rtoRate),
      paymentBreakdown: doc.paymentBreakdown || buildEmptyPaymentBreakdown(),
      statusBreakdown: doc.statusBreakdown || buildEmptyStatusBreakdown(),
      currentStock: safeNumber(doc.currentStock),
      reservedStock: safeNumber(doc.reservedStock),
      availableStock: safeNumber(doc.availableStock),
      lowStockThreshold: safeNumber(doc.lowStockThreshold),
      stockVelocity: safeNumber(doc.stockVelocity),
      estimatedDaysToStockout: safeNumber(doc.estimatedDaysToStockout),
      inventoryMovementScore: safeNumber(doc.inventoryMovementScore),
      lastSoldAt: doc.lastSoldAt || null,
    };
  }

  let aggregate = buildEmptyBucket(String(doc.productId));
  for (const rawBucket of sourceBuckets) {
    if (!bucketInRange(rawBucket.key, range, bucketType)) continue;
    aggregate = addBucketMetrics(aggregate, pickBucketValue(rawBucket, filters));
  }

  const totalOrders = safeNumber(aggregate.ordersCount);
  const totalReturns = safeNumber(aggregate.returnCount);
  const totalRefunds = safeNumber(aggregate.refundCount);
  const totalCancelled = safeNumber(aggregate.cancelledCount);
  const totalUnitsSold = safeNumber(aggregate.unitsSold);

  return {
    key: String(doc.productId),
    productId: doc.productId,
    categoryId: doc.categoryId,
    productName: doc.productName,
    categoryName: doc.categoryName,
    productStatus: doc.productStatus,
    productDeleted: Boolean(doc.productDeleted),
    totalUnitsSold,
    totalRevenue: roundMoney(aggregate.grossRevenue),
    totalNetRevenue: roundMoney(aggregate.netRevenue),
    totalOrders,
    totalReturns,
    totalRefunds,
    totalRefundedAmount: roundMoney(aggregate.refundedAmount),
    totalCancelled,
    uniqueCustomers: safeNumber(doc.uniqueCustomers),
    repeatCustomers: safeNumber(doc.repeatCustomers),
    repeatPurchaseRate: safeNumber(doc.repeatPurchaseRate),
    conversionRate: safeNumber(doc.conversionRate),
    returnRate: calculateRate(totalReturns, totalOrders),
    refundRate: calculateRate(totalRefunds, totalOrders),
    cancellationRate: calculateRate(totalCancelled, totalOrders),
    rtoRate: calculateRate(totalCancelled, totalOrders),
    paymentBreakdown: aggregate.paymentBreakdown,
    statusBreakdown: aggregate.statusBreakdown,
    currentStock: safeNumber(doc.currentStock),
    reservedStock: safeNumber(doc.reservedStock),
    availableStock: safeNumber(doc.availableStock),
    lowStockThreshold: safeNumber(doc.lowStockThreshold),
    stockVelocity: safeNumber(doc.stockVelocity),
    estimatedDaysToStockout: safeNumber(doc.estimatedDaysToStockout),
    inventoryMovementScore: safeNumber(doc.inventoryMovementScore),
    lastSoldAt: doc.lastSoldAt || null,
  };
}

function getTrendSeries(doc, type = "daily", filters = {}) {
  const range = resolveRange(filters);
  const source = type === "monthly" ? doc.monthlyStats || [] : doc.dailyStats || [];
  return source
    .filter((bucket) => bucketInRange(bucket.key, range, type === "monthly" ? "month" : "day"))
    .map((bucket) => ({
      key: bucket.key,
      label: bucket.key,
      unitsSold: safeNumber(bucket.unitsSold),
      grossRevenue: roundMoney(bucket.grossRevenue || 0),
      netRevenue: roundMoney(bucket.netRevenue || 0),
      ordersCount: safeNumber(bucket.ordersCount),
      returnCount: safeNumber(bucket.returnCount),
      refundCount: safeNumber(bucket.refundCount),
      cancelledCount: safeNumber(bucket.cancelledCount),
      refundedAmount: roundMoney(bucket.refundedAmount || 0),
    }));
}

function deriveInsightRows(items = []) {
  const sortedByGrowth = [...items].sort((a, b) => (b.totalRevenue - a.totalRevenue) - (a.totalRevenue - b.totalRevenue));
  const sortedByReturns = [...items].sort((a, b) => b.returnRate - a.returnRate);
  const sortedByConversion = [...items].sort((a, b) => b.conversionRate - a.conversionRate);
  return {
    fastestGrowingProduct: sortedByGrowth[0] || null,
    decliningProduct: [...items].sort((a, b) => a.totalRevenue - b.totalRevenue)[0] || null,
    highReturnProduct: sortedByReturns[0] || null,
    highConversionProduct: sortedByConversion[0] || null,
  };
}

function buildCategoryPerformance(items = []) {
  const map = new Map();
  for (const item of items) {
    const key = String(item.categoryId || item.categoryName || "uncategorized");
    const current = map.get(key) || {
      categoryId: item.categoryId || null,
      categoryName: item.categoryName || "Uncategorized",
      revenue: 0,
      netRevenue: 0,
      orders: 0,
      returns: 0,
      unitsSold: 0,
    };
    current.revenue = roundMoney(current.revenue + Number(item.totalRevenue || 0));
    current.netRevenue = roundMoney(current.netRevenue + Number(item.totalNetRevenue || 0));
    current.orders += Number(item.totalOrders || 0);
    current.returns += Number(item.totalReturns || 0);
    current.unitsSold += Number(item.totalUnitsSold || 0);
    map.set(key, current);
  }

  const rows = Array.from(map.values()).map((entry) => ({
    ...entry,
    returnRate: calculateRate(entry.returns, entry.orders),
  }));

  const totalRevenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
  return rows
    .map((row) => ({
      ...row,
      revenueContribution: calculateRate(row.revenue, totalRevenue),
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

function buildOverview(items = []) {
  const totals = items.reduce(
    (acc, item) => {
      acc.totalProductRevenue = roundMoney(acc.totalProductRevenue + Number(item.totalRevenue || 0));
      acc.totalNetRevenue = roundMoney(acc.totalNetRevenue + Number(item.totalNetRevenue || 0));
      acc.unitsSold += Number(item.totalUnitsSold || 0);
      acc.totalOrders += Number(item.totalOrders || 0);
      acc.totalReturns += Number(item.totalReturns || 0);
      acc.totalRefunds += Number(item.totalRefunds || 0);
      acc.totalRefundedAmount = roundMoney(acc.totalRefundedAmount + Number(item.totalRefundedAmount || 0));
      acc.totalCancelled += Number(item.totalCancelled || 0);
      acc.currentStock += Number(item.currentStock || 0);
      acc.availableStock += Number(item.availableStock || 0);
      acc.reservedStock += Number(item.reservedStock || 0);
      return acc;
    },
    {
      totalProductRevenue: 0,
      totalNetRevenue: 0,
      unitsSold: 0,
      totalOrders: 0,
      totalReturns: 0,
      totalRefunds: 0,
      totalRefundedAmount: 0,
      totalCancelled: 0,
      currentStock: 0,
      availableStock: 0,
      reservedStock: 0,
    }
  );

  return {
    ...totals,
    avgOrderValue: totals.totalOrders ? roundMoney(totals.totalProductRevenue / totals.totalOrders) : 0,
    returnRate: calculateRate(totals.totalReturns, totals.totalOrders),
    refundRate: calculateRate(totals.totalRefunds, totals.totalOrders),
    cancellationRate: calculateRate(totals.totalCancelled, totals.totalOrders),
  };
}

function buildInventoryInsight(item = {}) {
  const currentStock = safeNumber(item.currentStock);
  const availableStock = safeNumber(item.availableStock);
  const stockVelocity = safeNumber(item.stockVelocity);
  return {
    currentStock,
    availableStock,
    reservedStock: safeNumber(item.reservedStock),
    lowStockThreshold: safeNumber(item.lowStockThreshold),
    stockVelocity,
    estimatedDaysToStockout: safeNumber(item.estimatedDaysToStockout),
    stockStatus:
      availableStock <= safeNumber(item.lowStockThreshold)
        ? "LOW"
        : stockVelocity >= 3
          ? "FAST_MOVING"
          : stockVelocity <= 0.25
            ? "SLOW_MOVING"
            : "HEALTHY",
  };
}

function toLegacyProductCard(row = {}) {
  return {
    _id: row.productId,
    productId: row.productId,
    name: row.productName,
    productName: row.productName,
    category: row.categoryName,
    categoryName: row.categoryName,
    status: row.productStatus,
    productStatus: row.productStatus,
    analytics: {
      totalRevenue: roundMoney(row.totalRevenue || 0),
      salesCount: safeNumber(row.totalUnitsSold),
    },
    totalRevenue: roundMoney(row.totalRevenue || 0),
    totalUnitsSold: safeNumber(row.totalUnitsSold),
  };
}

function buildAggregateTrend(docs = [], filters = {}, type = "monthly") {
  const trendMap = new Map();
  for (const doc of docs) {
    const source = type === "monthly" ? doc.monthlyStats || [] : doc.dailyStats || [];
    for (const bucket of source) {
      if (!bucketInRange(bucket.key, resolveRange(filters), type === "monthly" ? "month" : "day")) continue;
      trendMap.set(bucket.key, addBucketMetrics(trendMap.get(bucket.key) || buildEmptyBucket(bucket.key), pickBucketValue(bucket, filters)));
    }
  }

  return Array.from(trendMap.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((bucket) => ({
      label: bucket.key,
      revenue: roundMoney(bucket.grossRevenue || 0),
      orders: safeNumber(bucket.ordersCount),
    }));
}

function deriveInventorySnapshot(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) {
    const currentStock = safeNumber(product?.stock);
    return {
      currentStock,
      reservedStock: 0,
      availableStock: currentStock,
      lowStockThreshold: safeNumber(product?.lowStockThreshold),
    };
  }

  return variants.reduce(
    (acc, variant) => {
      acc.currentStock += safeNumber(variant.stock);
      acc.reservedStock += safeNumber(variant.reservedStock);
      acc.availableStock += Math.max(safeNumber(variant.stock) - safeNumber(variant.reservedStock), 0);
      acc.lowStockThreshold = Math.max(acc.lowStockThreshold, safeNumber(variant.threshold));
      return acc;
    },
    { currentStock: 0, reservedStock: 0, availableStock: 0, lowStockThreshold: 0 }
  );
}

function derivePrimarySku(product) {
  const variant = Array.isArray(product?.variants) ? product.variants.find((item) => item.isDefault) || product.variants[0] : null;
  return variant?.sku || product?.SKU || "";
}

function buildProductAnalyticsDocument(product, analyticsSummary) {
  const inventory = deriveInventorySnapshot(product);
  const thirtyDayUnits = (analyticsSummary.dailyStats || [])
    .slice(-30)
    .reduce((sum, bucket) => sum + Number(bucket.unitsSold || 0), 0);
  const stockVelocity = roundMoney(thirtyDayUnits / 30);
  const estimatedDaysToStockout = stockVelocity > 0 ? roundMoney(inventory.availableStock / stockVelocity) : 0;

  return {
    productId: product?._id || analyticsSummary.productId,
    categoryId: product?.categoryId || analyticsSummary.categoryId || null,
    subCategoryId: product?.subCategoryId || analyticsSummary.subCategoryId || null,
    productName: product?.name || analyticsSummary.productName || "Deleted product",
    productSlug: product?.slug || analyticsSummary.productSlug || "",
    productNumber: product?.productNumber || analyticsSummary.productNumber || "",
    sku: derivePrimarySku(product) || analyticsSummary.sku || "",
    categoryName: product?.category || analyticsSummary.categoryName || "",
    subCategoryName: product?.subCategory || analyticsSummary.subCategoryName || "",
    productStatus: product?.status || analyticsSummary.productStatus || "",
    productIsActive: product?.isActive !== false,
    productDeleted: !product,
    totalUnitsSold: safeNumber(analyticsSummary.totalUnitsSold),
    totalRevenue: roundMoney(analyticsSummary.totalRevenue || 0),
    totalNetRevenue: roundMoney(analyticsSummary.totalNetRevenue || 0),
    totalOrders: safeNumber(analyticsSummary.totalOrders),
    totalReturns: safeNumber(analyticsSummary.totalReturns),
    totalRefunds: safeNumber(analyticsSummary.totalRefunds),
    totalRefundedAmount: roundMoney(analyticsSummary.totalRefundedAmount || 0),
    totalCancelled: safeNumber(analyticsSummary.totalCancelled),
    uniqueCustomers: safeNumber(analyticsSummary.uniqueCustomers),
    repeatCustomers: safeNumber(analyticsSummary.repeatCustomers),
    repeatPurchaseRate: safeNumber(analyticsSummary.repeatPurchaseRate),
    conversionRate: safeNumber(analyticsSummary.conversionRate),
    returnRate: safeNumber(analyticsSummary.returnRate),
    refundRate: safeNumber(analyticsSummary.refundRate),
    cancellationRate: safeNumber(analyticsSummary.cancellationRate),
    rtoRate: safeNumber(analyticsSummary.rtoRate),
    paymentBreakdown: analyticsSummary.paymentBreakdown,
    statusBreakdown: analyticsSummary.statusBreakdown,
    currentStock: inventory.currentStock,
    reservedStock: inventory.reservedStock,
    availableStock: inventory.availableStock,
    lowStockThreshold: inventory.lowStockThreshold,
    stockVelocity,
    estimatedDaysToStockout,
    inventoryMovementScore: roundMoney((stockVelocity * 10) + Math.max(0, 100 - estimatedDaysToStockout)),
    lastSoldAt: analyticsSummary.lastSoldAt || null,
    dailyStats: analyticsSummary.dailyStats,
    monthlyStats: analyticsSummary.monthlyStats,
    lastComputedAt: new Date(),
  };
}

function buildLifecycleSummaryFromOrders(product, orders = [], refundsByOrderId = new Map(), returnsByOrderId = new Map()) {
  const dailyStats = new Map();
  const monthlyStats = new Map();
  const uniqueCustomers = new Set();
  const customerPurchases = new Map();
  let lastSoldAt = null;

  const total = {
    productId: product?._id || null,
    categoryId: product?.categoryId || null,
    productName: product?.name || "Deleted product",
    productSlug: product?.slug || "",
    productNumber: product?.productNumber || "",
    sku: derivePrimarySku(product),
    categoryName: product?.category || "",
    productStatus: product?.status || "",
    totalUnitsSold: 0,
    totalRevenue: 0,
    totalNetRevenue: 0,
    totalOrders: 0,
    totalReturns: 0,
    totalRefunds: 0,
    totalRefundedAmount: 0,
    totalCancelled: 0,
    uniqueCustomers: 0,
    repeatCustomers: 0,
    repeatPurchaseRate: 0,
    conversionRate: safeNumber(product?.analytics?.views) > 0
      ? roundMoney((safeNumber(product?.analytics?.salesCount) / safeNumber(product?.analytics?.views)) * 100)
      : 0,
    returnRate: 0,
    refundRate: 0,
    cancellationRate: 0,
    rtoRate: 0,
    paymentBreakdown: buildEmptyPaymentBreakdown(),
    statusBreakdown: buildEmptyStatusBreakdown(),
    dailyStats: [],
    monthlyStats: [],
    lastSoldAt: null,
  };

  for (const order of orders) {
    const orderDate = order.createdAt || order.updatedAt || new Date();
    const dayKey = getDateKey(orderDate);
    const monthKey = getMonthKey(orderDate);
    const lineItems = (order.items || []).filter((item) => String(item.productId?._id || item.productId) === String(product?._id));
    if (!lineItems.length) continue;

    const orderSubtotal = safeNumber(order.subtotal);
    const orderRefunds = refundsByOrderId.get(String(order._id)) || [];
    const returnRequest = returnsByOrderId.get(String(order._id)) || null;
    const isCancelled = order.status === "Cancelled";
    const statusKey = STATUS_KEY_MAP[order.status] || null;

    for (const lineItem of lineItems) {
      const quantity = safeNumber(lineItem.quantity);
      const lineRevenue = roundMoney(safeNumber(lineItem.price) * quantity);
      const lineNetRevenue = lineRevenue;
      const lineShareRatio = orderSubtotal > 0 ? lineRevenue / orderSubtotal : 0;

      if (!dailyStats.has(dayKey)) dailyStats.set(dayKey, buildEmptyBucket(dayKey));
      if (!monthlyStats.has(monthKey)) monthlyStats.set(monthKey, buildEmptyBucket(monthKey));
      const dailyBucket = dailyStats.get(dayKey);
      const monthlyBucket = monthlyStats.get(monthKey);

      const appliedBuckets = [dailyBucket, monthlyBucket];

      for (const bucket of appliedBuckets) {
        if (FULFILLED_ORDER_STATUSES.has(order.status)) {
          bucket.unitsSold += quantity;
          bucket.grossRevenue = roundMoney(bucket.grossRevenue + lineRevenue);
          bucket.netRevenue = roundMoney(bucket.netRevenue + lineNetRevenue);
          bucket.ordersCount += 1;
          if (order.paymentMethod === "COD") {
            bucket.paymentBreakdown.codOrders += 1;
            bucket.paymentBreakdown.codRevenue = roundMoney(bucket.paymentBreakdown.codRevenue + lineRevenue);
          } else {
            bucket.paymentBreakdown.onlineOrders += 1;
            bucket.paymentBreakdown.onlineRevenue = roundMoney(bucket.paymentBreakdown.onlineRevenue + lineRevenue);
          }
        }

        if (isCancelled) {
          bucket.cancelledCount += 1;
        }
        if (statusKey) {
          bucket.statusBreakdown[statusKey] += 1;
        }
      }

      if (FULFILLED_ORDER_STATUSES.has(order.status)) {
        total.totalUnitsSold += quantity;
        total.totalRevenue = roundMoney(total.totalRevenue + lineRevenue);
        total.totalNetRevenue = roundMoney(total.totalNetRevenue + lineNetRevenue);
        total.totalOrders += 1;
        if (order.paymentMethod === "COD") {
          total.paymentBreakdown.codOrders += 1;
          total.paymentBreakdown.codRevenue = roundMoney(total.paymentBreakdown.codRevenue + lineRevenue);
        } else {
          total.paymentBreakdown.onlineOrders += 1;
          total.paymentBreakdown.onlineRevenue = roundMoney(total.paymentBreakdown.onlineRevenue + lineRevenue);
        }
        lastSoldAt = !lastSoldAt || orderDate > lastSoldAt ? orderDate : lastSoldAt;
      }

      if (isCancelled) {
        total.totalCancelled += 1;
      }
      if (statusKey) {
        total.statusBreakdown[statusKey] += 1;
      }

      if (returnRequest?.status && ["APPROVED", "REFUNDED"].includes(returnRequest.status)) {
        for (const bucket of appliedBuckets) {
          bucket.returnCount += 1;
        }
        total.totalReturns += 1;
      }

      for (const refund of orderRefunds) {
        const refundShare = roundMoney(safeNumber(refund.amount) * lineShareRatio);
        for (const bucket of appliedBuckets) {
          bucket.refundCount += 1;
          bucket.refundedAmount = roundMoney(bucket.refundedAmount + refundShare);
        }
        total.totalRefunds += 1;
        total.totalRefundedAmount = roundMoney(total.totalRefundedAmount + refundShare);
      }

      const customerId = String(order.userId?._id || order.userId || "");
      if (customerId) {
        uniqueCustomers.add(customerId);
        customerPurchases.set(customerId, (customerPurchases.get(customerId) || 0) + 1);
      }
    }
  }

  total.uniqueCustomers = uniqueCustomers.size;
  total.repeatCustomers = Array.from(customerPurchases.values()).filter((count) => count > 1).length;
  total.repeatPurchaseRate = calculateRate(total.repeatCustomers, total.uniqueCustomers);
  total.returnRate = calculateRate(total.totalReturns, total.totalOrders);
  total.refundRate = calculateRate(total.totalRefunds, total.totalOrders);
  total.cancellationRate = calculateRate(total.totalCancelled, total.totalOrders);
  total.rtoRate = calculateRate(total.statusBreakdown.cancelled, total.paymentBreakdown.codOrders);
  total.lastSoldAt = lastSoldAt;
  total.dailyStats = Array.from(dailyStats.values()).sort((a, b) => a.key.localeCompare(b.key));
  total.monthlyStats = Array.from(monthlyStats.values()).sort((a, b) => a.key.localeCompare(b.key));

  return total;
}

class ProductAnalyticsService {
  async ensureProductAnalyticsSeed(product) {
    if (!product?._id) return null;
    const empty = buildProductAnalyticsDocument(product, {
      productId: product._id,
      categoryId: product.categoryId || null,
      productName: product.name || "",
      productSlug: product.slug || "",
      productNumber: product.productNumber || "",
      sku: derivePrimarySku(product),
      categoryName: product.category || "",
      productStatus: product.status || "",
      totalUnitsSold: 0,
      totalRevenue: 0,
      totalNetRevenue: 0,
      totalOrders: 0,
      totalReturns: 0,
      totalRefunds: 0,
      totalRefundedAmount: 0,
      totalCancelled: 0,
      uniqueCustomers: 0,
      repeatCustomers: 0,
      repeatPurchaseRate: 0,
      conversionRate: safeNumber(product.analytics?.views) > 0
        ? roundMoney((safeNumber(product.analytics?.salesCount) / safeNumber(product.analytics?.views)) * 100)
        : 0,
      returnRate: 0,
      refundRate: 0,
      cancellationRate: 0,
      rtoRate: 0,
      paymentBreakdown: buildEmptyPaymentBreakdown(),
      statusBreakdown: buildEmptyStatusBreakdown(),
      dailyStats: [],
      monthlyStats: [],
      lastSoldAt: null,
    });

    await ProductAnalytics.updateOne(
      { productId: product._id },
      { $setOnInsert: empty, $set: { productDeleted: false, productIsActive: product.isActive !== false, productStatus: product.status || "", categoryName: product.category || "", productName: product.name || "" } },
      { upsert: true }
    );
    return await ProductAnalytics.findOne({ productId: product._id }).lean();
  }

  async markProductDeleted(productId) {
    if (!productId) return null;
    return await ProductAnalytics.findOneAndUpdate(
      { productId },
      {
        $set: {
          productDeleted: true,
          productIsActive: false,
          lastComputedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    ).lean();
  }

  async refreshProductAnalytics(productId) {
    if (!productId || !mongoose.isValidObjectId(productId)) return null;
    const product = await Product.findById(productId).lean();
    if (!product) {
      await this.markProductDeleted(productId);
      return await ProductAnalytics.findOne({ productId }).lean();
    }

    const orders = await Order.find({ "items.productId": productId })
      .select("_id createdAt updatedAt userId items subtotal status paymentMethod")
      .lean();
    const orderIds = orders.map((order) => order._id);
    const [refunds, returns] = await Promise.all([
      orderIds.length
        ? Refund.find({ orderId: { $in: orderIds }, status: { $in: ["PENDING", "PROCESSED"] } })
          .select("orderId amount status createdAt")
          .lean()
        : [],
      orderIds.length
        ? ReturnRequest.find({ orderId: { $in: orderIds } })
          .select("orderId status refundAmount createdAt")
          .lean()
        : [],
    ]);

    const refundsByOrderId = refunds.reduce((map, refund) => {
      const key = String(refund.orderId);
      const list = map.get(key) || [];
      list.push(refund);
      map.set(key, list);
      return map;
    }, new Map());
    const returnsByOrderId = returns.reduce((map, request) => map.set(String(request.orderId), request), new Map());

    const summary = buildLifecycleSummaryFromOrders(product, orders, refundsByOrderId, returnsByOrderId);
    const nextDoc = buildProductAnalyticsDocument(product, summary);

    await ProductAnalytics.updateOne(
      { productId },
      { $set: nextDoc },
      { upsert: true }
    );

    return await ProductAnalytics.findOne({ productId }).lean();
  }

  async refreshForProductIds(productIds = []) {
    const normalized = [...new Set((productIds || []).map((id) => String(id)).filter((id) => mongoose.isValidObjectId(id)))];
    const results = [];
    for (const productId of normalized) {
      results.push(await this.refreshProductAnalytics(productId));
    }
    return results;
  }

  async refreshForOrder(orderId) {
    if (!orderId || !mongoose.isValidObjectId(orderId)) return [];
    const order = await Order.findById(orderId).select("items.productId").lean();
    if (!order) return [];
    const productIds = (order.items || []).map((item) => item.productId?._id || item.productId);
    return await this.refreshForProductIds(productIds);
  }

  async refreshForReturn(returnId) {
    if (!returnId || !mongoose.isValidObjectId(returnId)) return [];
    const request = await ReturnRequest.findById(returnId).select("orderId").lean();
    if (!request?.orderId) return [];
    return await this.refreshForOrder(request.orderId);
  }

  async refreshForRefund(refundId) {
    if (!refundId || !mongoose.isValidObjectId(refundId)) return [];
    const refund = await Refund.findById(refundId).select("orderId").lean();
    if (!refund?.orderId) return [];
    return await this.refreshForOrder(refund.orderId);
  }

  async listAnalyticsDocs(filters = {}) {
    const query = {};
    if (filters.categoryId && mongoose.isValidObjectId(filters.categoryId)) query.categoryId = filters.categoryId;
    if (filters.productId && mongoose.isValidObjectId(filters.productId)) query.productId = filters.productId;
    if (filters.includeDeleted !== true) query.productDeleted = { $ne: true };
    return await ProductAnalytics.find(query).sort({ totalRevenue: -1, totalUnitsSold: -1, updatedAt: -1 }).lean();
  }

  async getAdminDashboard(filters = {}) {
    const docs = await this.listAnalyticsDocs(filters);
    const items = docs.map((doc) => summarizeDocForRange(doc, filters));
    const overview = buildOverview(items);
    const categoryPerformance = buildCategoryPerformance(items);
    const topSellingProducts = [...items].sort((a, b) => b.totalUnitsSold - a.totalUnitsSold).slice(0, 10);
    const lowestSellingProducts = [...items].sort((a, b) => a.totalUnitsSold - b.totalUnitsSold).slice(0, 10);
    const highestRevenueProducts = [...items].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10);
    const highestReturnProducts = [...items].sort((a, b) => b.returnRate - a.returnRate).slice(0, 10);
    const mostRefundedProducts = [...items].sort((a, b) => b.totalRefundedAmount - a.totalRefundedAmount).slice(0, 10);
    const inventoryMovement = [...items]
      .map((item) => ({ ...item, inventory: buildInventoryInsight(item) }))
      .sort((a, b) => b.inventory.stockVelocity - a.inventory.stockVelocity)
      .slice(0, 20);

    return {
      scope: "admin",
      filters: {
        range: filters.range || "",
        startDate: filters.startDate || "",
        endDate: filters.endDate || "",
        categoryId: filters.categoryId || "",
        paymentMethod: filters.paymentMethod || "",
        orderStatus: filters.orderStatus || "",
      },
      overview: {
        ...overview,
        topProduct: highestRevenueProducts[0] || null,
      },
      insights: deriveInsightRows(items),
      salesOverview: buildAggregateTrend(docs, filters, "monthly"),
      topProducts: highestRevenueProducts.map(toLegacyProductCard),
      topSellingProducts,
      lowestSellingProducts,
      highestRevenueProducts: highestRevenueProducts.map(toLegacyProductCard),
      highestReturnProducts,
      mostRefundedProducts,
      inventoryMovement,
      categoryPerformance,
      productRows: items.slice(0, 100),
    };
  }

  async getProductDetail(productId, filters = {}) {
    if (!mongoose.isValidObjectId(productId)) {
      throw new AppError("Invalid product id", 400, "VALIDATION_ERROR");
    }

    let doc = await ProductAnalytics.findOne({ productId }).lean();
    if (!doc) {
      doc = await this.refreshProductAnalytics(productId);
    }
    if (!doc) {
      throw new AppError("Product analytics not found", 404, "NOT_FOUND");
    }

    const summary = summarizeDocForRange(doc, filters);
    return {
      product: {
        productId: doc.productId,
        categoryId: doc.categoryId,
        productName: doc.productName,
        categoryName: doc.categoryName,
        sku: doc.sku,
        productNumber: doc.productNumber,
        productStatus: doc.productStatus,
        productDeleted: doc.productDeleted,
      },
      summary,
      inventory: buildInventoryInsight(summary),
      trends: {
        daily: getTrendSeries(doc, "daily", filters),
        monthly: getTrendSeries(doc, "monthly", filters),
      },
      paymentBreakdown: summary.paymentBreakdown,
      statusBreakdown: summary.statusBreakdown,
    };
  }

  async buildExportRows({ filters = {} } = {}) {
    const data = await this.getAdminDashboard(filters);

    return (data.productRows || []).map((row) => ({
      Product: row.productName,
      Category: row.categoryName || "",
      Revenue: roundMoney(row.totalRevenue || 0),
      NetRevenue: roundMoney(row.totalNetRevenue || 0),
      UnitsSold: safeNumber(row.totalUnitsSold),
      Orders: safeNumber(row.totalOrders),
      Returns: safeNumber(row.totalReturns),
      Refunds: safeNumber(row.totalRefunds),
      RefundAmount: roundMoney(row.totalRefundedAmount || 0),
      Cancelled: safeNumber(row.totalCancelled),
      ReturnRate: `${safeNumber(row.returnRate).toFixed(2)}%`,
      RefundRate: `${safeNumber(row.refundRate).toFixed(2)}%`,
      ConversionRate: `${safeNumber(row.conversionRate).toFixed(2)}%`,
      CurrentStock: safeNumber(row.currentStock),
      AvailableStock: safeNumber(row.availableStock),
      StockVelocity: safeNumber(row.stockVelocity),
      EstimatedStockoutDays: safeNumber(row.estimatedDaysToStockout),
      Status: row.productStatus || "",
    }));
  }
}

module.exports = new ProductAnalyticsService();
module.exports.__private__ = {
  buildEmptyBucket,
  cloneBucket,
  addBucketMetrics,
  resolveRange,
  summarizeDocForRange,
  buildCategoryPerformance,
  buildOverview,
  buildLifecycleSummaryFromOrders,
  getTrendSeries,
};
