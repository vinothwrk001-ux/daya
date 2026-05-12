const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const { uploadMany } = require("../utils/upload");
const userRepo = require("../repositories/user.repository");
const cartService = require("./cart.service");
const orderRepo = require("../repositories/order.repository");
const sessionRepo = require("../repositories/session.repository");
const auditService = require("./audit.service");
const { UserAddress } = require("../models/UserAddress");
const { UserNotification } = require("../models/UserNotification");
const { UserSupportTicket } = require("../models/UserSupportTicket");
const { Wishlist } = require("../models/Wishlist");
const { Order } = require("../models/Order");
const { Payment } = require("../models/Payment");
const { Review } = require("../models/Review");
const { Product } = require("../models/Product");
const { ReturnRequest } = require("../models/ReturnRequest");
const { AuditLog } = require("../models/AuditLog");
const notificationService = require("./notification.service");
const orderLifecycleService = require("./order.service");
const {
  buildOrderSnapshot,
  buildOrderSummary,
  generateInvoiceNumber,
  generateInvoicePdf,
} = require("./order-document.service");

function assertObjectId(value, fieldName) {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(`Invalid ${fieldName}`, 400, "VALIDATION_ERROR");
  }
  return value;
}

function normalizeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl || null,
    preferences: user.preferences || {
      theme: "light",
      notificationPreferences: {
        orderUpdates: true,
        deliveryAlerts: true,
        paymentAlerts: true,
        promotions: false,
      },
    },
    createdAt: user.createdAt,
  };
}

function formatAddressForOrder(address) {
  return {
    fullName: address.name,
    phone: address.phone,
    line1: address.addressLine,
    city: address.city,
    state: address.state,
    postalCode: address.pincode,
    country: address.country,
  };
}

async function createNotification(userId, payload) {
  return await UserNotification.create({
    userId,
    ...payload,
  });
}

async function logUserAction(userId, action, entityType, entityId, metadata, meta) {
  return await auditService.log({
    actor: { _id: userId, role: "user" },
    action,
    entityType,
    entityId,
    metadata,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });
}

async function ensureUser(userId) {
  const user = await userRepo.findById(userId);
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
  return user;
}

async function resolveDeliveredOrderForReview(userId, productId, orderId) {
  const query = {
    userId,
    status: "Delivered",
    "items.productId": productId,
  };

  if (orderId) {
    query._id = orderId;
  }

  const order = await Order.findOne(query).select("_id sellerId items.productId");
  if (!order) {
    throw new AppError("Only delivered products can be reviewed", 400, "INVALID_OPERATION");
  }

  return order;
}

async function recomputeProductRatings(productId) {
  const reviews = await Review.find({ productId }).select("rating");
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

class UserService {
  async getDashboard(userId) {
    const user = await ensureUser(userId);

    const [ordersSummary, wishlistCount, recentOrders, unreadNotifications] = await Promise.all([
      Order.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            pendingOrders: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$status",
                      ["Pending", "Placed", "Packed", "Shipped", "Out for Delivery"],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      Wishlist.countDocuments({ userId }),
      Order.find({ userId })
        .populate("sellerId", "companyName")
        .sort({ createdAt: -1 })
        .limit(5)
        .select("orderNumber totalAmount status paymentStatus createdAt"),
      UserNotification.countDocuments({ userId, isRead: false }),
    ]);

    return {
      user: normalizeUser(user),
      stats: {
        totalOrders: ordersSummary[0]?.totalOrders || 0,
        pendingOrders: ordersSummary[0]?.pendingOrders || 0,
        wishlistCount,
        unreadNotifications,
      },
      recentOrders,
      quickActions: [
        { label: "View orders", href: "/orders" },
        { label: "Continue shopping", href: "/shop" },
        { label: "Manage addresses", href: "/addresses" },
      ],
    };
  }

  async getProfile(userId) {
    return normalizeUser(await ensureUser(userId));
  }

  async updateProfile(userId, payload, file, meta) {
    const user = await ensureUser(userId);
    const update = {};

    if (payload.email && payload.email !== user.email) {
      const existing = await userRepo.findByEmail(payload.email);
      if (existing && String(existing._id) !== String(userId)) {
        throw new AppError("Email already in use", 409, "EMAIL_EXISTS");
      }
      update.email = payload.email.toLowerCase();
    }

    if (payload.phone && payload.phone !== user.phone) {
      const existing = await userRepo.findByPhone(payload.phone);
      if (existing && String(existing._id) !== String(userId)) {
        throw new AppError("Phone already in use", 409, "PHONE_EXISTS");
      }
      update.phone = payload.phone;
    }

    if (payload.name) update.name = payload.name;

    if (payload.notificationPreferences) {
      update["preferences.notificationPreferences"] = payload.notificationPreferences;
    }

    if (file) {
      const [uploaded] = await uploadMany(
        [
          {
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          },
        ],
        { folder: "user_avatars" }
      );
      update.avatarUrl = uploaded?.url || user.avatarUrl;
    }

    const updated = await userRepo.updateById(userId, update);
    await logUserAction(userId, "user.profile.updated", "User", userId, Object.keys(update), meta);
    await createNotification(userId, {
      type: "ACCOUNT",
      title: "Profile updated",
      message: "Your profile details were updated successfully.",
      entityType: "User",
      entityId: userId,
    });
    return normalizeUser(updated);
  }

  async changePassword(userId, { currentPassword, newPassword }, meta) {
    const user = await userRepo.findById(userId);
    const authUser = await userRepo.findByEmail(user.email, { includePassword: true });
    if (!authUser) throw new AppError("User not found", 404, "NOT_FOUND");

    const matches = await bcrypt.compare(currentPassword, authUser.password);
    if (!matches) {
      throw new AppError("Current password is incorrect", 400, "INVALID_CREDENTIALS");
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await userRepo.updateById(userId, { password: hashed });
    await sessionRepo.revokeAllForUser(userId);
    await logUserAction(userId, "user.password.changed", "User", userId, null, meta);
    await createNotification(userId, {
      type: "ACCOUNT",
      title: "Password changed",
      message: "Your password was changed and all active sessions were signed out.",
      entityType: "User",
      entityId: userId,
    });
    return { changed: true };
  }

  async listAddresses(userId) {
    return await UserAddress.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
  }

  async createAddress(userId, payload, meta) {
    const existingCount = await UserAddress.countDocuments({ userId });
    if (payload.isDefault || existingCount === 0) {
      await UserAddress.updateMany({ userId, isDefault: true }, { $set: { isDefault: false } });
    }

    const address = await UserAddress.create({
      userId,
      ...payload,
      isDefault: payload.isDefault || existingCount === 0,
    });

    await logUserAction(userId, "user.address.created", "UserAddress", address._id, null, meta);
    return address;
  }

  async updateAddress(userId, addressId, payload, meta) {
    assertObjectId(addressId, "addressId");

    if (payload.isDefault) {
      await UserAddress.updateMany({ userId, isDefault: true }, { $set: { isDefault: false } });
    }

    const address = await UserAddress.findOneAndUpdate(
      { _id: addressId, userId },
      { $set: payload },
      { new: true, runValidators: true }
    );

    if (!address) throw new AppError("Address not found", 404, "NOT_FOUND");
    await logUserAction(userId, "user.address.updated", "UserAddress", address._id, Object.keys(payload), meta);
    return address;
  }

  async deleteAddress(userId, addressId, meta) {
    assertObjectId(addressId, "addressId");
    const address = await UserAddress.findOneAndDelete({ _id: addressId, userId });
    if (!address) throw new AppError("Address not found", 404, "NOT_FOUND");

    if (address.isDefault) {
      const nextAddress = await UserAddress.findOne({ userId }).sort({ createdAt: -1 });
      if (nextAddress) {
        nextAddress.isDefault = true;
        await nextAddress.save();
      }
    }

    await logUserAction(userId, "user.address.deleted", "UserAddress", addressId, null, meta);
    return { _id: addressId };
  }

  async listOrders(userId, query = {}) {
    return await orderRepo.listByUserId({
      userId,
      page: Number(query.page || 1),
      limit: Math.min(Number(query.limit || 10), 50),
      status: query.status,
      sortBy: query.sortBy || "createdAt",
      sortOrder: query.sortOrder === "asc" ? 1 : -1,
    });
  }

  async getOrder(userId, orderId) {
    assertObjectId(orderId, "orderId");
    const order = await orderRepo.findByIdForUser(orderId, userId);
    if (!order) throw new AppError("Order not found", 404, "NOT_FOUND");
    const user = await ensureUser(userId);
    const snapshot =
      order.orderSnapshot && typeof order.orderSnapshot === "object"
        ? order.orderSnapshot
        : buildOrderSnapshot(
            {
              ...order.toObject(),
              invoiceNumber: order.invoiceNumber || generateInvoiceNumber(order),
            },
            {
              user,
              seller: order.sellerId,
              paymentRecord: order.paymentRecordId,
            }
          );

    if (!order.orderSnapshot || !order.invoiceNumber) {
      await orderRepo.updateById(order._id, {
        ...(order.invoiceNumber ? {} : { invoiceNumber: snapshot.invoiceNumber }),
        ...(order.orderSnapshot ? {} : { orderSnapshot: snapshot }),
      });
      order.invoiceNumber = order.invoiceNumber || snapshot.invoiceNumber;
      order.orderSnapshot = order.orderSnapshot || snapshot;
    }

    return {
      ...buildOrderSummary(order, {
        user,
        seller: order.sellerId,
        paymentRecord: order.paymentRecordId,
      }),
      sellerId: order.sellerId,
      totalAmount: order.totalAmount,
    };
  }

  async getOrderTracking(userId, orderId) {
    assertObjectId(orderId, "orderId");
    const rawOrder = await orderRepo.findByIdForUser(orderId, userId);
    if (!rawOrder) throw new AppError("Order not found", 404, "NOT_FOUND");

    const timelineEvents = Array.isArray(rawOrder.timeline)
      ? rawOrder.timeline.map((entry, index) => ({
          key: `${String(entry?.status || "Placed").replace(/\s+/g, "_").toUpperCase()}-${index}`,
          status: String(entry?.status || "Placed").replace(/\s+/g, "_").toUpperCase(),
          label: String(entry?.status || "Placed"),
          note: entry?.note || "",
          timestamp:
            entry?.timestamp?.toISOString?.() ||
            entry?.changedAt?.toISOString?.() ||
            entry?.createdAt?.toISOString?.() ||
            rawOrder.createdAt?.toISOString?.() ||
            null,
        }))
      : [];

    return {
      _id: rawOrder._id,
      orderNumber: rawOrder.orderNumber,
      status: rawOrder.status,
      deliveryStatus: rawOrder.shippingStatus,
      shippingMode: rawOrder.shippingMode,
      shippingStatus: rawOrder.shippingStatus,
      pickupStatus: rawOrder.pickupStatus,
      deliveryPartner: rawOrder.deliveryPartner || rawOrder.logisticsProvider || "",
      courierName: rawOrder.courierName || "",
      shipmentId: rawOrder.shipmentId || "",
      trackingId: rawOrder.trackingId || "",
      trackingUrl: rawOrder.trackingUrl || "",
      timeline: timelineEvents,
    };
  }

  async cancelOrder(userId, orderId, meta) {
    const order = await this.getOrder(userId, orderId);
    if (!["Pending", "Placed"].includes(order.status)) {
      throw new AppError("Only placed orders can be cancelled", 400, "INVALID_OPERATION");
    }

    const updated = await orderLifecycleService.cancelForUser(userId, orderId);
    await logUserAction(userId, "user.order.cancelled", "Order", orderId, { orderNumber: order.orderNumber }, meta);
    await createNotification(userId, {
      type: "ORDER",
      title: "Order cancelled",
      message: `Order ${order.orderNumber} was cancelled successfully.`,
      entityType: "Order",
      entityId: orderId,
    });
    await notificationService.notifyVendorAndOperations({
      vendorId: order.sellerId?._id || order.sellerId,
      permissionKey: "orders.read",
      module: "MANAGEMENT",
      subModule: "ORDERS",
      type: "ORDER_CANCELLED",
      title: "Order cancelled",
      message: `Order ${order.orderNumber} was cancelled by the customer.`,
      referenceId: orderId,
    });
    return updated;
  }

  async requestReturn(userId, orderId, payload, meta) {
    const order = await this.getOrder(userId, orderId);
    if (order.status !== "Delivered") {
      throw new AppError("Only delivered orders can be returned", 400, "INVALID_OPERATION");
    }

    const existing = await ReturnRequest.findOne({ orderId, customerId: userId });
    if (existing) {
      throw new AppError("Return request already exists for this order", 409, "ALREADY_EXISTS");
    }

    const request = await ReturnRequest.create({
      vendorId: order.sellerId?._id || order.sellerId,
      orderId: order._id,
      customerId: userId,
      reason: payload.reason,
        refundAmount: order.pricing?.grandTotal || order.totalAmount,
      });

    await orderLifecycleService.requestReturnForUser(userId, orderId);
    await logUserAction(userId, "user.return.requested", "ReturnRequest", request._id, { orderNumber: order.orderNumber }, meta);
    await createNotification(userId, {
      type: "ORDER",
      title: "Return requested",
      message: `Return request submitted for order ${order.orderNumber}.`,
      entityType: "ReturnRequest",
      entityId: request._id,
    });
    await notificationService.notifyVendorAndOperations({
      vendorId: order.sellerId?._id || order.sellerId,
      permissionKey: "orders.read",
      module: "MANAGEMENT",
      subModule: "RETURNS",
      type: "RETURN_REQUEST",
      title: "Return requested",
      message: `A return was requested for order ${order.orderNumber}.`,
      referenceId: request._id,
      meta: {
        orderNumber: order.orderNumber,
      },
    });
    return request;
  }

  async getInvoice(userId, orderId) {
    const order = await this.getOrder(userId, orderId);
    const pdf = await generateInvoicePdf(order);
    return {
      filename: `${order.invoiceNumber || order.orderNumber}.pdf`,
      contentType: "application/pdf",
      content: pdf,
    };
  }

  async getCart(userId) {
    return await cartService.getCart(userId);
  }

  async updateCartItem(userId, productId, quantity) {
    return await cartService.updateItem(userId, { productId, quantity });
  }

  async removeCartItem(userId, productId) {
    return await cartService.removeItem(userId, { productId });
  }

  async getWishlist(userId) {
    const items = await Wishlist.find({ userId })
      .sort({ createdAt: -1 })
      .populate({
        path: "productId",
        select: "name category price discountPrice images stock status isActive slug variants",
      });

    return items
      .filter((item) => item.productId)
      .map((item) => ({
        _id: item._id,
        product: item.productId,
        variantId: item.variantId || null,
        selectedAttributes: item.selectedAttributes || {},
        addedAt: item.createdAt,
      }));
  }

  async addToWishlist(userId, productId, meta, variantId = null, selectedAttributes = {}) {
    assertObjectId(productId, "productId");
    const product = await Product.findById(productId).select("_id name");
    if (!product) throw new AppError("Product not found", 404, "NOT_FOUND");

    await Wishlist.findOneAndUpdate(
      { userId, productId },
      {
        $setOnInsert: { userId, productId },
        ...(variantId && { variantId }),
        ...(Object.keys(selectedAttributes).length > 0 && { selectedAttributes }),
      },
      { upsert: true, new: true }
    );

    await logUserAction(userId, "user.wishlist.added", "Product", productId, null, meta);
    return { saved: true, productId, variantId, selectedAttributes };
  }

  async removeFromWishlist(userId, productId, meta) {
    assertObjectId(productId, "productId");
    await Wishlist.findOneAndDelete({ userId, productId });
    await logUserAction(userId, "user.wishlist.removed", "Product", productId, null, meta);
    return { saved: false, productId };
  }

  async moveWishlistToCart(userId, productId, meta) {
    // Get wishlist item to retrieve variant info
    const wishlistItem = await Wishlist.findOne({ userId, productId });
    const variantId = wishlistItem?.variantId || "";

    await this.addToWishlist(userId, productId, meta);
    await cartService.addItem(userId, { productId, quantity: 1, variantId });
    await Wishlist.findOneAndDelete({ userId, productId });
    await createNotification(userId, {
      type: "SYSTEM",
      title: "Moved to cart",
      message: "Wishlist item moved to your cart.",
      entityType: "Product",
      entityId: productId,
    });
    return await this.getWishlist(userId);
  }

  async getBilling(userId, query = {}) {
    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.min(Math.max(Number(query.limit || 10), 1), 50);
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("orderNumber totalAmount paymentStatus paymentMethod createdAt"),
      Order.countDocuments({ userId }),
    ]);

    const payments = await Payment.find({ userId }).sort({ createdAt: -1 }).limit(20);

    return {
      billing: orders,
      paymentHistory: payments,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async listReturns(userId) {
    return await ReturnRequest.find({ customerId: userId })
      .populate("orderId", "orderNumber totalAmount status createdAt")
      .sort({ createdAt: -1 });
  }

  async listReviews(userId) {
    return await Review.find({ userId })
      .populate("productId", "name images")
      .populate("orderId", "orderNumber")
      .sort({ createdAt: -1 });
  }

  async createReview(userId, payload, meta) {
    assertObjectId(payload.productId, "productId");
    if (payload.orderId) assertObjectId(payload.orderId, "orderId");

    const product = await Product.findById(payload.productId).select("_id sellerId");
    if (!product) throw new AppError("Product not found", 404, "NOT_FOUND");

    const deliveredOrder = await resolveDeliveredOrderForReview(userId, payload.productId, payload.orderId);
    const vendorId = deliveredOrder.sellerId?._id || deliveredOrder.sellerId || product.sellerId;
    if (!vendorId) {
      throw new AppError("Vendor not found for reviewed product", 400, "INVALID_OPERATION");
    }

    const existing = await Review.findOne({ userId, productId: payload.productId });
    if (existing) throw new AppError("Review already exists for this product", 409, "ALREADY_EXISTS");

    const review = await Review.create({
      vendorId,
      productId: payload.productId,
      orderId: deliveredOrder._id,
      userId,
      rating: payload.rating,
      title: payload.title,
      comment: payload.comment,
    });

    await recomputeProductRatings(payload.productId);
    await logUserAction(userId, "user.review.created", "Review", review._id, { productId: payload.productId }, meta);
    return await this.listReviews(userId);
  }

  async updateReview(userId, reviewId, payload, meta) {
    assertObjectId(reviewId, "reviewId");
    const review = await Review.findOneAndUpdate(
      { _id: reviewId, userId },
      { $set: payload },
      { new: true, runValidators: true }
    );
    if (!review) throw new AppError("Review not found", 404, "NOT_FOUND");

    await recomputeProductRatings(review.productId);
    await logUserAction(userId, "user.review.updated", "Review", reviewId, Object.keys(payload), meta);
    return await this.listReviews(userId);
  }

  async deleteReview(userId, reviewId, meta) {
    assertObjectId(reviewId, "reviewId");
    const review = await Review.findOneAndDelete({ _id: reviewId, userId });
    if (!review) throw new AppError("Review not found", 404, "NOT_FOUND");

    await recomputeProductRatings(review.productId);
    await logUserAction(userId, "user.review.deleted", "Review", reviewId, null, meta);
    return { _id: reviewId };
  }

  async listNotifications(userId, query = {}) {
    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.min(Math.max(Number(query.limit || 10), 1), 50);
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      UserNotification.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      UserNotification.countDocuments({ userId }),
      UserNotification.countDocuments({ userId, isRead: false }),
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
    assertObjectId(notificationId, "notificationId");
    const notification = await UserNotification.findOneAndUpdate(
      { _id: notificationId, userId },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );
    if (!notification) throw new AppError("Notification not found", 404, "NOT_FOUND");
    return notification;
  }

  async listSupportTickets(userId) {
    return await UserSupportTicket.find({ userId }).sort({ updatedAt: -1 });
  }

  async createSupportTicket(userId, payload, meta) {
    const ticket = await UserSupportTicket.create({
      userId,
      subject: payload.subject,
      category: payload.category,
      priority: payload.priority || "medium",
      messages: [{ senderType: "USER", message: payload.message }],
    });

    await createNotification(userId, {
      type: "SUPPORT",
      title: "Support ticket created",
      message: `Your support ticket "${ticket.subject}" has been opened.`,
      entityType: "UserSupportTicket",
      entityId: ticket._id,
    });
    await logUserAction(userId, "user.support.created", "UserSupportTicket", ticket._id, null, meta);
    return ticket;
  }

  async replySupportTicket(userId, ticketId, payload, meta) {
    assertObjectId(ticketId, "ticketId");
    const ticket = await UserSupportTicket.findOne({ _id: ticketId, userId });
    if (!ticket) throw new AppError("Support ticket not found", 404, "NOT_FOUND");

    ticket.messages.push({ senderType: "USER", message: payload.message });
    if (["RESOLVED", "CLOSED"].includes(ticket.status)) {
      ticket.status = "OPEN";
    }
    await ticket.save();

    await logUserAction(userId, "user.support.replied", "UserSupportTicket", ticket._id, null, meta);
    return ticket;
  }

  async listSessions(userId) {
    return await sessionRepo.listActiveForUser(userId);
  }

  async revokeSession(userId, sessionId, meta) {
    assertObjectId(sessionId, "sessionId");
    const session = await sessionRepo.findById(sessionId);
    if (!session || String(session.userId) !== String(userId)) {
      throw new AppError("Session not found", 404, "NOT_FOUND");
    }

    await sessionRepo.revokeById(sessionId);
    await logUserAction(userId, "user.session.revoked", "Session", sessionId, null, meta);
    return { _id: sessionId };
  }

  async logoutAllDevices(userId, meta) {
    await sessionRepo.revokeAllForUser(userId);
    await logUserAction(userId, "user.sessions.revoked_all", "User", userId, null, meta);
    return { loggedOut: true };
  }

  async getActivity(userId, query = {}) {
    const limit = Math.min(Math.max(Number(query.limit || 20), 1), 50);
    return await AuditLog.find({ actorId: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("action entityType entityId metadata createdAt");
  }
}

module.exports = new UserService();
