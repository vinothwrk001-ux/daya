const bcrypt = require("bcryptjs");
const { AppError } = require("../utils/AppError");
const userRepo = require("../repositories/user.repository");
const productRepo = require("../repositories/product.repository");
const orderRepo = require("../repositories/order.repository");
const { ORDER_STATUS, PAYMENT_STATUS } = require("../models/Order");
const { Review } = require("../models/Review");
const { Product } = require("../models/Product");
const auditService = require("./audit.service");
const productService = require("./product.service");
const inventoryService = require("./inventory.service");
const { queueWhatsAppMessage } = require("./whatsapp.service");
const { logger } = require("../utils/logger");
const { getShippingModesConfig, updateShippingModesConfig } = require("./shipping-config.service");
const { normalizeShippingMode } = require("./shipping.service");
const productAnalyticsService = require("./product-analytics.service");
const cancellationRefundService = require("./cancellation-refund.service");

function resolveGlobalShippingModes(configValue = {}) {
  const modes = [];
  if (configValue.selfShipping) modes.push("SELF");
  if (configValue.platformShipping) modes.push("PLATFORM");
  return modes.length ? modes : ["SELF"];
}

async function getDashboardOverview() {
  const [totalUsers, totalOrders, revenue, pendingProducts] = await Promise.all([
    userRepo.countUsers({ role: "user" }),
    orderRepo.countDocuments(),
    orderRepo.sumRevenue(),
    productRepo.countDocuments({ status: "PENDING" }),
  ]);

  return {
    totals: {
      users: totalUsers,
      orders: totalOrders,
      revenue,
    },
    queues: {
      pendingProducts,
    },
  };
}

async function getAnalytics({ range, startDate, endDate, categoryId, paymentMethod, orderStatus } = {}) {
  return await productAnalyticsService.getAdminDashboard({
    range,
    startDate,
    endDate,
    categoryId,
    paymentMethod,
    orderStatus,
  });
}

async function getProductAnalyticsDetail(productId, filters = {}) {
  return await productAnalyticsService.getProductDetail(productId, filters);
}

async function getDailyRevenue(days = 7) {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
  const orders = await orderRepo.findWithDateRange(startDate, endDate);

  const dailyData = {};
  for (let i = 0; i < days; i += 1) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split("T")[0];
    dailyData[dateStr] = { date: dateStr, revenue: 0, orders: 0 };
  }

  for (const order of orders) {
    const dateStr = order.createdAt.toISOString().split("T")[0];
    if (dailyData[dateStr]) {
      if (["Delivered", "Shipped", "Packed"].includes(order.status)) {
        dailyData[dateStr].revenue += order.totalAmount || 0;
      }
      dailyData[dateStr].orders += 1;
    }
  }

  return Object.values(dailyData).sort((a, b) => new Date(a.date) - new Date(b.date));
}

async function listUsers({ role, startDate, endDate } = {}) {
  const safeRole = role === "user" ? role : undefined;
  return await userRepo.listUsers({ role: safeRole, startDate, endDate });
}

async function createUser(payload = {}, actor, meta) {
  const name = String(payload.name || "").trim();
  const email = payload.email ? String(payload.email).trim().toLowerCase() : "";
  const phone = String(payload.phone || "").trim();
  const password = String(payload.password || "");

  if (!name) throw new AppError("Name is required", 400, "VALIDATION_ERROR");
  if (!phone) throw new AppError("Phone is required", 400, "VALIDATION_ERROR");
  if (phone.length !== 10) throw new AppError("Phone must be 10 digits", 400, "VALIDATION_ERROR");
  if (password.length < 6) throw new AppError("Password must be at least 6 characters", 400, "VALIDATION_ERROR");

  const existingPhone = await userRepo.findByPhone(phone);
  if (existingPhone) throw new AppError("Phone already in use", 409, "PHONE_EXISTS");

  if (email) {
    const existingEmail = await userRepo.findByEmail(email);
    if (existingEmail) throw new AppError("Email already in use", 409, "EMAIL_EXISTS");
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await userRepo.createUser({
    name,
    email: email || null,
    phone,
    password: hashedPassword,
    role: "user",
    status: "active",
  });

  await auditService.log({
    actor,
    action: "admin.user.created",
    entityType: "User",
    entityId: user._id,
    metadata: { role: "user" },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return user;
}

async function listAuditLogs(filters = {}) {
  return await auditService.list(filters);
}

async function setUserStatus(userId, status, actor, meta) {
  if (!["active", "disabled"].includes(status)) {
    throw new AppError("Invalid user status", 400, "VALIDATION_ERROR");
  }
  const user = await userRepo.updateById(userId, { status });
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
  await auditService.log({
    actor,
    action: "admin.user.status_updated",
    entityType: "User",
    entityId: user._id,
    metadata: { status },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });
  return user;
}

async function toggleUserBlocked(userId, actor, meta) {
  const user = await userRepo.findById(userId);
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
  if (["admin", "super_admin", "support_admin", "finance_admin"].includes(user.role)) {
    throw new AppError("Admin accounts cannot be blocked", 400, "INVALID_OPERATION");
  }

  const nextStatus = user.status === "disabled" ? "active" : "disabled";
  const updated = await userRepo.updateById(userId, { status: nextStatus });
  await auditService.log({
    actor,
    action: "admin.user.block_toggled",
    entityType: "User",
    entityId: updated._id,
    metadata: { status: nextStatus },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });
  return updated;
}

async function deleteUser(userId, actor, meta) {
  const user = await userRepo.findById(userId);
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
  if (["admin", "super_admin", "support_admin", "finance_admin"].includes(user.role)) {
    throw new AppError("Admin accounts cannot be deleted", 400, "INVALID_OPERATION");
  }

  await userRepo.deleteById(userId);
  await auditService.log({
    actor,
    action: "admin.user.deleted",
    entityType: "User",
    entityId: userId,
    metadata: { role: user.role },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });
  return { _id: userId };
}

async function resetPlatformData() {
  const mongoose = require("mongoose");
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  const systemCollections = new Set(["system.indexes", "system.profile"]);
  const deletionStats = {
    collectionsCleared: 0,
    deletedDocuments: 0,
  };

  await Promise.all(
    collections.map(async (collectionInfo) => {
      const name = collectionInfo.name;
      if (!name || systemCollections.has(name) || name.startsWith("system.")) return;
      const result = await db.collection(name).deleteMany({});
      deletionStats.collectionsCleared += 1;
      deletionStats.deletedDocuments += result.deletedCount || 0;
    })
  );

  await auditService.log({
    actor: { role: "system" },
    action: "admin.platform.data_reset",
    entityType: "System",
    entityId: null,
    metadata: deletionStats,
  });

  return deletionStats;
}

function resolveVariant(product, variantId = "") {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return null;
  if (!variantId) {
    return (
      variants.find((item) => item.isDefault && item.isActive && item.stock > 0) ||
      variants.find((item) => item.isActive && item.stock > 0) ||
      variants.find((item) => item.isActive) ||
      null
    );
  }
  return variants.find((item) => item.variantId === variantId && item.isActive) || null;
}

function getProductWeightSnapshot(product, variant = null) {
  if (variant?.weight && typeof variant.weight === "object" && Number(variant.weight.value) > 0) {
    return { value: Number(variant.weight.value), unit: variant.weight.unit || "kg" };
  }
  if (product?.weight && typeof product.weight === "object" && Number(product.weight.value) > 0) {
    return { value: Number(product.weight.value), unit: product.weight.unit || "kg" };
  }
  if (typeof product?.weight === "number" && product.weight > 0) {
    return { value: Number(product.weight), unit: "kg" };
  }
  return undefined;
}

async function listOrders(filters = {}) {
  return await orderRepo.list(filters);
}

async function assertAdminInventoryProduct(productId) {
  const product = await productRepo.findById(productId);
  if (!product) throw new AppError("Product not found", 404, "NOT_FOUND");
  if (String(product.creatorType || "").toUpperCase() !== "ADMIN") {
    throw new AppError("Only admin-created products are available in admin inventory", 400, "INVALID_PRODUCT_SCOPE");
  }
  return product;
}

async function getAdminInventorySummary({ page = 1, limit = 20, search = "" } = {}) {
  const result = await productRepo.list({
    page,
    limit,
    creatorType: "ADMIN",
    search,
    sortBy: "createdAt",
    sortOrder: -1,
  });

  const products = [];
  for (const product of result.products || []) {
    products.push(await inventoryService.getProductInventory(product._id));
  }

  return {
    products,
    pagination: result.pagination,
    totals: {
      totalProducts: products.length,
      totalStock: products.reduce((sum, product) => sum + Number(product.totalStock || 0), 0),
      totalReservedStock: products.reduce((sum, product) => sum + Number(product.totalReservedStock || 0), 0),
      totalAvailableStock: products.reduce((sum, product) => sum + Number(product.totalAvailableStock || 0), 0),
      lowStockVariants: products.reduce((sum, product) => sum + Number(product.lowStockVariants || 0), 0),
    },
  };
}

async function getAdminInventoryProduct(productId) {
  await assertAdminInventoryProduct(productId);
  return await inventoryService.getProductInventory(productId);
}

async function getAdminInventoryLedger(productId, variantId, { limit = 20, offset = 0 } = {}) {
  await assertAdminInventoryProduct(productId);
  return await inventoryService.getVariantLedger(productId, variantId, limit, offset);
}

async function adjustAdminInventory(productId, variantId, { quantityChange, reason, notes }, actor) {
  await assertAdminInventoryProduct(productId);
  return await inventoryService.adjustStock(
    productId,
    variantId,
    quantityChange,
    reason,
    notes,
    actor?._id || actor?.sub
  );
}

async function updateAdminInventoryThreshold(productId, variantId, threshold, actor) {
  await assertAdminInventoryProduct(productId);
  return await inventoryService.updateThreshold(productId, variantId, threshold, actor?._id || actor?.sub);
}

function toStoredOrderStatus(value) {
  if (!value) return null;
  const v = String(value).trim();
  const upper = v.toUpperCase().replace(/\s+/g, "_");
  const map = {
    PLACED: "Placed",
    PACKED: "Packed",
    SHIPPED: "Shipped",
    OUT_FOR_DELIVERY: "Out for Delivery",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
    RETURNED: "Returned",
  };
  return map[upper] || v;
}

function toStoredPaymentStatus(value) {
  if (!value) return null;
  const v = String(value).trim();
  const upper = v.toUpperCase();
  const map = { PENDING: "Pending", PAID: "Paid", FAILED: "Failed" };
  return map[upper] || v;
}

function assertValidOrderFlow(currentStatus, nextStatus) {
  const flow = ["Placed", "Packed", "Shipped", "Out for Delivery", "Delivered"];
  const cur = currentStatus === "Pending" ? "Placed" : currentStatus;
  const next = nextStatus === "Pending" ? "Placed" : nextStatus;

  if (next === cur) return;
  if (next === "Cancelled") {
    if (["Delivered", "Returned"].includes(cur)) {
      throw new AppError("Cannot cancel a delivered/returned order", 400, "INVALID_STATUS_FLOW");
    }
    return;
  }
  if (next === "Returned") {
    if (cur !== "Delivered") {
      throw new AppError("Only delivered orders can be returned", 400, "INVALID_STATUS_FLOW");
    }
    return;
  }

  const curIdx = flow.indexOf(cur);
  const nextIdx = flow.indexOf(next);
  if (curIdx < 0 || nextIdx < 0) throw new AppError("Invalid order status transition", 400, "INVALID_STATUS_FLOW");
  if (nextIdx < curIdx) throw new AppError("Order status cannot move backwards", 400, "INVALID_STATUS_FLOW");
}

async function getOrderById(orderId) {
  const order = await orderRepo.findById(orderId);
  if (!order) throw new AppError("Order not found", 404, "NOT_FOUND");
  return order;
}

async function createOrder(payload, actor, meta) {
  const { userId, items, paymentMethod, paymentStatus, orderStatus, shippingMode, address, deliveryDetails } = payload || {};
  if (!userId) throw new AppError("userId is required", 400, "VALIDATION_ERROR");
  if (!Array.isArray(items) || items.length === 0) throw new AppError("items are required", 400, "VALIDATION_ERROR");

  const user = await userRepo.findById(userId);
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");

  const validated = [];
  for (const item of items) {
    const product = await productRepo.findById(item.productId);
    if (!product) throw new AppError("Product not found", 404, "NOT_FOUND");
    const quantity = Number(item.quantity || 0);
    if (!Number.isFinite(quantity) || quantity < 1) throw new AppError("Invalid quantity", 400, "VALIDATION_ERROR");
    const variant = resolveVariant(product, item.variantId);
    const availableStock = variant ? Number(variant.stock || 0) : Number(product.stock || 0);
    if (availableStock < quantity) throw new AppError(`Insufficient stock: ${product.name}`, 400, "INSUFFICIENT_STOCK");

    const price = Number(variant?.discountPrice || variant?.price || product.discountPrice || product.price || 0);
    validated.push({
      productId: product._id,
      name: product.name,
      price,
      quantity,
      image:
        variant?.images?.find((image) => image.isPrimary)?.url ||
        variant?.images?.[0]?.url ||
        (Array.isArray(product.images) && product.images.length ? product.images[0]?.url : undefined),
      variantId: variant?.variantId || item.variantId || "",
      variantSku: variant?.sku || "",
      variantTitle: variant?.title || "",
      variantAttributes: variant?.attributes || {},
      weight: getProductWeightSnapshot(product, variant),
    });
  }

  for (const item of validated) {
    await productService.recordSale(item.productId, item.quantity, item.price * item.quantity, item.variantId);
  }

  const storedStatus = toStoredOrderStatus(orderStatus || "PLACED") || "Placed";
  const storedPaymentStatus = toStoredPaymentStatus(paymentStatus || "PENDING") || "Pending";
  if (!ORDER_STATUS.includes(storedStatus)) throw new AppError("Invalid order status", 400, "VALIDATION_ERROR");
  if (!PAYMENT_STATUS.includes(storedPaymentStatus)) throw new AppError("Invalid payment status", 400, "VALIDATION_ERROR");
  if (!["ONLINE", "COD"].includes(paymentMethod)) throw new AppError("Invalid payment method", 400, "VALIDATION_ERROR");

  const subtotal = validated.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const orderNumber = `ORD-${Date.now()}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
  const order = await orderRepo.createOne({
    orderNumber,
    userId,
    items: validated,
    subtotal,
    shippingFee: 0,
    taxAmount: 0,
    totalAmount: subtotal,
    currency: "INR",
    status: storedStatus,
    paymentStatus: storedPaymentStatus,
    paymentMethod,
    shippingMode: normalizeShippingMode(shippingMode, "SELF"),
    shippingStatus: deliveryDetails?.trackingId ? "SHIPPED" : "NOT_SHIPPED",
    pickupStatus: "NOT_REQUESTED",
    shippingAddress: address,
    deliveryPartner: deliveryDetails?.partner,
    courierName: deliveryDetails?.courierName,
    trackingId: deliveryDetails?.trackingId,
    trackingUrl: deliveryDetails?.trackingUrl,
    timeline: [{ status: storedStatus, note: "Order created by admin" }],
    isActive: true,
  });

  await auditService.log({
    actor,
    action: "admin.order.created",
    entityType: "Order",
    entityId: order._id,
    metadata: { userId: String(userId) },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });
  await productAnalyticsService.refreshForOrder(order._id);
  return { orders: [order] };
}

async function updateOrder(orderId, patch, actor, meta) {
  const oldOrder = await orderRepo.findById(orderId);
  if (!oldOrder) throw new AppError("Order not found", 404, "NOT_FOUND");

  const nextStatus = patch?.orderStatus ? toStoredOrderStatus(patch.orderStatus) : null;
  if (nextStatus === "Cancelled") {
    const result = await cancellationRefundService.processOrderCancellation({
      orderId,
      actor,
      meta,
      reason: patch?.reason || "Cancelled by admin",
      notes: patch?.notes,
      previewOnly: false,
    });
    return result.order;
  }

  const deliveryDetails = patch?.deliveryDetails;
  const nextShippingMode = patch?.shippingMode ? normalizeShippingMode(patch.shippingMode, oldOrder.shippingMode || "SELF") : null;

  if (nextStatus && !ORDER_STATUS.includes(nextStatus)) throw new AppError("Invalid order status", 400, "VALIDATION_ERROR");
  if (nextStatus) assertValidOrderFlow(oldOrder.status, nextStatus);

  const updateData = {};
  if (nextStatus) updateData.status = nextStatus;
  if (nextShippingMode) updateData.shippingMode = nextShippingMode;
  if (deliveryDetails) {
    if (deliveryDetails.trackingId !== undefined) updateData.trackingId = deliveryDetails.trackingId?.trim() || undefined;
    if (deliveryDetails.partner !== undefined) updateData.deliveryPartner = deliveryDetails.partner?.trim() || undefined;
    if (deliveryDetails.courierName !== undefined) updateData.courierName = deliveryDetails.courierName?.trim() || undefined;
    if (deliveryDetails.trackingUrl !== undefined) updateData.trackingUrl = deliveryDetails.trackingUrl?.trim() || undefined;
    updateData.courierAssignedByRole = "ADMIN";
    updateData.courierAssignedById = actor?.sub || actor?._id;
    updateData.courierAssignedAt = new Date();
  }

  const nextTrackingId = updateData.trackingId !== undefined ? updateData.trackingId : oldOrder.trackingId;
  const nextTrackingUrl = updateData.trackingUrl !== undefined ? updateData.trackingUrl : oldOrder.trackingUrl;
  const hadTrackingAssigned = Boolean(oldOrder.trackingId && oldOrder.trackingUrl);
  const hasTrackingAssignedNow = Boolean(nextTrackingId && nextTrackingUrl);
  const isFirstTrackingAssignment = !hadTrackingAssigned && hasTrackingAssignedNow;

  if (isFirstTrackingAssignment) {
    updateData.trackingAssignedAt = new Date();
    updateData.deliveryStatus = "SHIPPED";
    updateData.shippingStatus = nextShippingMode === "PLATFORM" ? "IN_TRANSIT" : "SHIPPED";
    if (!nextStatus && !["Shipped", "Out for Delivery", "Delivered", "Returned", "Cancelled"].includes(oldOrder.status)) {
      updateData.status = "Shipped";
    }
  }

  const updated = await orderRepo.updateById(orderId, updateData);
  await productAnalyticsService.refreshForOrder(orderId);

  const shouldSendWhatsApp = Boolean(
    isFirstTrackingAssignment &&
      updated?.trackingId &&
      updated?.trackingUrl &&
      !updated?.whatsappSent
  );

  if (shouldSendWhatsApp) {
    const recipientPhone = resolveShipmentPhone(updated);
    if (recipientPhone) {
      const fallbackBody = [
        "Your order has been shipped!",
        "",
        `Order ID: ${updated.orderNumber || updated._id}`,
        `Tracking ID: ${updated.trackingId}`,
        `Track here: ${updated.trackingUrl}`,
        "",
        "Thank you for shopping with us.",
      ].join("\n");

      const message = process.env.TWILIO_ORDER_SHIPPED_CONTENT_SID
        ? {
            contentSid: process.env.TWILIO_ORDER_SHIPPED_CONTENT_SID,
            contentVariables: {
              1: updated.orderNumber || String(updated._id),
              2: updated.trackingId,
              3: updated.trackingUrl,
            },
            fallbackBody,
          }
        : fallbackBody;

      queueWhatsAppMessage(
        recipientPhone,
        message,
        {
          orderId: String(updated._id),
          orderNumber: updated.orderNumber,
          userId: String(updated.userId?._id || ""),
          recipientPhone,
        },
        {
          onSuccess: async () => {
            await orderRepo.markWhatsAppSent(orderId);
          },
          onError: async (error) => {
            logger.error("Failed to send shipment WhatsApp notification", {
              orderId,
              orderNumber: updated.orderNumber,
              recipientPhone,
              error: error.message,
            });
          },
        }
      );
    }
  }

  await auditService.log({
    actor,
    action: "admin.order.updated",
    entityType: "Order",
    entityId: updated._id,
    metadata: {
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(nextShippingMode ? { shippingMode: nextShippingMode } : {}),
      ...(deliveryDetails ? { deliveryDetails } : {}),
      ...(shouldSendWhatsApp ? { whatsappTriggered: true } : {}),
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });
  return shouldSendWhatsApp ? { ...updated.toObject(), whatsappSent: true } : updated;
}

async function getShippingModes(actor) {
  void actor;
  return await getShippingModesConfig();
}

async function saveShippingModes(payload, actor, meta) {
  const config = await updateShippingModesConfig(payload || {}, actor?.sub || actor?._id);
  await auditService.log({
    actor,
    action: "admin.shipping.modes_updated",
    entityType: "PlatformConfig",
    entityId: config.key,
    metadata: {
      ...config.value,
      enabledModes: resolveGlobalShippingModes(config.value),
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });
  return config;
}

function resolveShipmentPhone(order) {
  return order?.shippingAddress?.phone || order?.userId?.phone || "";
}

async function softDeleteOrder(orderId, actor, meta) {
  const order = await orderRepo.findById(orderId);
  if (!order) throw new AppError("Order not found", 404, "NOT_FOUND");
  const updated = await orderRepo.softDeleteById(orderId, { note: "Soft deleted by admin" });
  await auditService.log({
    actor,
    action: "admin.order.deleted",
    entityType: "Order",
    entityId: updated._id,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });
  return updated;
}

async function updateOrderStatus(orderId, status, actor, meta) {
  if (!ORDER_STATUS.includes(status)) throw new AppError("Invalid order status", 400, "VALIDATION_ERROR");
  if (status === "Cancelled") {
    const result = await cancellationRefundService.processOrderCancellation({
      orderId,
      actor,
      meta,
      reason: "Cancelled by admin",
    });
    return result.order;
  }

  const order = await orderRepo.findById(orderId);
  if (!order) throw new AppError("Order not found", 404, "NOT_FOUND");
  assertValidOrderFlow(order.status, status);

  const shippingUpdate = {};
  if (status === "Shipped") shippingUpdate.shippingStatus = "SHIPPED";
  if (status === "Out for Delivery") shippingUpdate.shippingStatus = "OUT_FOR_DELIVERY";
  if (status === "Delivered") shippingUpdate.shippingStatus = "DELIVERED";
  const updated = await orderRepo.updateById(orderId, { status, ...shippingUpdate });
  await productAnalyticsService.refreshForOrder(orderId);
  await auditService.log({
    actor,
    action: "admin.order.status_updated",
    entityType: "Order",
    entityId: updated._id,
    metadata: { status },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });
  return updated;
}

async function recomputeProductRatings(productId) {
  const reviews = await Review.find({ productId }).select("rating").lean();
  const totalReviews = reviews.length;
  const breakdown = { five: 0, four: 0, three: 0, two: 0, one: 0 };

  for (const review of reviews) {
    const value = Number(review.rating);
    if (value === 5) breakdown.five += 1;
    if (value === 4) breakdown.four += 1;
    if (value === 3) breakdown.three += 1;
    if (value === 2) breakdown.two += 1;
    if (value === 1) breakdown.one += 1;
  }

  const averageRating =
    totalReviews === 0
      ? 0
      : Number((reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / totalReviews).toFixed(1));

  await Product.findByIdAndUpdate(productId, {
    $set: {
      "ratings.averageRating": averageRating,
      "ratings.totalReviews": totalReviews,
      "ratings.ratingBreakdown": breakdown,
    },
  });
}

async function listReviews({ search } = {}) {
  const reviews = await Review.find({})
    .populate("productId", "name")
    .populate("userId", "name")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const normalizedSearch = String(search || "").trim().toLowerCase();
  if (!normalizedSearch) return reviews;

  return reviews.filter((review) =>
    [review.productId?.name, review.userId?.name, review.title, review.comment]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch))
  );
}

async function deleteReview(reviewId, actor, meta) {
  const review = await Review.findByIdAndDelete(reviewId).lean();
  if (!review) throw new AppError("Review not found", 404, "NOT_FOUND");

  await recomputeProductRatings(review.productId);
  await auditService.log({
    actor,
    action: "admin.review.deleted",
    entityType: "Review",
    entityId: reviewId,
    metadata: { productId: review.productId, userId: review.userId },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return { _id: reviewId };
}

module.exports = {
  getDashboardOverview,
  getAnalytics,
  getProductAnalyticsDetail,
  getDailyRevenue,
  getAdminInventorySummary,
  getAdminInventoryProduct,
  getAdminInventoryLedger,
  adjustAdminInventory,
  updateAdminInventoryThreshold,
  listUsers,
  createUser,
  listAuditLogs,
  setUserStatus,
  toggleUserBlocked,
  deleteUser,
  listOrders,
  getOrderById,
  createOrder,
  updateOrder,
  getShippingModes,
  saveShippingModes,
  softDeleteOrder,
  updateOrderStatus,
  resetPlatformData,
  listReviews,
  deleteReview,
};
