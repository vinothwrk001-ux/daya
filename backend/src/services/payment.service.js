const Razorpay = require("razorpay");
const crypto = require("crypto");
const { AppError } = require("../utils/AppError");
const { Payment } = require("../models/Payment");
const { PaymentSession } = require("../models/PaymentSession");
const PaymentGatewayConfig = require("../models/PaymentGatewayConfig");
const orderRepo = require("../repositories/order.repository");
const paymentRepo = require("../repositories/payment.repository");
const payoutRepo = require("../repositories/payout.repository");
const refundRepo = require("../repositories/refund.repository");
const webhookEventRepo = require("../repositories/webhook-event.repository");
const { PaymentAttempt } = require("../models/PaymentAttempt");
const checkoutService = require("./checkout.service");
const commissionService = require("../modules/commission/service");
const walletService = require("./wallet.service");
const ledgerService = require("./ledger.service");
const VendorWallet = require("../models/VendorWallet");
const VendorOrder = require("../models/VendorOrder");
const { emitDomainEvent } = require("../modules/events/event-bus");
const { logger } = require("../utils/logger");

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function buildReceipt(userId) {
  return `rcpt_${String(userId).slice(-6)}_${Date.now()}`;
}

function buildSessionIdempotencyKey(userId, summary = {}, shippingAddress = {}) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        userId: String(userId),
        subtotal: roundMoney(summary.subtotal || 0),
        total: roundMoney(summary.total || summary.totalAmount || 0),
        itemCount: Number(summary.itemCount || 0),
        shippingAddress,
      })
    )
    .digest("hex");
}

function buildPaymentIdempotencyKey(razorpayOrderId) {
  return `payment:${String(razorpayOrderId || "").trim()}`;
}

function normalizeRazorpayError(error, fallbackMessage) {
  if (error instanceof AppError) return error;

  const gatewayMessage =
    error?.error?.description ||
    error?.description ||
    error?.error?.message ||
    error?.message ||
    fallbackMessage;

  const gatewayCode = error?.error?.code || error?.statusCode || "RAZORPAY_REQUEST_FAILED";
  const details = { source: "razorpay", code: gatewayCode };
  if (error?.error?.reason) details.reason = error.error.reason;
  if (error?.error?.field) details.field = error.error.field;
  if (error?.error?.step) details.step = error.error.step;
  if (error?.error?.metadata) details.metadata = error.error.metadata;

  const statusCode = error?.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 502;
  return new AppError(gatewayMessage, statusCode, "RAZORPAY_REQUEST_FAILED", details);
}

function getChargeAmount(charges = [], predicate) {
  const charge = Array.isArray(charges) ? charges.find(predicate) : null;
  return roundMoney(charge?.amount || 0);
}

function buildAmountBreakdown(summary = {}) {
  const charges = Array.isArray(summary.charges) ? summary.charges : [];
  return {
    subtotal: roundMoney(summary.subtotal || 0),
    shippingFee: roundMoney(
      summary.shippingFee || getChargeAmount(charges, (charge) => charge?.key === "shipping_cost")
    ),
    gatewayFee: roundMoney(
      getChargeAmount(
        charges,
        (charge) =>
          String(charge?.key || "").toLowerCase().includes("gateway") ||
          String(charge?.displayName || "").toLowerCase().includes("gateway")
      )
    ),
    prepaidDiscount: roundMoney(
      getChargeAmount(
        charges,
        (charge) =>
          String(charge?.key || "").toLowerCase().includes("discount") ||
          String(charge?.displayName || "").toLowerCase().includes("discount")
      )
    ),
    taxAmount: roundMoney(
      summary.taxAmount ||
        getChargeAmount(
          charges,
          (charge) => charge?.key === "tax" || String(charge?.category || "").toUpperCase() === "TAX"
        )
    ),
    totalAmount: roundMoney(summary.totalAmount || summary.total || 0),
    paymentMethod: summary.paymentMethod || "ONLINE",
  };
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

class PaymentService {
  async getGatewayConfig() {
    let config = await PaymentGatewayConfig.findOne({ provider: "RAZORPAY" });
    if (!config) {
      config = await PaymentGatewayConfig.create({
        provider: "RAZORPAY",
        webhookSecretConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
      });
    } else if (config.webhookSecretConfigured !== Boolean(process.env.RAZORPAY_WEBHOOK_SECRET)) {
      config.webhookSecretConfigured = Boolean(process.env.RAZORPAY_WEBHOOK_SECRET);
      await config.save();
    }
    return config;
  }

  async updateGatewayConfig(payload = {}, actorId = null) {
    const config = await this.getGatewayConfig();
    const allowed = {
      isEnabled: payload.isEnabled,
      gatewayFeePercentage: payload.gatewayFeePercentage,
      gatewayFeeFixed: payload.gatewayFeeFixed,
      prepaidDiscountPercentage: payload.prepaidDiscountPercentage,
      prepaidDiscountFixed: payload.prepaidDiscountFixed,
      sessionTimeoutMinutes: payload.sessionTimeoutMinutes,
      webhookUrl: payload.webhookUrl,
      notes: payload.notes,
    };

    Object.entries(allowed).forEach(([key, value]) => {
      if (value !== undefined) config[key] = value;
    });
    if (actorId) config.updatedBy = actorId;
    config.webhookSecretConfigured = Boolean(process.env.RAZORPAY_WEBHOOK_SECRET);
    await config.save();
    return config;
  }

  async assertGatewayEnabled() {
    const config = await this.getGatewayConfig();
    if (!config.isEnabled) {
      throw new AppError("Razorpay payments are currently disabled", 409, "PAYMENT_GATEWAY_DISABLED");
    }
    return config;
  }

  getRazorpayClient() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new AppError("Razorpay is not configured", 500, "RAZORPAY_NOT_CONFIGURED");
    }
    return new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  async createRazorpayOrder({ userId, cartId, shippingAddress, trackingToken }) {
    const gatewayConfig = await this.assertGatewayEnabled();
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
    const razorpay = this.getRazorpayClient();
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

    const amountBreakdown = buildAmountBreakdown(summary);
    const paymentRecord = await paymentRepo.create({
      userId,
      amount: roundMoney(summary.total || 0),
      currency,
      method: "ONLINE",
      status: "PENDING",
      fulfillmentStatus: "PENDING",
      receipt,
      razorpayOrderId: order.id,
      idempotencyKey: buildPaymentIdempotencyKey(order.id),
      cartSnapshot: summary.sellers.flatMap((seller) => seller.items || []),
      cartId: cartId && cartId !== "current" ? cartId : undefined,
      shippingAddress,
      trackingToken: trackingToken || undefined,
      amountBreakdown,
      gatewayFeeAmount: amountBreakdown.gatewayFee,
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

    const paymentSession = await PaymentSession.create({
      userId,
      paymentRecordId: paymentRecord._id,
      razorpayOrderId: order.id,
      paymentMethod: "ONLINE",
      currency,
      amount: roundMoney(summary.total || 0),
      status: "CREATED",
      idempotencyKey: buildSessionIdempotencyKey(userId, summary, shippingAddress),
      cartSnapshot: summary.sellers.flatMap((seller) => seller.items || []),
      checkoutSnapshot: summary,
      pricingBreakdown: {
        subtotal: summary.subtotal,
        charges: summary.charges,
        chargesTotal: summary.chargesTotal,
        total: summary.total,
        paymentMethod: summary.paymentMethod || "ONLINE",
        itemCount: summary.itemCount || 0,
        currency,
      },
      shippingAddress,
      expiresAt: new Date(Date.now() + Number(gatewayConfig.sessionTimeoutMinutes || 15) * 60 * 1000),
      metadata: {
        trackingToken: trackingToken || "",
        receipt,
        cartId: String(cartId || "current"),
      },
    });

    await paymentRepo.updateById(paymentRecord._id, {
      paymentSessionId: paymentSession._id,
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
        paymentSessionId: paymentSession._id,
      },
    });

    await emitDomainEvent("PAYMENT_INITIATED", {
      paymentRecordId: paymentRecord._id,
      paymentSessionId: paymentSession._id,
      razorpayOrderId: order.id,
      amount: paymentRecord.amount,
      currency,
    }).catch(() => {});

    return {
      paymentRecordId: paymentRecord._id,
      paymentSessionId: paymentSession._id,
      razorpayOrderId: order.id,
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

  async getPaymentAndSessionByOrder(razorpayOrderId) {
    const payment = await paymentRepo.findByRazorpayOrderId(razorpayOrderId);
    if (!payment) {
      throw new AppError("Payment record not found", 404, "PAYMENT_NOT_FOUND");
    }
    const paymentSession = payment.paymentSessionId
      ? await PaymentSession.findById(payment.paymentSessionId)
      : await PaymentSession.findOne({ razorpayOrderId });
    if (!paymentSession) {
      throw new AppError("Payment session not found", 404, "PAYMENT_SESSION_NOT_FOUND");
    }
    return { payment, paymentSession };
  }

  async fulfillPaidPayment({
    paymentId,
    paymentSessionId,
    userId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  }) {
    const payment = await paymentRepo.findById(paymentId);
    if (!payment) {
      throw new AppError("Payment record not found", 404, "PAYMENT_NOT_FOUND");
    }

    const paymentSession = paymentSessionId
      ? await PaymentSession.findById(paymentSessionId)
      : payment.paymentSessionId
        ? await PaymentSession.findById(payment.paymentSessionId)
        : await PaymentSession.findOne({ razorpayOrderId: razorpayOrderId || payment.razorpayOrderId });

    if (!paymentSession) {
      throw new AppError("Payment session not found", 404, "PAYMENT_SESSION_NOT_FOUND");
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
        paymentSession,
        orderGroupId: payment.orderGroupId || null,
        redirectUrl: primaryOrder ? `/orders/${String(primaryOrder._id || primaryOrder)}` : "/orders",
      };
    }

    if (paymentSession.expiresAt && paymentSession.expiresAt < new Date()) {
      await PaymentSession.updateOne(
        { _id: paymentSession._id },
        {
          $set: {
            status: "EXPIRED",
            expiredAt: new Date(),
          },
        }
      );
      throw new AppError("Payment session has expired", 410, "PAYMENT_SESSION_EXPIRED");
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
          paymentSession,
          orderGroupId: latestPayment.orderGroupId || null,
          redirectUrl: primaryOrder ? `/orders/${String(primaryOrder._id || primaryOrder)}` : "/orders",
        };
      }
      throw new AppError("Payment fulfillment is already in progress", 409, "PAYMENT_FULFILLMENT_IN_PROGRESS");
    }

    try {
      const orderResult = await checkoutService.createOrderFromPreparedCheckout(
        userId,
        paymentSession.checkoutSnapshot,
        {
          shippingAddress: paymentSession.shippingAddress,
          paymentMethod: "ONLINE",
          paymentRecordId: payment._id,
          orderGroupId: payment.orderGroupId || paymentSession.orderGroupId || `grp_${payment._id}`,
          paymentStatus: "Paid",
          razorpayOrderId: razorpayOrderId || payment.razorpayOrderId,
          razorpayPaymentId: razorpayPaymentId || payment.razorpayPaymentId,
          fraudFlags: payment.fraudChecks?.flaggedReasons || [],
          trackingToken: paymentSession.metadata?.trackingToken || payment.trackingToken || null,
        }
      );

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
          shippingAddress: paymentSession.shippingAddress,
        },
        $unset: {
          fulfillmentError: 1,
        },
      });

      const updatedSession = await PaymentSession.findByIdAndUpdate(
        paymentSession._id,
        {
          $set: {
            status: "ORDER_CREATED",
            razorpayPaymentId: razorpayPaymentId || payment.razorpayPaymentId,
            orderGroupId: orderResult.orderGroupId,
            verifiedAt: new Date(),
            orderCreatedAt: new Date(),
          },
        },
        { new: true }
      );

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
        message: "Payment verified and order created from immutable payment session",
        requestPayload: {
          paymentId: payment._id,
          paymentSessionId: paymentSession._id,
        },
        responsePayload: {
          orderGroupId: orderResult.orderGroupId,
          orderId: primaryOrder?._id || null,
        },
      });

      await emitDomainEvent("PAYMENT_VERIFIED", {
        paymentRecordId: payment._id,
        paymentSessionId: paymentSession._id,
        razorpayOrderId: razorpayOrderId || payment.razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId || payment.razorpayPaymentId,
        orderGroupId: orderResult.orderGroupId,
      }).catch(() => {});

      return {
        paymentId: razorpayPaymentId || payment.razorpayPaymentId,
        orderId: primaryOrder?._id || null,
        status: "PAID",
        orders: resolvedOrders,
        payment: updatedPayment,
        paymentSession: updatedSession,
        orderGroupId: orderResult.orderGroupId,
        redirectUrl: primaryOrder ? `/orders/${String(primaryOrder._id)}` : "/orders",
      };
    } catch (error) {
      logger.error("Payment fulfillment failed", {
        userId: String(userId),
        paymentRecordId: String(payment._id),
        paymentSessionId: String(paymentSession._id),
        razorpayOrderId: razorpayOrderId || payment.razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId || payment.razorpayPaymentId,
        message: error.message,
      });

      await PaymentSession.updateOne(
        { _id: paymentSession._id },
        {
          $set: {
            status: "REFUND_PENDING",
            failedAt: new Date(),
          },
          $inc: {
            verificationAttempts: 1,
          },
        }
      ).catch(() => {});

      await paymentRepo.updateById(payment._id, {
        $set: {
          status: "REFUND_PENDING",
          refundStatus: "PENDING",
          fulfillmentStatus: "FAILED",
          fulfillmentError: error.message,
          razorpayPaymentId: razorpayPaymentId || payment.razorpayPaymentId,
          razorpayOrderId: razorpayOrderId || payment.razorpayOrderId,
          razorpaySignature: razorpaySignature || payment.razorpaySignature,
          paidAt: new Date(),
        },
      }).catch(() => {});

      await emitDomainEvent("PAYMENT_FAILED", {
        paymentRecordId: payment._id,
        paymentSessionId: paymentSession._id,
        razorpayOrderId: razorpayOrderId || payment.razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId || payment.razorpayPaymentId,
        reason: error.message,
      }).catch(() => {});

      throw error;
    }
  }

  async fetchGatewayPayment(razorpayPaymentId) {
    if (!razorpayPaymentId) return null;
    try {
      const razorpay = this.getRazorpayClient();
      return await razorpay.payments.fetch(razorpayPaymentId);
    } catch (error) {
      logger.warn("Unable to fetch Razorpay payment for server-side confirmation", {
        paymentId: razorpayPaymentId,
        message: error.message,
      });
      return null;
    }
  }

  async verifyRazorpayPayment({
    userId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  }) {
    logger.info("Payment verification started", {
      userId: String(userId),
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
    });

    const { payment, paymentSession } = await this.getPaymentAndSessionByOrder(razorpay_order_id);
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

    if (paymentSession.expiresAt && paymentSession.expiresAt < new Date()) {
      await PaymentSession.updateOne(
        { _id: paymentSession._id },
        {
          $set: {
            status: "EXPIRED",
            expiredAt: new Date(),
          },
        }
      );
      throw new AppError("Payment session has expired", 410, "PAYMENT_SESSION_EXPIRED");
    }

    if (payment.razorpayPaymentId && String(payment.razorpayPaymentId) === String(razorpay_payment_id)) {
      const existingOrders = payment.orderGroupId ? await orderRepo.findByGroupId(payment.orderGroupId) : [];
      const primaryOrder = existingOrders[0] || payment.orderIds?.[0] || null;
      if (payment.fulfillmentStatus === "COMPLETED" && primaryOrder) {
        return {
          paymentId: payment.razorpayPaymentId,
          orderId: primaryOrder._id || primaryOrder,
          status: "PAID",
          orders: existingOrders,
          payment,
          paymentSession,
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

      await Promise.all([
        paymentRepo.updateById(payment._id, {
          $set: {
            status: "FAILED",
            failedAt: new Date(),
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
          },
          $inc: { "fraudChecks.duplicateAttemptCount": 1 },
          $addToSet: { "fraudChecks.flaggedReasons": "INVALID_SIGNATURE" },
        }),
        PaymentSession.updateOne(
          { _id: paymentSession._id },
          {
            $set: {
              status: "FAILED",
              failedAt: new Date(),
            },
            $inc: {
              verificationAttempts: 1,
            },
          }
        ),
      ]);
      throw new AppError("Payment verification failed", 400, "PAYMENT_VERIFICATION_FAILED");
    }

    const gatewayPayment = await this.fetchGatewayPayment(razorpay_payment_id);
    if (gatewayPayment?.order_id && String(gatewayPayment.order_id) !== String(razorpay_order_id)) {
      throw new AppError("Gateway payment order mismatch", 409, "PAYMENT_ORDER_MISMATCH");
    }
    if (
      gatewayPayment?.status &&
      !["captured", "authorized"].includes(String(gatewayPayment.status).toLowerCase())
    ) {
      throw new AppError("Payment is not captured by Razorpay", 409, "PAYMENT_NOT_CAPTURED");
    }

    await Promise.all([
      recordPaymentAttempt({
        userId,
        paymentRecordId: payment._id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        status: "SUCCESS",
        stage: "signature-verification",
        message: "Payment signature validated",
      }),
      paymentRepo.updateById(payment._id, {
        $set: {
          status: "AUTHORIZED",
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          failedAt: null,
          gatewayResponse: {
            ...(payment.gatewayResponse || {}),
            verifiedPayment: gatewayPayment || null,
          },
        },
      }),
      PaymentSession.updateOne(
        { _id: paymentSession._id },
        {
          $set: {
            status: "VERIFIED",
            razorpayPaymentId: razorpay_payment_id,
            verifiedAt: new Date(),
            lastVerificationAt: new Date(),
          },
          $inc: {
            verificationAttempts: 1,
          },
        }
      ),
    ]);

    return await this.fulfillPaidPayment({
      paymentId: payment._id,
      paymentSessionId: paymentSession._id,
      userId,
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
        acc.gatewayFeeRevenue += Number(payment.gatewayFeeAmount || payment.amountBreakdown?.gatewayFee || 0);
        if (payment.status === "PAID") acc.paidAmount += amount;
        if (payment.status === "FAILED") acc.failedAmount += amount;
        if (payment.status === "REFUNDED" || payment.status === "PARTIALLY_REFUNDED") {
          acc.refundedAmount += Number(payment.refundedAmount || 0);
        }
        return acc;
      },
      {
        totalAmount: 0,
        paidAmount: 0,
        failedAmount: 0,
        refundedAmount: 0,
        gatewayFeeRevenue: 0,
        totalCount: 0,
      }
    );

    overview.successRate = overview.totalCount ? roundMoney((overview.paidAmount > 0 ? result.payments.filter((p) => p.status === "PAID").length / overview.totalCount : 0) * 100) : 0;
    overview.refundRate = overview.totalCount
      ? roundMoney(
          (result.payments.filter((p) => ["REFUNDED", "PARTIALLY_REFUNDED"].includes(p.status)).length / overview.totalCount) * 100
        )
      : 0;

    return { ...result, overview };
  }

  async getPaymentDetails(paymentId) {
    const payment = await paymentRepo.findById(paymentId);
    if (!payment) throw new AppError("Payment not found", 404, "NOT_FOUND");

    const paymentSession = payment.paymentSessionId ? await PaymentSession.findById(payment.paymentSessionId) : null;
    const refunds = await refundRepo.list({ limit: 100 });
    const webhookEvents = await webhookEventRepo.list({ provider: "RAZORPAY", limit: 100 });
    return {
      payment,
      paymentSession,
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

  async applyRefundWalletReversal(order, refundAmount, refundRef, { session = null } = {}) {
    if (!order?.vendorWalletReleasedAt || !order?.sellerId) {
      return { skipped: true, reason: "VENDOR_WALLET_NOT_RELEASED" };
    }

    let walletQuery = VendorWallet.findOne({ vendorId: order.sellerId });
    if (session) walletQuery = walletQuery.session(session);
    const wallet = await walletQuery;
    if (!wallet) {
      return { skipped: true, reason: "WALLET_NOT_FOUND" };
    }

    const vendorEarning = roundMoney(order.vendorEarning || Math.max(Number(order.totalAmount || 0) - Number(order.platformCommissionAmount || 0), 0));
    const refundableBase = roundMoney(order.totalAmount || 0);
    const ratio = refundableBase > 0 ? Math.min(1, roundMoney(refundAmount / refundableBase)) : 0;
    const reversalAmount = roundMoney(vendorEarning * ratio);

    if (reversalAmount <= 0) {
      return { skipped: true, reason: "ZERO_REVERSAL" };
    }

    wallet.totalEarnings = Math.max(0, roundMoney(wallet.totalEarnings - reversalAmount));
    wallet.availableBalance = Math.max(0, roundMoney(wallet.availableBalance - reversalAmount));
    await wallet.save({ session: session || undefined });

    const walletSnapshot = {
      totalEarnings: wallet.totalEarnings,
      availableBalance: wallet.availableBalance,
      pendingBalance: wallet.pendingBalance,
      withdrawnAmount: wallet.withdrawnAmount,
    };

    const ledgerEntry = await ledgerService.createEntry({
      vendorId: order.sellerId,
      type: "DEBIT",
      amount: reversalAmount,
      source: "REFUND_REVERSAL",
      referenceId: order._id,
      walletSnapshot,
      meta: {
        orderNumber: order.orderNumber,
        refundAmount: roundMoney(refundAmount),
      },
      refundRef,
      session,
    });

    return { reversalAmount, ledgerEntry };
  }

  async processRefund({ orderId, paymentId, amount, reason, actorRole = "system", notes }) {
    const payment = paymentId ? await paymentRepo.findById(paymentId) : null;
    const order = orderId ? await orderRepo.findById(orderId) : null;

    if (!payment && !order) {
      throw new AppError("Payment or order is required", 400, "VALIDATION_ERROR");
    }

    const resolvedOrder =
      order ||
      (payment?.orderIds?.length ? await orderRepo.findById(payment.orderIds[0]._id || payment.orderIds[0]) : null);
    const resolvedPayment =
      payment ||
      (resolvedOrder?.paymentRecordId ? await paymentRepo.findById(resolvedOrder.paymentRecordId._id || resolvedOrder.paymentRecordId) : null);

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
      const razorpay = this.getRazorpayClient();
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
        refundStatus: gateway === "MANUAL" ? (isFullRefund ? "FULL" : "PARTIAL") : "PENDING",
        status: gateway === "MANUAL" ? nextPaymentStatus : "REFUND_PENDING",
      },
    });

    await orderRepo.updateById(resolvedOrder._id, {
      paymentStatus: nextOrderPaymentStatus,
      refundId: refund._id,
      fraudFlags: resolvedOrder.fraudFlags,
    });

    await VendorOrder.updateOne(
      { orderId: resolvedOrder._id },
      {
        $set: {
          paymentStatus: nextOrderPaymentStatus,
        },
      }
    ).catch(() => {});

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
    if (gateway === "MANUAL") {
      await this.applyRefundWalletReversal(resolvedOrder, refundAmount, refund.refundId);
    }

    await emitDomainEvent("REFUND_INITIATED", {
      refundId: refund._id,
      paymentRecordId: resolvedPayment._id,
      orderId: resolvedOrder._id,
      amount: refundAmount,
      gateway,
    }).catch(() => {});

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
      const updated = await refundRepo.updateById(refundId, {
        $set: {
          status: "PROCESSED",
          processedAt: new Date(),
          notes: notes || refund.notes,
        },
      });

      const payment = await paymentRepo.findById(refund.paymentId?._id || refund.paymentId);
      const order = await orderRepo.findById(refund.orderId?._id || refund.orderId);
      if (payment && order) {
        const nextRefundedAmount = Number(payment.refundedAmount || 0);
        const isFullRefund = nextRefundedAmount >= Number(payment.amount || 0);
        await paymentRepo.updateById(payment._id, {
          $set: {
            status: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
            refundStatus: isFullRefund ? "FULL" : "PARTIAL",
          },
        });
        await this.applyRefundWalletReversal(order, refund.amount, refund.refundId);
      }

      await emitDomainEvent("REFUND_COMPLETED", {
        refundId: updated._id,
        paymentRecordId: refund.paymentId?._id || refund.paymentId,
        orderId: refund.orderId?._id || refund.orderId,
        amount: refund.amount,
      }).catch(() => {});

      return updated;
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
