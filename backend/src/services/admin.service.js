const bcrypt = require("bcryptjs");
const { AppError } = require("../utils/AppError");
const vendorRepo = require("../repositories/vendor.repository");
const userRepo = require("../repositories/user.repository");
const productRepo = require("../repositories/product.repository");
const orderRepo = require("../repositories/order.repository");
const { ORDER_STATUS, PAYMENT_STATUS } = require("../models/Order");
const { Payout } = require("../models/Payout");
const { Review } = require("../models/Review");
const { Product } = require("../models/Product");
const auditService = require("./audit.service");
const productService = require("./product.service");
const inventoryService = require("./inventory.service");
const { queueWhatsAppMessage } = require("./whatsapp.service");
const { logger } = require("../utils/logger");
const { getCommissionPercentage } = require("./finance-config.service");
const payoutService = require("./payout.service");
const { getShippingModesConfig, updateShippingModesConfig } = require("./shipping-config.service");
const { normalizeShippingMode } = require("./shipping.service");
const notificationService = require("./notification.service");
const productAnalyticsService = require("./product-analytics.service");
const cancellationRefundService = require("./cancellation-refund.service");

function resolveGlobalShippingModes(configValue = {}) {
  const modes = [];
  if (configValue.selfShipping) modes.push("SELF");
  if (configValue.platformShipping) modes.push("PLATFORM");
  return modes.length ? modes : ["SELF"];
}

async function getDashboardOverview() {
  const [totalUsers, totalSellers, totalOrders, revenue, pendingProducts, pendingSellers] = await Promise.all([
    userRepo.countUsers({ role: "user" }),
    vendorRepo.countVendors(),
    orderRepo.countDocuments(),
    orderRepo.sumRevenue(),
    productRepo.countDocuments({ status: "PENDING" }),
    vendorRepo.countVendors({ status: "pending" }),
  ]);

  return {
    totals: {
      users: totalUsers,
      sellers: totalSellers,
      orders: totalOrders,
      revenue,
    },
    queues: {
      pendingProducts,
      pendingSellers,
    },
  };
}

const { normalizeDateRange, applyDateRange } = require("../utils/dateRange");

async function getAnalytics({ range, startDate, endDate, vendorId, categoryId, paymentMethod, orderStatus } = {}) {
  return await productAnalyticsService.getAdminDashboard({
    range,
    startDate,
    endDate,
    vendorId,
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

  // Group by day
  const dailyData = {};
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split("T")[0];
    dailyData[dateStr] = { date: dateStr, revenue: 0, orders: 0 };
  }

  // Populate data from orders
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

async function listVendors({ status, startDate, endDate } = {}) {
  return await vendorRepo.listVendors({ status, startDate, endDate });
}

async function getVendorDetails(vendorId) {
  const vendor = await vendorRepo.findById(vendorId);
  if (!vendor) throw new AppError("Vendor not found", 404, "NOT_FOUND");
  return vendor;
}

async function listUsers({ role, startDate, endDate } = {}) {
  return await userRepo.listUsers({ role, startDate, endDate });
}

async function createUser(payload = {}, actor, meta) {
  const name = String(payload.name || "").trim();
  const email = payload.email ? String(payload.email).trim().toLowerCase() : "";
  const phone = String(payload.phone || "").trim();
  const password = String(payload.password || "");
  const role = payload.role === "vendor" ? "vendor" : "user";

  if (!name) throw new AppError("Name is required", 400, "VALIDATION_ERROR");
  if (!phone) throw new AppError("Phone is required", 400, "VALIDATION_ERROR");
  if (phone.length !== 10) throw new AppError("Phone must be 10 digits", 400, "VALIDATION_ERROR");
  if (password.length < 6) throw new AppError("Password must be at least 6 characters", 400, "VALIDATION_ERROR");
  if (role === "vendor" && !email) throw new AppError("Email is required for vendors", 400, "VALIDATION_ERROR");

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
    role,
    status: "active",
  });

  await auditService.log({
    actor,
    action: "admin.user.created",
    entityType: "User",
    entityId: user._id,
    metadata: { role },
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

  const vendor = user.role === "vendor" ? await vendorRepo.findByUserId(userId) : null;
  if (vendor) {
    await vendorRepo.deleteById(vendor._id);
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

async function approveVendor(vendorId, actor, meta) {
  const vendor = await vendorRepo.findById(vendorId);
  if (!vendor) throw new AppError("Vendor not found", 404, "NOT_FOUND");
  if (vendor.status === "approved") return vendor;

  const updated = await vendorRepo.updateById(vendorId, {
    status: "approved",
    rejectionReason: null,
  });
  await auditService.log({
    actor,
    action: "admin.vendor.approved",
    entityType: "Vendor",
    entityId: updated._id,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });
  return updated;
}

async function rejectVendor(vendorId, { reason } = {}, actor, meta) {
  const vendor = await vendorRepo.findById(vendorId);
  if (!vendor) throw new AppError("Vendor not found", 404, "NOT_FOUND");

  const updated = await vendorRepo.updateById(vendorId, {
    status: "rejected",
    rejectionReason: reason || "Rejected by admin",
  });
  await auditService.log({
    actor,
    action: "admin.vendor.rejected",
    entityType: "Vendor",
    entityId: updated._id,
    metadata: { reason: reason || "Rejected by admin" },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });
  return updated;
}

async function removeVendor(vendorId, actor, meta) {
  const vendor = await vendorRepo.findById(vendorId);
  if (!vendor) throw new AppError("Vendor not found", 404, "NOT_FOUND");

  const userId = vendor.userId?._id || vendor.userId;
  if (!userId) throw new AppError("Linked user not found", 500, "INTERNAL_ERROR");

  await vendorRepo.deleteById(vendorId);

  const updatedUser = await userRepo.updateById(userId, { role: "user" });
  if (!updatedUser) throw new AppError("Linked user not found", 404, "NOT_FOUND");

  await auditService.log({
    actor,
    action: "admin.vendor.removed",
    entityType: "Vendor",
    entityId: vendorId,
    metadata: { linkedUserId: String(userId) },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });
  return { user: updatedUser };
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
      if (!name || systemCollections.has(name) || name.startsWith("system.")) {
        return;
      }

      const collection = db.collection(name);
      const result = await collection.deleteMany({});
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
    return {
      value: Number(variant.weight.value),
      unit: variant.weight.unit || "kg",
    };
  }
  if (product?.weight && typeof product.weight === "object" && Number(product.weight.value) > 0) {
    return {
      value: Number(product.weight.value),
      unit: product.weight.unit || "kg",
    };
  }
  if (typeof product?.weight === "number" && product.weight > 0) {
    return {
      value: Number(product.weight),
      unit: "kg",
    };
  }
  return undefined;
}

async function listOrders(filters = {}) {
  return await orderRepo.list(filters);
}

async function assertAdminInventoryProduct(productId) {
  const product = await productRepo.findById(productId);
  if (!product) {
    throw new AppError("Product not found", 404, "NOT_FOUND");
  }
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
  if (map[upper]) return map[upper];
  // allow existing stored labels too
  return v;
}

function toStoredPaymentStatus(value) {
  if (!value) return null;
  const v = String(value).trim();
  const upper = v.toUpperCase();
  const map = { PENDING: "Pending", PAID: "Paid", FAILED: "Failed" };
  if (map[upper]) return map[upper];
  return v;
}

function assertValidOrderFlow(currentStatus, nextStatus) {
  // enforce monotonic forward flow; allow Cancelled/Returned from certain states
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
  if (curIdx < 0 || nextIdx < 0) {
    throw new AppError("Invalid order status transition", 400, "INVALID_STATUS_FLOW");
  }
  if (nextIdx < curIdx) {
    throw new AppError("Order status cannot move backwards", 400, "INVALID_STATUS_FLOW");
  }
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

  // Validate products, compute totals, resolve seller, and decrement stock
  const validated = [];
  for (const it of items) {
    const product = await productRepo.findById(it.productId);
    if (!product) throw new AppError("Product not found", 404, "NOT_FOUND");
    const qty = Number(it.quantity || 0);
    if (!Number.isFinite(qty) || qty < 1) throw new AppError("Invalid quantity", 400, "VALIDATION_ERROR");
    const variant = resolveVariant(product, it.variantId);
    const availableStock = variant ? Number(variant.stock || 0) : Number(product.stock || 0);
    if (availableStock < qty) throw new AppError(`Insufficient stock: ${product.name}`, 400, "INSUFFICIENT_STOCK");

    // Resolve sellerId for admin-created products
    let sellerId = product.sellerId;
    if (!sellerId && product.creatorType === "ADMIN" && product.createdBy?._id) {
      const platformVendor = await vendorRepo.upsertByUserId(product.createdBy._id, {
        status: "approved",
        stepCompleted: 4,
        companyName: "Platform Store",
        shopName: "Platform Store",
        storeDescription: "Products sold directly by the platform.",
      });
      sellerId = platformVendor._id;
    }
    if (!sellerId) throw new AppError("Seller not found for product", 400, "INVALID_PRODUCT");

    const price = Number(variant?.discountPrice || variant?.price || product.discountPrice || product.price || 0);
    validated.push({
      product,
      productId: product._id,
      sellerId,
      name: product.name,
      price,
      quantity: qty,
      image:
        variant?.images?.find((image) => image.isPrimary)?.url ||
        variant?.images?.[0]?.url ||
        (Array.isArray(product.images) && product.images.length ? product.images[0]?.url : undefined),
      variantId: variant?.variantId || it.variantId || "",
      variantSku: variant?.sku || "",
      variantTitle: variant?.title || "",
      variantAttributes: variant?.attributes || {},
      weight: getProductWeightSnapshot(product, variant),
    });
  }

  // decrement stock and record revenue
  for (const it of validated) {
    await productService.recordSale(it.productId, it.quantity, it.price * it.quantity, it.variantId);
  }

  // group by seller and create one order per seller (consistent with current checkout design)
  const bySeller = new Map();
  for (const it of validated) {
    const key = String(it.sellerId);
    if (!bySeller.has(key)) bySeller.set(key, { sellerId: it.sellerId, items: [] });
    bySeller.get(key).items.push(it);
  }

  const storedStatus = toStoredOrderStatus(orderStatus || "PLACED") || "Placed";
  const storedPaymentStatus = toStoredPaymentStatus(paymentStatus || "PENDING") || "Pending";
  const commissionPercentage = await getCommissionPercentage();
  if (!ORDER_STATUS.includes(storedStatus)) throw new AppError("Invalid order status", 400, "VALIDATION_ERROR");
  if (!PAYMENT_STATUS.includes(storedPaymentStatus)) throw new AppError("Invalid payment status", 400, "VALIDATION_ERROR");
  if (!["ONLINE", "COD"].includes(paymentMethod)) throw new AppError("Invalid payment method", 400, "VALIDATION_ERROR");

  const ordersPayloads = Array.from(bySeller.values()).map((sellerGroup) => {
    const cleanedItems = sellerGroup.items.map((x) => ({
      productId: x.productId,
      name: x.name,
      price: x.price,
      quantity: x.quantity,
      image: x.image,
      variantId: x.variantId,
      variantSku: x.variantSku,
      variantTitle: x.variantTitle,
      variantAttributes: x.variantAttributes,
      weight: x.weight,
    }));
    const subtotal = cleanedItems.reduce((sum, x) => sum + x.price * x.quantity, 0);
    const totalAmount = subtotal;
    const platformCommissionAmount = Number(((totalAmount * commissionPercentage) / 100).toFixed(2));
    const vendorEarning = Number((totalAmount - platformCommissionAmount).toFixed(2));
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;

    return {
      orderNumber,
      userId,
      sellerId: sellerGroup.sellerId,
      items: cleanedItems,
      subtotal,
      shippingFee: 0,
      taxAmount: 0,
      totalAmount,
      platformCommissionRate: commissionPercentage,
      platformCommissionAmount,
      vendorEarning,
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
    };
  });

  const created = await orderRepo.createMany(ordersPayloads);
  await auditService.log({
    actor,
    action: "admin.order.created",
    entityType: "Order",
    entityId: created?.[0]?._id,
    metadata: { count: created.length, userId: String(userId) },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });
  await Promise.all(
    created.map((order) =>
      notificationService.notifyVendorAndOperations({
        vendorId: order.sellerId,
        permissionKey: "orders.read",
        module: "MANAGEMENT",
        subModule: "ORDERS",
        type: "ORDER_CREATED",
        title: "Order created by admin",
        message: `Order ${order.orderNumber} was created from the admin workspace.`,
        referenceId: order._id,
      })
    )
  );
  await Promise.all(created.map((order) => productAnalyticsService.refreshForOrder(order._id)));
  return { orders: created };
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

  if (nextStatus && !ORDER_STATUS.includes(nextStatus)) {
    throw new AppError("Invalid order status", 400, "VALIDATION_ERROR");
  }

  if (nextStatus) {
    assertValidOrderFlow(oldOrder.status, nextStatus);
  }

  const updateData = {};
  if (nextStatus) updateData.status = nextStatus;
  if (nextShippingMode) updateData.shippingMode = nextShippingMode;
  if (deliveryDetails) {
    if (deliveryDetails.trackingId !== undefined) updateData.trackingId = deliveryDetails.trackingId?.trim() || undefined;
    if (deliveryDetails.partner !== undefined) updateData.deliveryPartner = deliveryDetails.partner?.trim() || undefined;
    if (deliveryDetails.courierName !== undefined) updateData.courierName = deliveryDetails.courierName?.trim() || undefined;
    if (deliveryDetails.trackingUrl !== undefined) updateData.trackingUrl = deliveryDetails.trackingUrl?.trim() || undefined;
    if (
      deliveryDetails.trackingId !== undefined ||
      deliveryDetails.partner !== undefined ||
      deliveryDetails.courierName !== undefined ||
      deliveryDetails.trackingUrl !== undefined
    ) {
      updateData.courierAssignedByRole = "ADMIN";
      updateData.courierAssignedById = actor?.sub || actor?._id;
      updateData.courierAssignedAt = new Date();
    }
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
  if (updated?.status === "Delivered") {
    await payoutService.markOrderDelivered(updated._id);
  }

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
    } else {
      logger.warn("Skipping WhatsApp shipment notification because no recipient phone is available", {
        orderId: String(updated._id),
        orderNumber: updated.orderNumber,
      });
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
  const enabledModes = resolveGlobalShippingModes(config.value);
  const vendors = await vendorRepo.listAll();

  await Promise.all(
    vendors.map(async (vendor) => {
      const currentSettings = vendor.shippingSettings?.toObject?.() || vendor.shippingSettings || {};
      const nextDefaultMode = enabledModes.includes(currentSettings.defaultShippingMode)
        ? currentSettings.defaultShippingMode
        : enabledModes[0];

      vendor.shippingSettings = {
        ...currentSettings,
        allowedShippingModes: enabledModes,
        defaultShippingMode: nextDefaultMode,
        selfShippingEnabledAt: enabledModes.includes("SELF")
          ? currentSettings.selfShippingEnabledAt || new Date()
          : null,
        platformShippingEnabledAt: enabledModes.includes("PLATFORM")
          ? currentSettings.platformShippingEnabledAt || new Date()
          : null,
      };

      await vendor.save();
    })
  );

  await auditService.log({
    actor,
    action: "admin.shipping.modes_updated",
    entityType: "PlatformConfig",
    entityId: config.key,
    metadata: config.value,
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
  if (!ORDER_STATUS.includes(status)) {
    throw new AppError("Invalid order status", 400, "VALIDATION_ERROR");
  }
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
  if (status === "Delivered") {
    await payoutService.markOrderDelivered(updated._id);
  }
  await auditService.log({
    actor,
    action: "admin.order.status_updated",
    entityType: "Order",
    entityId: updated._id,
    metadata: { status },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });
  await notificationService.notifyVendorAndOperations({
    vendorId: updated.sellerId,
    permissionKey: "orders.read",
    module: "MANAGEMENT",
    subModule: "ORDERS",
    type: "ORDER_STATUS_CHANGED",
    title: "Order status updated",
    message: `Order ${updated.orderNumber} moved to ${status}.`,
    referenceId: updated._id,
    meta: {
      status,
    },
  });
  return updated;
}

async function listPayouts({ status, startDate, endDate } = {}) {
  const match = {};
  if (status) match.status = status;
  applyDateRange(match, normalizeDateRange({ startDate, endDate }));

  const payouts = await Payout.find(match)
    .populate("sellerId", "companyName")
    .populate("orderId", "orderNumber totalAmount status createdAt")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const overview = payouts.reduce(
    (summary, payout) => {
      const amount = Number(payout.amount || 0);
      summary.totalAmount += amount;
      if (["PENDING", "QUEUED", "ON_HOLD"].includes(payout.status)) summary.pendingAmount += amount;
      if (payout.status === "PAID") summary.paidAmount += amount;
      if (payout.status === "FAILED") summary.failedAmount += amount;
      return summary;
    },
    { totalAmount: 0, pendingAmount: 0, paidAmount: 0, failedAmount: 0 }
  );

  return { overview, payouts };
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
  const query = {};

  const reviews = await Review.find(query)
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
  listVendors,
  getVendorDetails,
  listUsers,
  createUser,
  listAuditLogs,
  setUserStatus,
  toggleUserBlocked,
  deleteUser,
  approveVendor,
  rejectVendor,
  removeVendor,
  listOrders,
  getOrderById,
  createOrder,
  updateOrder,
  getShippingModes,
  saveShippingModes,
  softDeleteOrder,
  updateOrderStatus,
  resetPlatformData,
  listPayouts,
  listReviews,
  deleteReview,
};
