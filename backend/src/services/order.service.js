const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const orderRepo = require("../repositories/order.repository");
const { ORDER_STATUS, PAYMENT_STATUS } = require("../models/Order");
const checkoutService = require("./checkout.service");
const inventoryService = require("./inventory.service");
const productAnalyticsService = require("./product-analytics.service");
const cancellationRefundService = require("./cancellation-refund.service");

function normalizeAddress(address) {
  const a = address || {};
  // Keep schema-compatible shape. We don't enforce strict validation here to avoid breaking current UX.
  return {
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1 || a.addressLine || a.address,
    line2: a.line2,
    city: a.city,
    state: a.state,
    postalCode: a.postalCode || a.zip,
    country: a.country,
  };
}

function asObjectId(id, fieldName) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(`Invalid ${fieldName}`, 400, "VALIDATION_ERROR");
  return id;
}

class OrderService {
  async createFromCart(userId, { address, currency } = {}) {
    const shippingAddress = normalizeAddress(address);
    if (!shippingAddress?.fullName || !shippingAddress?.line1 || !shippingAddress?.postalCode) {
      throw new AppError("Shipping address is required", 400, "MISSING_ADDRESS");
    }

    return await checkoutService.createOrder(userId, {
      shippingAddress,
      paymentMethod: "COD",
      currency,
    });
  }

  async listForUser(userId, { page, limit, status } = {}) {
    return await orderRepo.listByUserId({
      userId,
      page: Number(page || 1),
      limit: Number(limit || 20),
      ...(status ? { status } : {}),
    });
  }

  async getForUser(userId, orderId) {
    asObjectId(orderId, "orderId");
    const order = await orderRepo.findByIdForUser(orderId, userId);
    if (!order) throw new AppError("Order not found", 404, "NOT_FOUND");
    return order;
  }

  async cancelForUser(userId, orderId) {
    return await cancellationRefundService.processOrderCancellation({
      orderId,
      actor: { sub: userId, role: "user" },
      meta: {},
      reason: "Order cancelled by customer",
    });
  }

  async requestReturnForUser(userId, orderId) {
    asObjectId(orderId, "orderId");
    const order = await orderRepo.findByIdForUser(orderId, userId);
    if (!order) throw new AppError("Order not found", 404, "NOT_FOUND");
    if (order.status !== "Delivered") {
      throw new AppError("Only delivered orders can be returned", 400, "INVALID_OPERATION");
    }
    if (order.paymentStatus === "Partially Refunded") {
      throw new AppError("This order already has a partial refund and needs manual review", 400, "MANUAL_REVIEW_REQUIRED");
    }

    if (order.paymentStatus === "Paid" && order.paymentRecordId) {
      const paymentService = require("./payment.service");
      await paymentService.processRefund({
        orderId: order._id,
        paymentId: order.paymentRecordId._id || order.paymentRecordId,
        amount: Number(order.totalAmount || 0),
        reason: "Order returned by customer",
        actorRole: "system",
        notes: "Auto-refund triggered during return processing.",
      });
    }

    if (!order.inventoryRestoredAt) {
      for (const item of order.items || []) {
        await inventoryService.restoreStock(
          item.productId?._id || item.productId,
          item.variantId || "",
          Number(item.quantity || 0),
          order.returnId || null,
          order._id,
          userId,
          "Customer return processed"
        );
      }
    }

    const updated = await orderRepo.updateById(orderId, {
      status: "Returned",
      inventoryRestoredAt: new Date(),
    });
    await productAnalyticsService.refreshForOrder(orderId);
    return updated;
  }

  async updatePaymentStatus({ userId, orderId, paymentStatus }) {
    asObjectId(orderId, "orderId");
    if (!PAYMENT_STATUS.includes(paymentStatus)) {
      throw new AppError("Invalid payment status", 400, "VALIDATION_ERROR");
    }
    const order = await orderRepo.findByIdForUser(orderId, userId);
    if (!order) throw new AppError("Order not found", 404, "NOT_FOUND");
    return await orderRepo.updatePaymentStatus(orderId, paymentStatus);
  }
}

module.exports = new OrderService();

