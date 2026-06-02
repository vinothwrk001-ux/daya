const { AppError } = require("../../utils/AppError");
const productService = require("../../services/product.service");
const orderRepo = require("../../repositories/order.repository");
const productRepo = require("../../repositories/product.repository");
const vendorRepo = require("../../repositories/vendor.repository");
const { Order } = require("../../models/Order");
const { Payout } = require("../../models/Payout");
const { Product } = require("../../models/Product");
const { VendorNotification } = require("../../models/VendorNotification");
const { Review } = require("../../models/Review");
const { ReturnRequest, RETURN_REQUEST_STATUS } = require("../../models/ReturnRequest");
const { Offer } = require("../../models/Offer");
const { SupportTicket } = require("../../models/SupportTicket");
const { normalizeDateRange, applyDateRange } = require("../../utils/dateRange");
const payoutService = require("../../services/payout.service");
const paymentService = require("../../services/payment.service");
const deliveryService = require("../../services/delivery.service");
const inventoryService = require("../../services/inventory.service");
const {
  assertVendorCanUseShippingMode,
  buildVendorShippingSettingsPayload,
  normalizeShippingMode,
  resolveVendorShippingModes,
} = require("../../services/shipping.service");
const notificationService = require("../../services/notification.service");
const productAnalyticsService = require("../../services/product-analytics.service");

const VENDOR_ORDER_FLOW = ["Placed", "Packed", "Shipped", "Delivered", "Cancelled"];

function normalizePickupLocationEntry(location = {}, { fallbackDefault = false } = {}) {
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const normalized = {
    name: String(location.name || "").trim(),
    phone: String(location.phone || "").trim(),
    addressLine1: String(location.addressLine1 || "").trim(),
    addressLine2: String(location.addressLine2 || "").trim(),
    city: String(location.city || "").trim(),
    state: String(location.state || "").trim(),
    pincode: String(location.pincode || "").trim(),
    country: String(location.country || "India").trim() || "India",
    latitude: Number.isFinite(latitude) ? latitude : undefined,
    longitude: Number.isFinite(longitude) ? longitude : undefined,
    isDefault: location.isDefault === true || fallbackDefault,
  };

  const hasAnyValue = ["name", "phone", "addressLine1", "addressLine2", "city", "state", "pincode", "country"]
    .some((field) => Boolean(normalized[field]))
    || Number.isFinite(normalized.latitude)
    || Number.isFinite(normalized.longitude);

  return hasAnyValue ? normalized : null;
}

function normalizePickupLocationPayload(payload = {}, vendor = null) {
  const rawLocations = Array.isArray(payload.pickupLocations)
    ? payload.pickupLocations
    : (vendor?.pickupLocations?.toObject?.() || vendor?.pickupLocations || []);

  let pickupLocations = rawLocations
    .map((location, index) => normalizePickupLocationEntry(location, { fallbackDefault: index === 0 && rawLocations.length === 1 }))
    .filter(Boolean);

  const payloadPickupAddress = payload.pickupAddress !== undefined ? payload.pickupAddress : vendor?.pickupAddress;
  const normalizedPickupAddress = normalizePickupLocationEntry(payloadPickupAddress || {}, {
    fallbackDefault: pickupLocations.length === 0,
  });

  if (normalizedPickupAddress && pickupLocations.length === 0) {
    pickupLocations = [{ ...normalizedPickupAddress, isDefault: true }];
  }

  if (pickupLocations.length > 0 && !pickupLocations.some((location) => location.isDefault)) {
    pickupLocations[0].isDefault = true;
  }

  const defaultPickupLocation = pickupLocations.find((location) => location.isDefault) || pickupLocations[0] || normalizedPickupAddress || null;

  return {
    pickupAddress: defaultPickupLocation,
    pickupLocations,
  };
}

function normalizePagination(query = {}) {
  return {
    page: Math.max(Number(query.page) || 1, 1),
    limit: Math.min(Math.max(Number(query.limit) || 10, 1), 100),
  };
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

class VendorDashboardService {
  async resolveOwnedProductIds(vendorId, productIds = []) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return [];
    }

    const normalizedIds = [...new Set(productIds.map((id) => String(id)).filter(Boolean))];
    const products = await Product.find({
      _id: { $in: normalizedIds },
      sellerId: vendorId,
    }).select("_id").lean();

    if (products.length !== normalizedIds.length) {
      throw new AppError("Offers can include only this vendor's products", 400, "INVALID_PRODUCT_SCOPE");
    }

    return products.map((product) => product._id);
  }

  async getVendorContext(userId) {
    const vendor = await vendorRepo.findByUserId(userId);
    if (!vendor) {
      throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
    }

    await vendorRepo.updateById(vendor._id, { lastActiveAt: new Date() });
    return vendor;
  }

  async createNotification(vendorId, payload) {
    return await VendorNotification.create({ vendorId, ...payload });
  }

  async getDashboard(userId, query = {}) {
    const vendor = await this.getVendorContext(userId);
    const dashboardDateRange = normalizeDateRange({
      startDate: query.startDate,
      endDate: query.endDate,
    });
    const orderMatch = { sellerId: vendor._id };
    applyDateRange(orderMatch, dashboardDateRange);
    const todayMatch = dashboardDateRange || query.startDate || query.endDate
      ? orderMatch
      : { sellerId: vendor._id, createdAt: { $gte: startOfToday(), $lte: endOfToday() } };

    const [todayOrders, pendingOrders, shippedOrders, revenueAggregate, lowStockProducts, unreadNotifications] = await Promise.all([
      Order.countDocuments(todayMatch),
      Order.countDocuments({ ...orderMatch, status: { $in: ["Pending", "Placed", "Packed"] } }),
      Order.countDocuments({ ...orderMatch, status: "Shipped" }),
      Order.aggregate([
        { $match: { ...orderMatch, status: { $in: ["Shipped", "Delivered"] } } },
        { $group: { _id: null, revenue: { $sum: "$totalAmount" } } },
      ]),
      Product.countDocuments({
        sellerId: vendor._id,
        isActive: true,
        $expr: { $lte: ["$stock", "$lowStockThreshold"] },
      }),
      VendorNotification.countDocuments({ vendorId: vendor._id, isRead: false }),
    ]);

    const [recentOrders, topProducts] = await Promise.all([
      Order.find(orderMatch)
        .sort({ createdAt: -1 })
        .limit(5)
        .select("orderNumber totalAmount status paymentStatus createdAt deliveryStatus"),
      Product.find({ sellerId: vendor._id })
        .sort({ "analytics.totalRevenue": -1, "analytics.salesCount": -1, createdAt: -1 })
        .limit(5)
        .select("name status stock analytics price discountPrice"),
    ]);

      return {
        vendor: {
          id: vendor._id,
          vendorCode: vendor.vendorCode,
          shopName: vendor.shopName,
          companyName: vendor.companyName,
          status: vendor.status,
          payoutSchedule: vendor.payoutSchedule,
        },
      stats: {
        ordersToday: todayOrders,
        pendingOrders,
        shippedOrders,
        totalRevenue: revenueAggregate[0]?.revenue || 0,
        lowStockProducts,
        unreadNotifications,
      },
      recentOrders,
      topProducts,
    };
  }

  async listProducts(userId, query) {
    const vendor = await this.getVendorContext(userId);
    const { page, limit } = normalizePagination(query);
    return await productRepo.list({
      page,
      limit,
      sellerId: vendor._id,
      status: query.status,
      search: query.search,
      sortBy: query.sortBy || "createdAt",
      sortOrder: query.sortOrder === "asc" ? 1 : -1,
      category: query.category,
      startDate: query.startDate,
      endDate: query.endDate,
    });
  }

  async createProduct(userId, payload) {
    const vendor = await this.getVendorContext(userId);
    const product = await productService.createProduct(payload, userId, "seller", vendor._id);
    await this.createNotification(vendor._id, {
      type: "PRODUCT",
      title: "Product submitted",
      message: `${product.name} was submitted for approval.`,
      entityType: "Product",
      entityId: product._id,
    });
    return product;
  }

  async updateProduct(userId, productId, payload) {
    const vendor = await this.getVendorContext(userId);
    const product = await productService.updateProduct(productId, payload, userId, "seller", vendor._id);
    await this.createNotification(vendor._id, {
      type: "PRODUCT",
      title: "Product updated",
      message: `${product.name} was updated.`,
      entityType: "Product",
      entityId: product._id,
    });
    return product;
  }

  async deleteProduct(userId, productId) {
    const vendor = await this.getVendorContext(userId);
    return await productService.deleteProduct(productId, userId, "seller", vendor._id);
  }

  async listOrders(userId, query) {
    const vendor = await this.getVendorContext(userId);
    const { page, limit } = normalizePagination(query);
    return await orderRepo.listBySellerId({
      sellerId: vendor._id,
      page,
      limit,
      status: query.status,
      shippingMode: query.shippingMode,
      shippingStatus: query.shippingStatus,
      pickupStatus: query.pickupStatus,
      sortBy: query.sortBy || "createdAt",
      sortOrder: query.sortOrder === "asc" ? 1 : -1,
      startDate: query.startDate,
      endDate: query.endDate,
    });
  }

  async getOrderById(userId, orderId) {
    const vendor = await this.getVendorContext(userId);
    const order = await Order.findOne({ _id: orderId, sellerId: vendor._id })
      .populate("userId", "name email phone")
      .populate("items.productId", "name")
      .lean();

    if (!order) {
      throw new AppError("Order not found", 404, "NOT_FOUND");
    }

    return order;
  }

  async updateOrderStatus(userId, orderId, status) {
    const vendor = await this.getVendorContext(userId);
    if (!VENDOR_ORDER_FLOW.includes(status)) {
      throw new AppError("Invalid vendor order status", 400, "VALIDATION_ERROR");
    }

    const order = await Order.findById(orderId);
    if (!order || String(order.sellerId) !== String(vendor._id)) {
      throw new AppError("Order not found", 404, "NOT_FOUND");
    }

    const allowedTransitions = {
      Pending: ["Placed", "Packed", "Cancelled"],
      Placed: ["Packed", "Cancelled"],
      Packed: ["Shipped", "Cancelled"],
      Shipped: ["Delivered"],
      Delivered: [],
      Cancelled: [],
    };

    const nextAllowed = allowedTransitions[order.status] || [];
    if (!nextAllowed.includes(status)) {
      throw new AppError(`Cannot change order from ${order.status} to ${status}`, 400, "INVALID_STATUS_TRANSITION");
    }

    if (status === "Shipped") {
      order.shippingStatus = "SHIPPED";
      if (!order.inventoryCommittedAt) {
        await inventoryService.commitOrderInventory(order, {
          shipmentId: order.shipmentId || undefined,
          performedBy: vendor.userId || vendor._id,
        });
      }
    }

    if (status === "Delivered") {
      order.shippingStatus = "DELIVERED";
      order.deliveredAt = new Date();
    }

    order.status = status;
    order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
    order.timeline.push({
      status,
      note: `Order moved to ${status} by vendor`,
      changedAt: new Date(),
    });

    const updated = await order.save();
    await productAnalyticsService.refreshForOrder(orderId);

    if (status === "Delivered") {
      await payoutService.markOrderDelivered(updated._id);
    }

    await this.createNotification(vendor._id, {
      type: "ORDER",
      title: "Order status updated",
      message: `Order ${updated.orderNumber} moved to ${status}.`,
      entityType: "Order",
      entityId: updated._id,
    });
    await notificationService.notifyOperations(
      {
        module: "MANAGEMENT",
        subModule: "ORDERS",
        type: "ORDER_STATUS_CHANGED",
        title: "Vendor updated an order",
        message: `Order ${updated.orderNumber} moved to ${status}.`,
        referenceId: updated._id,
        meta: {
          vendorId: vendor._id,
          orderNumber: updated.orderNumber,
          status,
        },
      },
      "orders.read"
    );

    return updated;
  }

  async markOrderSelfShipped(userId, orderId, payload = {}) {
    const vendor = await this.getVendorContext(userId);
    const order = await Order.findOne({ _id: orderId, sellerId: vendor._id });
    if (!order) {
      throw new AppError("Order not found", 404, "NOT_FOUND");
    }

    const { mode } = await assertVendorCanUseShippingMode(vendor, payload.shippingMode || order.shippingMode);
    if (mode !== "SELF") {
      throw new AppError("Self shipping is not enabled for this vendor", 400, "SHIPPING_MODE_DISABLED");
    }
    if (!["Placed", "Packed"].includes(order.status)) {
      throw new AppError("Order cannot be marked as self shipped at this stage", 400, "INVALID_STATUS_TRANSITION");
    }

    const update = deliveryService.buildSelfShippingUpdate(payload);
    update.courierAssignedByRole = "VENDOR";
    update.courierAssignedById = vendor._id;
    update.timeline = undefined;

    return await orderRepo.updateById(orderId, update);
  }

  async requestOrderPickup(userId, orderId, payload = {}) {
    const vendor = await this.getVendorContext(userId);
    const order = await Order.findOne({ _id: orderId, sellerId: vendor._id })
      .populate("userId", "name email phone");
    if (!order) {
      throw new AppError("Order not found", 404, "NOT_FOUND");
    }

    const { mode } = await assertVendorCanUseShippingMode(vendor, payload.shippingMode || order.shippingMode);
    if (mode !== "PLATFORM") {
      throw new AppError("Platform shipping is not enabled for this vendor", 400, "SHIPPING_MODE_DISABLED");
    }
    if (order.shipmentId || ["READY_FOR_PICKUP", "PICKUP_SCHEDULED", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.shippingStatus)) {
      throw new AppError("Shipment has already been created for this order", 400, "SHIPMENT_ALREADY_CREATED");
    }
    if (!["Placed", "Packed"].includes(order.status)) {
      throw new AppError("Shipment can only be created for packed orders", 400, "INVALID_STATUS_TRANSITION");
    }

    const shipment = await deliveryService.createShipment(order, vendor);
    const update = deliveryService.buildPlatformShippingUpdate(order, shipment);
    update.courierAssignedByRole = "VENDOR";
    update.courierAssignedById = vendor._id;

    return await orderRepo.updateById(orderId, update);
  }

  async getInventory(userId, query) {
    const vendor = await this.getVendorContext(userId);
    const { page, limit } = normalizePagination(query);
    const result = await productRepo.list({
      sellerId: vendor._id,
      page,
      limit,
      search: query.search,
      sortBy: query.sortBy || "stock",
      sortOrder: query.sortOrder === "desc" ? -1 : 1,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    return {
      ...result,
      products: result.products.map((product) => ({
        ...product.toObject(),
        lowStock: product.stock <= (product.lowStockThreshold || vendor.lowStockThreshold || 10),
      })),
    };
  }

  async updateInventory(userId, productId, payload) {
    const vendor = await this.getVendorContext(userId);
    const product = await Product.findOne({ _id: productId, sellerId: vendor._id });
    if (!product) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }

    if (payload.stock != null) product.stock = Number(payload.stock);
    if (payload.lowStockThreshold != null) product.lowStockThreshold = Number(payload.lowStockThreshold);
    await product.save();

    if (product.stock <= product.lowStockThreshold) {
      await this.createNotification(vendor._id, {
        type: "PRODUCT",
        title: "Low stock alert",
        message: `${product.name} is running low with ${product.stock} units left.`,
        entityType: "Product",
        entityId: product._id,
        priority: "high",
      });
      await notificationService.notifyVendorUser(vendor._id, {
        module: "MANAGEMENT",
        subModule: "INVENTORY",
        type: "INVENTORY_ALERT",
        title: "Low stock alert",
        message: `${product.name} is running low with ${product.stock} units left.`,
        referenceId: product._id,
      });
    }

    return product;
  }

  async getAnalytics(userId, query = {}) {
    return await productAnalyticsService.getVendorDashboard(userId, query);
  }

  async getProductAnalyticsDetail(userId, productId, query = {}) {
    return await productAnalyticsService.getProductDetail(productId, query, {
      vendorScoped: true,
      userId,
    });
  }

  async getPayouts(userId, query = {}) {
    const vendor = await this.getVendorContext(userId);
    const dateRange = normalizeDateRange({
      startDate: query.startDate,
      endDate: query.endDate,
    });
    const payoutMatch = { sellerId: vendor._id };
    applyDateRange(payoutMatch, dateRange);
    const [pending, history, aggregates] = await Promise.all([
      Payout.find({ ...payoutMatch, status: "PENDING" }).sort({ createdAt: -1 }).populate("orderId", "orderNumber totalAmount status createdAt"),
      Payout.find(payoutMatch).sort({ createdAt: -1 }).limit(20).populate("orderId", "orderNumber totalAmount status createdAt"),
      Payout.aggregate([
        { $match: payoutMatch },
        {
          $group: {
            _id: "$status",
            amount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const earnings = aggregates.reduce(
      (acc, item) => {
        acc[item._id.toLowerCase()] = item.amount;
        return acc;
      },
      { pending: 0, paid: 0, failed: 0 }
    );

    return {
      overview: {
        totalEarnings: (earnings.pending || 0) + (earnings.paid || 0),
        pendingAmount: earnings.pending || 0,
        paidAmount: earnings.paid || 0,
        failedAmount: earnings.failed || 0,
      },
      pending,
      history,
    };
  }

  async getDelivery(userId, query) {
    const vendor = await this.getVendorContext(userId);
    const { page, limit } = normalizePagination(query);
    const skip = (page - 1) * limit;
    const filter = { sellerId: vendor._id };
    if (query.deliveryStatus) filter.deliveryStatus = query.deliveryStatus;
    if (query.shippingMode) filter.shippingMode = query.shippingMode;
    if (query.pickupStatus) filter.pickupStatus = query.pickupStatus;

    const [shipments, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("orderNumber status shippingMode shippingStatus pickupStatus pickupScheduled pickupBatchId courierName deliveryPartner trackingId trackingUrl deliveryStatus createdAt shippingAddress courierAssignedByRole courierAssignedAt shipmentId"),
      Order.countDocuments(filter),
    ]);

    return {
      shipments,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateDelivery(userId, orderId, payload) {
    const vendor = await this.getVendorContext(userId);
    const order = await Order.findOne({ _id: orderId, sellerId: vendor._id });
    if (!order) {
      throw new AppError("Order not found", 404, "NOT_FOUND");
    }

    if (order.courierAssignedByRole === "ADMIN") {
      throw new AppError("Courier assignment was locked by admin", 403, "COURIER_LOCKED");
    }

    if (payload.deliveryPartner) order.deliveryPartner = payload.deliveryPartner;
    if (payload.trackingId) order.trackingId = payload.trackingId;
    if (payload.trackingUrl) order.trackingUrl = payload.trackingUrl;
    if (payload.courierName) order.courierName = payload.courierName;
    if (payload.deliveryStatus) order.deliveryStatus = payload.deliveryStatus;
    if (payload.shippingStatus) order.shippingStatus = payload.shippingStatus;
    if (payload.pickupStatus) order.pickupStatus = payload.pickupStatus;
    if (payload.deliveryPartner || payload.trackingId || payload.trackingUrl || payload.courierName) {
      order.courierAssignedByRole = "VENDOR";
      order.courierAssignedById = vendor._id;
      order.courierAssignedAt = new Date();
    }
    await order.save();
    return order;
  }

  async getSettings(userId) {
    const vendor = await this.getVendorContext(userId);
    const shippingModes = await resolveVendorShippingModes(vendor);
    const pickupSettings = normalizePickupLocationPayload({}, vendor);
    return {
      ...vendor.toObject(),
      pickupAddress: pickupSettings.pickupAddress,
      pickupLocations: pickupSettings.pickupLocations,
      shippingSettings: {
        allowedShippingModes: shippingModes.requestedModes,
        effectiveShippingModes: shippingModes.effectiveModes,
        defaultShippingMode: shippingModes.defaultShippingMode,
        preferredPickupLocation: vendor.shippingSettings?.preferredPickupLocation || "Primary",
      },
      adminShippingModes: shippingModes.adminConfig,
    };
  }

  async updateSettings(userId, payload) {
    const vendor = await this.getVendorContext(userId);
    const vendorShippingModes = await resolveVendorShippingModes(vendor);
    const pickupSettings = normalizePickupLocationPayload(payload, vendor);
    const updatable = {
      companyName: payload.companyName,
      shopName: payload.shopName,
      storeSlug: payload.storeSlug,
      storeDescription: payload.storeDescription,
      storeThemeColor: payload.storeThemeColor,
      storeCategories: payload.storeCategories,
      storeSeo: payload.storeSeo,
      storeAbout: payload.storeAbout,
      storeSocialVisibility: {
        showExternalLinks: false,
        showSocialContacts: false,
        showDirectContact: false,
      },
      supportEmail: payload.supportEmail,
      supportPhone: payload.supportPhone,
      logoUrl: payload.logoUrl,
      bannerUrl: payload.bannerUrl,
      payoutSchedule: payload.payoutSchedule,
      defaultCourier: payload.defaultCourier,
      lowStockThreshold: payload.lowStockThreshold,
      address: payload.address,
      pickupAddress: pickupSettings.pickupAddress,
      pickupLocations: pickupSettings.pickupLocations,
      notificationPreferences: payload.notificationPreferences,
    };

    if (payload.shippingSettings) {
      updatable.shippingSettings = {
        ...(vendor.shippingSettings?.toObject?.() || vendor.shippingSettings || {}),
        ...buildVendorShippingSettingsPayload(payload.shippingSettings, vendorShippingModes),
      };
    }

    Object.keys(updatable).forEach((key) => updatable[key] === undefined && delete updatable[key]);
    await vendorRepo.updateById(vendor._id, updatable);
    return await this.getSettings(userId);
  }

  async getShippingSettings(userId) {
    const vendor = await this.getVendorContext(userId);
    const shippingModes = await resolveVendorShippingModes(vendor);
    const pickupSettings = normalizePickupLocationPayload({}, vendor);
    return {
      vendorId: vendor._id,
      pickupAddress: pickupSettings.pickupAddress,
      pickupLocations: pickupSettings.pickupLocations,
      allowedShippingModes: shippingModes.requestedModes,
      effectiveShippingModes: shippingModes.effectiveModes,
      defaultShippingMode: shippingModes.defaultShippingMode,
      preferredPickupLocation: vendor.shippingSettings?.preferredPickupLocation || "Primary",
      adminShippingModes: shippingModes.adminConfig,
    };
  }

  async updateShippingSettings(userId, payload) {
    const vendor = await this.getVendorContext(userId);
    const shippingModes = await resolveVendorShippingModes(vendor);
    const shippingSettings = {
      ...(vendor.shippingSettings?.toObject?.() || vendor.shippingSettings || {}),
      ...buildVendorShippingSettingsPayload(payload, shippingModes),
    };
    await vendorRepo.updateById(vendor._id, { shippingSettings });
    return await this.getShippingSettings(userId);
  }

  async getNotifications(userId, query) {
    const vendor = await this.getVendorContext(userId);
    const { page, limit } = normalizePagination(query);
    const skip = (page - 1) * limit;
    const filter = { vendorId: vendor._id };
    if (query.type) filter.type = query.type;
    if (query.isRead != null) filter.isRead = query.isRead === "true";

    const [notifications, total, unreadCount] = await Promise.all([
      VendorNotification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      VendorNotification.countDocuments(filter),
      VendorNotification.countDocuments({ vendorId: vendor._id, isRead: false }),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async markNotificationRead(userId, notificationId) {
    const vendor = await this.getVendorContext(userId);
    const notification = await VendorNotification.findOneAndUpdate(
      { _id: notificationId, vendorId: vendor._id },
      { $set: { isRead: true, readAt: new Date() } },
      { returnDocument: "after" }
    );
    if (!notification) {
      throw new AppError("Notification not found", 404, "NOT_FOUND");
    }
    return notification;
  }

  async getReviews(userId, query) {
    const vendor = await this.getVendorContext(userId);
    const { page, limit } = normalizePagination(query);
    const skip = (page - 1) * limit;
    const filter = { vendorId: vendor._id };
    if (query.rating) filter.rating = Number(query.rating);
    applyDateRange(filter, normalizeDateRange({ startDate: query.startDate, endDate: query.endDate }));

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate("productId", "name images")
        .populate("userId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments(filter),
    ]);

    return {
      reviews,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async respondToReview(userId, reviewId, message) {
    const vendor = await this.getVendorContext(userId);
    const review = await Review.findOneAndUpdate(
      { _id: reviewId, vendorId: vendor._id },
      {
        $set: {
          sellerResponse: {
            message,
            respondedAt: new Date(),
          },
        },
      },
      { returnDocument: "after" }
    );

    if (!review) {
      throw new AppError("Review not found", 404, "NOT_FOUND");
    }

    return review;
  }

  async getReturns(userId, query) {
    const vendor = await this.getVendorContext(userId);
    const { page, limit } = normalizePagination(query);
    const skip = (page - 1) * limit;
    const filter = { vendorId: vendor._id };
    if (query.status) filter.status = query.status;
    applyDateRange(filter, normalizeDateRange({ startDate: query.startDate, endDate: query.endDate }));

    const [requests, total] = await Promise.all([
      ReturnRequest.find(filter)
        .populate("orderId", "orderNumber totalAmount status")
        .populate("customerId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ReturnRequest.countDocuments(filter),
    ]);

    return {
      returns: requests,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateReturnStatus(userId, returnId, payload) {
    const vendor = await this.getVendorContext(userId);
    if (!RETURN_REQUEST_STATUS.includes(payload.status)) {
      throw new AppError("Invalid return status", 400, "VALIDATION_ERROR");
    }

    const request = await ReturnRequest.findOne({ _id: returnId, vendorId: vendor._id });
    if (!request) {
      throw new AppError("Return request not found", 404, "NOT_FOUND");
    }

    request.status = payload.status;
    request.resolutionNote = payload.resolutionNote;
    request.refundAmount = payload.refundAmount ?? request.refundAmount;
    request.resolvedAt = new Date();
    await request.save();

    if (payload.status === "REFUNDED") {
      await paymentService.processRefund({
        orderId: request.orderId,
        amount: request.refundAmount || request.orderId?.totalAmount || 0,
        reason: payload.resolutionNote || request.reason,
        actorRole: "vendor",
        notes: "Refund initiated from vendor return workflow.",
      });
    }

    await productAnalyticsService.refreshForReturn(request._id);

    await notificationService.notifyOperations(
      {
        module: "MANAGEMENT",
        subModule: "RETURNS",
        type: "RETURN_STATUS_CHANGED",
        title: "Return status updated",
        message: `Return request for order ${request.orderId?.orderNumber || request.orderId} moved to ${payload.status}.`,
        referenceId: request._id,
        meta: {
          vendorId: vendor._id,
          status: payload.status,
        },
      },
      "orders.read"
    );

    return request;
  }

  async getOffers(userId, query) {
    const vendor = await this.getVendorContext(userId);
    const { page, limit } = normalizePagination(query);
    const skip = (page - 1) * limit;
    const filter = { vendorId: vendor._id };
    if (query.isActive != null) filter.isActive = query.isActive === "true";

    const [offers, total] = await Promise.all([
      Offer.find(filter)
        .populate({ path: "productIds", select: "name", match: { sellerId: vendor._id } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Offer.countDocuments(filter),
    ]);

    return {
      offers,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async createOffer(userId, payload) {
    const vendor = await this.getVendorContext(userId);
    const productIds = await this.resolveOwnedProductIds(vendor._id, payload.productIds || []);
    return await Offer.create({
      vendorId: vendor._id,
      title: payload.title,
      code: payload.code,
      description: payload.description,
      type: payload.type,
      value: payload.value,
      minOrderValue: payload.minOrderValue,
      usageLimit: payload.usageLimit,
      productIds,
      isActive: payload.isActive !== false,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
    });
  }

  async updateOffer(userId, offerId, payload) {
    const vendor = await this.getVendorContext(userId);
    const updatePayload = { ...payload };

    if (payload.productIds !== undefined) {
      updatePayload.productIds = await this.resolveOwnedProductIds(vendor._id, payload.productIds);
    }

    const offer = await Offer.findOneAndUpdate(
      { _id: offerId, vendorId: vendor._id },
      { $set: updatePayload },
      { returnDocument: "after", runValidators: true }
    );
    if (!offer) {
      throw new AppError("Offer not found", 404, "NOT_FOUND");
    }
    return offer;
  }

  async getSupportTickets(userId, query) {
    const vendor = await this.getVendorContext(userId);
    const { page, limit } = normalizePagination(query);
    const skip = (page - 1) * limit;
    const filter = { vendorId: vendor._id };
    if (query.status) filter.status = query.status;

    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
      SupportTicket.countDocuments(filter),
    ]);

    return {
      tickets,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async createSupportTicket(userId, payload) {
    const vendor = await this.getVendorContext(userId);
    return await SupportTicket.create({
      vendorId: vendor._id,
      subject: payload.subject,
      category: payload.category,
      priority: payload.priority || "medium",
      messages: [
        {
          senderType: "VENDOR",
          message: payload.message,
        },
      ],
    });
  }

  async replyToSupportTicket(userId, ticketId, message) {
    const vendor = await this.getVendorContext(userId);
    const ticket = await SupportTicket.findOne({ _id: ticketId, vendorId: vendor._id });
    if (!ticket) {
      throw new AppError("Support ticket not found", 404, "NOT_FOUND");
    }
    ticket.messages.push({ senderType: "VENDOR", message });
    if (["RESOLVED", "CLOSED"].includes(ticket.status)) {
      ticket.status = "OPEN";
    }
    await ticket.save();
    return ticket;
  }
}

module.exports = new VendorDashboardService();
