const Razorpay = require("razorpay");
const crypto = require("crypto");
const { AppError } = require("../utils/AppError");
const { Payment } = require("../models/Payment");
const orderRepo = require("../repositories/order.repository");
const paymentRepo = require("../repositories/payment.repository");
const payoutRepo = require("../repositories/payout.repository");
const refundRepo = require("../repositories/refund.repository");
const webhookEventRepo = require("../repositories/webhook-event.repository");
const { PaymentAttempt } = require("../models/PaymentAttempt");
const checkoutService = require("./checkout.service");
const commissionService = require("../modules/commission/service");
const { logger } = require("../utils/logger");

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new AppError("Razorpay is not configured", 500, "RAZORPAY_NOT_CONFIGURED");
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function buildReceipt(userId) {
  return `rcpt_${String(userId).slice(-6)}_${Date.now()}`;
}

function buildIdempotencyKey(userId, amount) {
  return crypto.createHash("sha256").update(`${userId}:${amount}:${new Date().toISOString().slice(0, 16)}`).digest("hex");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function normalizeRazorpayError(error, fallbackMessage) {
  if (error instanceof AppError) return error;

  const gatewayMessage =
    error?.error?.description ||
    error?.description ||
    error?.error?.message ||
    error?.message ||
    fallbackMessage;

  const gatewayCode =
    error?.error?.code ||
    error?.statusCode ||
    "RAZORPAY_REQUEST_FAILED";

  const details = {
    source: "razorpay",
    code: gatewayCode,
  };

  if (error?.error?.reason) details.reason = error.error.reason;
  if (error?.error?.field) details.field = error.error.field;
  if (error?.error?.step) details.step = error.error.step;
  if (error?.error?.metadata) details.metadata = error.error.metadata;

  const statusCode =
    error?.statusCode && Number.isInteger(error.statusCode)
      ? error.statusCode
      : 502;

  return new AppError(gatewayMessage, statusCode, "RAZORPAY_REQUEST_FAILED", details);
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

async function recordPaymentAttempt({
  userId,
  paymentRecordId,
  razorpayOrderId,
  razorpayPaymentId,
  status,
  stage,
  message,
  requestPayload,
  responsePayload,
}) {
  try {
    await PaymentAttempt.create({
      userId,
      paymentRecordId,
      razorpayOrderId,
      razorpayPaymentId,
      status,
      stage,
      message,
      requestPayload,
      responsePayload,
    });
  } catch (error) {
    logger.error("Payment attempt log failed", {
      message: error.message,
      stage,
      razorpayOrderId,
      razorpayPaymentId,
    });
  }
}

function getChargeAmount(charges = [], predicate) {
  const charge = Array.isArray(charges) ? charges.find(predicate) : null;
  return roundMoney(charge?.amount || 0);
}

function buildAmountBreakdown(summary = {}) {
  return {
    subtotal: roundMoney(summary.subtotal || 0),
    shippingFee: roundMoney(
      summary.shippingFee ||
        getChargeAmount(summary.charges, (charge) => charge?.key === "shipping_cost")
    ),
    taxAmount: roundMoney(
      summary.taxAmount ||
        getChargeAmount(
          summary.charges,
          (charge) => charge?.key === "tax" || String(charge?.category || "").toUpperCase() === "TAX"
        )
    ),
    totalAmount: roundMoney(summary.totalAmount || summary.total || 0),
    paymentMethod: summary.paymentMethod || "ONLINE",
  };
}

class PaymentService {
  async createRazorpayOrder({ userId, cartId, shippingAddress, trackingToken }) {
    const summary = await checkoutService.prepare(userId, {
      shippingAddress,
      paymentMethod: "ONLINE",
      trackingToken,
    });
    if (!summary?.total) {
      throw new AppError("Cart is empty", 400, "EMPTY_CART");
    }

    const amount = Math.round(Number(summary.total || 0) * 100);
    const currency = summary.currency || "INR";
    const receipt = buildReceipt(userId);
    const razorpay = getRazorpayClient();
    let order;

    try {
      order = await razorpay.orders.create({
        amount,
        currency,
        receipt,
        payment_capture: 1,
        notes: {
          userId: String(userId),
          cartId: String(cartId || "current"),
        },
      });
    } catch (error) {
      throw normalizeRazorpayError(error, "Failed to create Razorpay order");
    }

    const paymentRecord = await paymentRepo.create({
      userId,
      amount: roundMoney(summary.total || 0),
      currency,
      method: "ONLINE",
      status: "CREATED",
      fulfillmentStatus: "PENDING",
      receipt,
      razorpayOrderId: order.id,
      idempotencyKey: buildIdempotencyKey(userId, summary.total || 0),
      cartSnapshot: summary.sellers.flatMap((seller) => seller.items),
      cartId: cartId && cartId !== "current" ? cartId : undefined,
      shippingAddress,
      trackingToken: trackingToken || undefined,
      amountBreakdown: buildAmountBreakdown(summary),
      fraudChecks: {
        priceValidated: true,
        duplicateAttemptCount: 0,
        riskScore: 5,
        flaggedReasons: [],
      },
      gatewayResponse: {
        order,
      },
    });

    await recordPaymentAttempt({
      userId,
      paymentRecordId: paymentRecord._id,
      razorpayOrderId: order.id,
      status: "CREATED",
      stage: "create-order",
      message: "Razorpay order created",
      requestPayload: {
        cartId: cartId || "current",
        amount,
        currency,
      },
      responsePayload: {
        paymentRecordId: paymentRecord._id,
      },
    });

    return {
      paymentRecordId: paymentRecord._id,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
      receipt,
      summary,
    };
  }

  async claimPaymentForFulfillment(paymentId) {
    return await Payment.findOneAndUpdate(
      {
        _id: paymentId,
        $or: [
          { fulfillmentStatus: { $exists: false } },
          { fulfillmentStatus: "PENDING" },
          { fulfillmentStatus: "FAILED" },
        ],
      },
      {
        $set: {
          fulfillmentStatus: "PROCESSING",
          fulfillmentStartedAt: new Date(),
        },
        $unset: {
          fulfillmentError: 1,
        },
      },
      { new: true }
    ).exec();
  }

  async fulfillPaidPayment({
    paymentId,
    userId,
    shippingAddress,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    trackingToken,
  }) {
    const payment = await paymentRepo.findById(paymentId);
    if (!payment) {
      throw new AppError("Payment record not found", 404, "PAYMENT_NOT_FOUND");
    }

    if (Array.isArray(payment.orderIds) && payment.orderIds.length > 0 && payment.fulfillmentStatus === "COMPLETED") {
      const existingOrders = await orderRepo.findByGroupId(payment.orderGroupId);
      const primaryOrder = existingOrders[0] || payment.orderIds[0] || null;
      return {
        paymentId: payment.razorpayPaymentId || razorpayPaymentId,
        orderId: primaryOrder?._id || primaryOrder || null,
        status: "PAID",
        orders: existingOrders,
        payment,
        orderGroupId: payment.orderGroupId || null,
        redirectUrl: primaryOrder ? `/orders/${String(primaryOrder._id || primaryOrder)}` : "/orders",
      };
    }

    const claimedPayment = await this.claimPaymentForFulfillment(payment._id);
    if (!claimedPayment) {
      const latestPayment = await paymentRepo.findById(payment._id);
      if (latestPayment?.fulfillmentStatus === "COMPLETED" && latestPayment.orderGroupId) {
        const existingOrders = await orderRepo.findByGroupId(latestPayment.orderGroupId);
        const primaryOrder = existingOrders[0] || latestPayment.orderIds?.[0] || null;
        return {
          paymentId: latestPayment.razorpayPaymentId || razorpayPaymentId,
          orderId: primaryOrder?._id || primaryOrder || null,
          status: "PAID",
          orders: existingOrders,
          payment: latestPayment,
          orderGroupId: latestPayment.orderGroupId || null,
          redirectUrl: primaryOrder ? `/orders/${String(primaryOrder._id || primaryOrder)}` : "/orders",
        };
      }

      throw new AppError("Payment fulfillment is already in progress", 409, "PAYMENT_FULFILLMENT_IN_PROGRESS");
    }

    const effectiveShippingAddress = shippingAddress || payment.shippingAddress;
    if (!effectiveShippingAddress) {
      await paymentRepo.updateById(payment._id, {
        $set: {
          status: "PAID",
          fulfillmentStatus: "FAILED",
          fulfillmentError: "Shipping address missing for order fulfillment.",
          razorpayOrderId: razorpayOrderId || payment.razorpayOrderId,
          razorpayPaymentId: razorpayPaymentId || payment.razorpayPaymentId,
          razorpaySignature: razorpaySignature || payment.razorpaySignature,
          paidAt: new Date(),
        },
      });
      throw new AppError("Shipping address is required to complete the paid order", 400, "MISSING_ADDRESS");
    }

    try {
      const orderResult = await checkoutService.createOrder(userId, {
        shippingAddress: effectiveShippingAddress,
        paymentMethod: "ONLINE",
        paymentRecordId: payment._id,
        orderGroupId: payment.orderGroupId || `grp_${payment._id}`,
        paymentStatus: "Paid",
        razorpayOrderId: razorpayOrderId || payment.razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId || payment.razorpayPaymentId,
        trackingToken: trackingToken || payment.trackingToken,
      });

      const updatedPayment = await paymentRepo.updateById(payment._id, {
        $set: {
          status: "PAID",
          fulfillmentStatus: "COMPLETED",
          fulfilledAt: new Date(),
          razorpayPaymentId: razorpayPaymentId || payment.razorpayPaymentId,
          razorpayOrderId: razorpayOrderId || payment.razorpayOrderId,
          razorpaySignature: razorpaySignature || payment.razorpaySignature,
          paidAt: new Date(),
          orderIds: orderResult.orders.map((order) => order._id),
          orderGroupId: orderResult.orderGroupId,
          shippingAddress: effectiveShippingAddress,
        },
        $unset: {
          fulfillmentError: 1,
        },
      });

      const resolvedOrders =
        Array.isArray(orderResult.orders) && orderResult.orders.length
          ? orderResult.orders
          : await orderRepo.findByGroupId(orderResult.orderGroupId);
      const primaryOrder = resolvedOrders[0] || null;

      await recordPaymentAttempt({
        userId,
        paymentRecordId: payment._id,
        razorpayOrderId: razorpayOrderId || payment.razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId || payment.razorpayPaymentId,
        status: "VERIFIED",
        stage: "order-created",
        message: "Payment verified and order created",
        requestPayload: {
          paymentId: payment._id,
        },
        responsePayload: {
          orderGroupId: orderResult.orderGroupId,
          orderId: primaryOrder?._id || null,
        },
      });

      logger.info("Payment verified and order created", {
        userId: String(userId),
        paymentRecordId: String(payment._id),
        razorpayOrderId: razorpayOrderId || payment.razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId || payment.razorpayPaymentId,
        orderGroupId: orderResult.orderGroupId,
        orderId: primaryOrder?._id ? String(primaryOrder._id) : null,
      });

      return {
        paymentId: razorpayPaymentId || payment.razorpayPaymentId,
        orderId: primaryOrder?._id || null,
        status: "PAID",
        orders: resolvedOrders,
        payment: updatedPayment,
        orderGroupId: orderResult.orderGroupId,
        redirectUrl: primaryOrder ? `/orders/${String(primaryOrder._id)}` : "/orders",
      };
    } catch (error) {
      await recordPaymentAttempt({
        userId,
        paymentRecordId: payment._id,
        razorpayOrderId: razorpayOrderId || payment.razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId || payment.razorpayPaymentId,
        status: "FAILED",
        stage: "fulfillment-error",
        message: error.message,
      });
      logger.error("Payment fulfillment failed", {
        userId: String(userId),
        paymentRecordId: String(payment._id),
        razorpayOrderId: razorpayOrderId || payment.razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId || payment.razorpayPaymentId,
        message: error.message,
      });
      await paymentRepo.updateById(payment._id, {
        $set: {
          status: "PAID",
          fulfillmentStatus: "FAILED",
          fulfillmentError: error.message,
          razorpayPaymentId: razorpayPaymentId || payment.razorpayPaymentId,
          razorpayOrderId: razorpayOrderId || payment.razorpayOrderId,
          razorpaySignature: razorpaySignature || payment.razorpaySignature,
          paidAt: new Date(),
        },
      }).catch(() => {});
      throw error;
    }
  }

  async verifyRazorpayPayment({
    userId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    shippingAddress,
    trackingToken,
  }) {
    logger.info("Payment verification started", {
      userId: String(userId),
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
    });

    const payment = await paymentRepo.findByRazorpayOrderId(razorpay_order_id);
    if (!payment) {
      throw new AppError("Payment record not found", 404, "PAYMENT_NOT_FOUND");
    }

    const paymentOwnerId = String(payment.userId?._id || payment.userId);
    if (paymentOwnerId !== String(userId)) {
      await recordPaymentAttempt({
        userId,
        paymentRecordId: payment._id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        status: "FAILED",
        stage: "authorization",
        message: "Payment ownership mismatch",
      });
      throw new AppError("Forbidden", 403, "FORBIDDEN");
    }

    if (payment.razorpayPaymentId && String(payment.razorpayPaymentId) === String(razorpay_payment_id)) {
      const existingOrders = payment.orderGroupId ? await orderRepo.findByGroupId(payment.orderGroupId) : [];
      const primaryOrder = existingOrders[0] || payment.orderIds?.[0] || null;
      if (payment.fulfillmentStatus === "COMPLETED" && primaryOrder) {
        logger.info("Payment verification reused completed fulfillment", {
          userId: String(userId),
          paymentRecordId: String(payment._id),
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          orderId: String(primaryOrder._id || primaryOrder),
        });
        return {
          paymentId: payment.razorpayPaymentId,
          orderId: primaryOrder._id || primaryOrder,
          status: "PAID",
          orders: existingOrders,
          payment,
          orderGroupId: payment.orderGroupId || null,
          redirectUrl: `/orders/${String(primaryOrder._id || primaryOrder)}`,
        };
      }
    }

    const paymentIdUsedByAnotherRecord = await paymentRepo.findByRazorpayPaymentId(razorpay_payment_id);
    if (paymentIdUsedByAnotherRecord && String(paymentIdUsedByAnotherRecord._id) !== String(payment._id)) {
      throw new AppError("Payment already linked to another order", 409, "PAYMENT_ALREADY_PROCESSED");
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (!safeEqual(expectedSignature, razorpay_signature)) {
      await recordPaymentAttempt({
        userId,
        paymentRecordId: payment._id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        status: "FAILED",
        stage: "signature-verification",
        message: "Payment verification failed",
      });
      await paymentRepo.updateById(payment._id, {
        $set: {
          status: "FAILED",
          failedAt: new Date(),
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
        },
        $inc: { "fraudChecks.duplicateAttemptCount": 1 },
        $addToSet: { "fraudChecks.flaggedReasons": "INVALID_SIGNATURE" },
      });
      throw new AppError("Payment verification failed", 400, "PAYMENT_VERIFICATION_FAILED");
    }

    await recordPaymentAttempt({
      userId,
      paymentRecordId: payment._id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      status: "SUCCESS",
      stage: "signature-verification",
      message: "Payment signature validated",
    });

    return await this.fulfillPaidPayment({
      paymentId: payment._id,
      userId,
      shippingAddress,
      trackingToken,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });
  }

  async listPayments(query = {}) {
    const result = await paymentRepo.list({
      page: Number(query.page || 1),
      limit: Number(query.limit || 20),
      status: query.status,
      method: query.method,
      search: query.search,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    const overview = result.payments.reduce(
      (acc, payment) => {
        const amount = Number(payment.amount || 0);
        acc.totalAmount += amount;
        acc.totalCount += 1;
        if (payment.status === "PAID") acc.paidAmount += amount;
        if (payment.status === "FAILED") acc.failedAmount += amount;
        if (payment.status === "REFUNDED" || payment.status === "PARTIALLY_REFUNDED") {
          acc.refundedAmount += Number(payment.refundedAmount || 0);
        }
        return acc;
      },
      { totalAmount: 0, paidAmount: 0, failedAmount: 0, refundedAmount: 0, totalCount: 0 }
    );

    return { ...result, overview };
  }

  async getPaymentDetails(paymentId) {
    const payment = await paymentRepo.findById(paymentId);
    if (!payment) throw new AppError("Payment not found", 404, "NOT_FOUND");
    const refunds = await refundRepo.list({ limit: 100 });
    const webhookEvents = await webhookEventRepo.list({ provider: "RAZORPAY", limit: 100 });
    return {
      payment,
      refunds: refunds.filter((refund) => String(refund.paymentId?._id || refund.paymentId) === String(paymentId)),
      webhookEvents: webhookEvents.filter(
        (event) =>
          String(event.payload?.payload?.payment?.entity?.order_id || event.payload?.payment?.entity?.order_id || "") ===
            String(payment.razorpayOrderId || "") ||
          String(event.payload?.payload?.payment?.entity?.id || event.payload?.payment?.entity?.id || "") ===
            String(payment.razorpayPaymentId || "")
      ),
    };
  }

  async listRefunds(query = {}) {
    const refunds = await refundRepo.list({
      status: query.status,
      startDate: query.startDate,
      endDate: query.endDate,
      limit: Number(query.limit || 100),
    });

    const overview = refunds.reduce(
      (acc, refund) => {
        const amount = Number(refund.amount || 0);
        acc.totalAmount += amount;
        if (refund.status === "PROCESSED") acc.processedAmount += amount;
        if (refund.status === "PENDING") acc.pendingAmount += amount;
        if (refund.status === "FAILED") acc.failedAmount += amount;
        return acc;
      },
      { totalAmount: 0, processedAmount: 0, pendingAmount: 0, failedAmount: 0 }
    );

    return { refunds, overview };
  }

  async processRefund({ orderId, paymentId, amount, reason, actorRole = "system", notes }) {
    const payment = paymentId ? await paymentRepo.findById(paymentId) : null;
    const order = orderId ? await orderRepo.findById(orderId) : null;

    if (!payment && !order) {
      throw new AppError("Payment or order is required", 400, "VALIDATION_ERROR");
    }

    const resolvedOrder = order || (payment?.orderIds?.length ? await orderRepo.findById(payment.orderIds[0]._id || payment.orderIds[0]) : null);
    const resolvedPayment = payment || (resolvedOrder?.paymentRecordId ? await paymentRepo.findById(resolvedOrder.paymentRecordId._id || resolvedOrder.paymentRecordId) : null);

    if (!resolvedOrder || !resolvedPayment) {
      throw new AppError("Linked order/payment not found", 404, "NOT_FOUND");
    }

    const refundAmount = Number(amount || resolvedOrder.totalAmount || 0);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      throw new AppError("Invalid refund amount", 400, "VALIDATION_ERROR");
    }

    const remainingRefundable = Number(resolvedPayment.amount || 0) - Number(resolvedPayment.refundedAmount || 0);
    if (refundAmount > remainingRefundable) {
      throw new AppError("Refund amount exceeds captured amount", 400, "INVALID_REFUND_AMOUNT");
    }

    let refundResponse = null;
    let gateway = "MANUAL";
    if (resolvedPayment.method === "ONLINE" && resolvedPayment.razorpayPaymentId) {
      gateway = "RAZORPAY";
      const razorpay = getRazorpayClient();
      try {
        refundResponse = await razorpay.payments.refund(resolvedPayment.razorpayPaymentId, {
          amount: Math.round(refundAmount * 100),
          notes: {
            reason: String(reason || "Refund requested"),
            orderId: String(resolvedOrder._id),
          },
        });
      } catch (error) {
        throw normalizeRazorpayError(error, "Failed to create Razorpay refund");
      }
    } else {
      refundResponse = {
        id: `manual_refund_${Date.now()}`,
        amount: Math.round(refundAmount * 100),
        status: "processed",
      };
    }

    const refund = await refundRepo.create({
      orderId: resolvedOrder._id,
      paymentId: resolvedPayment._id,
      refundId: refundResponse.id,
      amount: refundAmount,
      status: gateway === "MANUAL" ? "PROCESSED" : "PENDING",
      reason: reason || "Refund requested",
      gateway,
      requestedByRole: actorRole,
      gatewayResponse: refundResponse,
      notes,
      processedAt: gateway === "MANUAL" ? new Date() : undefined,
    });

    const nextRefundedAmount = Number(resolvedPayment.refundedAmount || 0) + refundAmount;
    const isFullRefund = nextRefundedAmount >= Number(resolvedPayment.amount || 0);
    const nextPaymentStatus = isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED";
    const nextOrderPaymentStatus = isFullRefund ? "Refunded" : "Partially Refunded";

    await paymentRepo.updateById(resolvedPayment._id, {
      $set: {
        refundedAmount: nextRefundedAmount,
        refundStatus: isFullRefund ? "FULL" : "PARTIAL",
        status: nextPaymentStatus,
      },
    });

    await orderRepo.updateById(resolvedOrder._id, {
      paymentStatus: nextOrderPaymentStatus,
      fraudFlags: resolvedOrder.fraudFlags,
    });

    const payouts = await payoutRepo.findByOrderId(resolvedOrder._id);
    await Promise.all(
      payouts
        .filter((payout) => ["ON_HOLD", "PENDING", "QUEUED"].includes(payout.status))
        .map((payout) =>
          payoutRepo.updateById(payout._id, {
            $set: {
              status: "CANCELLED",
              notes: "Cancelled because the order payment was refunded.",
            },
          })
        )
    );

    await commissionService.reverseForRefund(resolvedOrder._id);

    return {
      refund,
      payment: await paymentRepo.findById(resolvedPayment._id),
      order: await orderRepo.findById(resolvedOrder._id),
    };
  }

  async updateRefundStatus(refundId, { action, notes }) {
    const refund = await refundRepo.findById(refundId);
    if (!refund) throw new AppError("Refund not found", 404, "NOT_FOUND");

    if (action === "approve") {
      return await refundRepo.updateById(refundId, {
        $set: {
          status: "PROCESSED",
          processedAt: new Date(),
          notes: notes || refund.notes,
        },
      });
    }

    if (action === "reject") {
      return await refundRepo.updateById(refundId, {
        $set: {
          status: "REJECTED",
          notes: notes || refund.notes,
          failedAt: new Date(),
        },
      });
    }

    throw new AppError("Unsupported refund action", 400, "VALIDATION_ERROR");
  }
}

module.exports = new PaymentService();
