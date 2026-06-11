const Razorpay = require("razorpay");
const crypto = require("crypto");
const { AppError } = require("../utils/AppError");
const { Payment } = require("../models/Payment");
const { Refund } = require("../models/Refund");
const { PaymentSession } = require("../models/PaymentSession");
const PaymentGatewayConfig = require("../models/PaymentGatewayConfig");
const orderRepo = require("../repositories/order.repository");
const paymentRepo = require("../repositories/payment.repository");
const refundRepo = require("../repositories/refund.repository");
const webhookEventRepo = require("../repositories/webhook-event.repository");
const { PaymentAttempt } = require("../models/PaymentAttempt");
const checkoutService = require("./checkout.service");
const { emitDomainEvent } = require("../modules/events/event-bus");
const { logger } = require("../utils/logger");
const productAnalyticsService = require("./product-analytics.service");

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function withTimeout(promise, timeoutMs, message) {
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timeout));
}

function maskCredential(value = "") {
  const normalized = String(value || "").trim();
  if (normalized.length <= 10) return normalized ? "***" : "";
  return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
}

function resolveRazorpayMode(keyId = "") {
  if (String(keyId).startsWith("rzp_test_")) return "test";
  if (String(keyId).startsWith("rzp_live_")) return "live";
  return "unknown";
}

function readRazorpayCredentials() {
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
  const keyPattern = /^rzp_(test|live)_[A-Za-z0-9]+$/;

  if (!keyId || !keySecret) {
    throw new AppError("Razorpay key id and secret are required", 500, "RAZORPAY_NOT_CONFIGURED");
  }
  if (!keyPattern.test(keyId)) {
    throw new AppError("Razorpay key id format is invalid", 500, "RAZORPAY_CONFIG_ERROR");
  }
  if (keySecret.startsWith("rzp_") || keySecret.length < 20) {
    throw new AppError("Razorpay key secret format is invalid", 500, "RAZORPAY_CONFIG_ERROR");
  }

  return {
    keyId,
    keySecret,
    mode: resolveRazorpayMode(keyId),
  };
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

function buildOrderSnapshotFromSession(paymentSession) {
  return {
    id: paymentSession.razorpayOrderId,
    amount: Math.round(Number(paymentSession.amount || 0) * 100),
    currency: paymentSession.currency || "INR",
    receipt: paymentSession.metadata?.receipt || "",
  };
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
    const { keyId, keySecret } = readRazorpayCredentials();
    return new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  async validateRazorpayConfiguration({ verifyCredentials = true } = {}) {
    const credentials = readRazorpayCredentials();
    const result = {
      keyId: maskCredential(credentials.keyId),
      mode: credentials.mode,
      credentialsVerified: false,
    };

    if (!verifyCredentials) return result;

    try {
      const razorpay = this.getRazorpayClient();
      const healthOrder = await withTimeout(
        razorpay.orders.create({
          amount: Number(process.env.RAZORPAY_STARTUP_CHECK_AMOUNT || 100),
          currency: process.env.RAZORPAY_DEFAULT_CURRENCY || "INR",
          receipt: `startup_${Date.now()}`,
          notes: {
            purpose: "startup_credential_validation",
          },
        }),
        Number(process.env.RAZORPAY_STARTUP_CHECK_TIMEOUT_MS || 8000),
        "Razorpay credential validation timed out"
      );
      if (!healthOrder?.id || !String(healthOrder.id).startsWith("order_")) {
        throw new AppError("Razorpay startup health order was invalid", 502, "RAZORPAY_STARTUP_ORDER_INVALID");
      }
      result.credentialsVerified = true;
      return result;
    } catch (error) {
      logger.error("Razorpay credential validation failed", {
        keyId: result.keyId,
        mode: result.mode,
        message: error?.error?.description || error.message,
        code: error?.error?.code || error.statusCode,
      });
      throw new AppError(
        "Razorpay credentials are invalid or do not belong to an accessible account",
        500,
        "RAZORPAY_CREDENTIAL_VALIDATION_FAILED"
      );
    }
  }

  async getRazorpayHealth({ deepCreateOrder = false } = {}) {
    const startedAt = Date.now();
    const checks = {
      credentialsConfigured: false,
      credentialFormat: false,
      apiReachable: false,
      ordersReadable: false,
      orderCreatable: false,
      webhookSecretConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
    };
    const diagnostics = [];
    let credentials;

    try {
      credentials = readRazorpayCredentials();
      checks.credentialsConfigured = true;
      checks.credentialFormat = credentials.mode !== "unknown";
    } catch (error) {
      diagnostics.push({
        code: error.code || "RAZORPAY_CONFIG_ERROR",
        message: error.message,
      });
      return {
        status: "Unhealthy",
        mode: "unknown",
        keyId: "",
        checks,
        diagnostics,
        latencyMs: Date.now() - startedAt,
      };
    }

    try {
      const razorpay = this.getRazorpayClient();
      await withTimeout(
        razorpay.orders.all({ count: 1 }),
        Number(process.env.RAZORPAY_HEALTH_TIMEOUT_MS || 8000),
        "Razorpay health check timed out"
      );
      checks.apiReachable = true;
      checks.ordersReadable = true;

      if (deepCreateOrder) {
        const healthOrder = await withTimeout(
          razorpay.orders.create({
            amount: Number(process.env.RAZORPAY_HEALTH_ORDER_AMOUNT || 100),
            currency: process.env.RAZORPAY_DEFAULT_CURRENCY || "INR",
            receipt: `health_${Date.now()}`,
            notes: {
              purpose: "payment_health_check",
            },
          }),
          Number(process.env.RAZORPAY_HEALTH_TIMEOUT_MS || 8000),
          "Razorpay health order creation timed out"
        );
        checks.orderCreatable = Boolean(
          healthOrder?.id &&
            String(healthOrder.id).startsWith("order_") &&
            String(healthOrder.status || "").toLowerCase() === "created"
        );
        if (!checks.orderCreatable) {
          diagnostics.push({
            code: "RAZORPAY_HEALTH_ORDER_INVALID",
            message: "Razorpay health order was not returned in created state",
          });
        }
      }
    } catch (error) {
      diagnostics.push({
        code: error?.error?.code || error.code || "RAZORPAY_HEALTH_CHECK_FAILED",
        message: error?.error?.description || error.message,
      });
    }

    const status =
      checks.credentialsConfigured &&
      checks.credentialFormat &&
      checks.apiReachable &&
      checks.ordersReadable &&
      (!deepCreateOrder || checks.orderCreatable)
        ? checks.webhookSecretConfigured
          ? "Healthy"
          : "Warning"
        : "Unhealthy";

    if (!checks.webhookSecretConfigured) {
      diagnostics.push({
        code: "RAZORPAY_WEBHOOK_SECRET_MISSING",
        message: "Razorpay webhook secret is not configured",
      });
    }

    return {
      status,
      mode: credentials.mode,
      keyId: maskCredential(credentials.keyId),
      checks,
      diagnostics,
      latencyMs: Date.now() - startedAt,
    };
  }

  async ensurePaymentRecordForSession(paymentSession) {
    if (!paymentSession) {
      throw new AppError("Payment session not found", 404, "PAYMENT_SESSION_NOT_FOUND");
    }

    const existingPaymentByOrder = await paymentRepo.findByRazorpayOrderId(paymentSession.razorpayOrderId);
    if (existingPaymentByOrder) {
      if (
        !paymentSession.paymentRecordId ||
        String(paymentSession.paymentRecordId) !== String(existingPaymentByOrder._id)
      ) {
        await PaymentSession.updateOne(
          { _id: paymentSession._id },
          { $set: { paymentRecordId: existingPaymentByOrder._id } }
        ).catch(() => {});
      }
      return existingPaymentByOrder;
    }

    const summary = paymentSession.checkoutSnapshot || {};
    const amountBreakdown = buildAmountBreakdown(summary);

    try {
      const paymentRecord = await paymentRepo.create({
        userId: paymentSession.userId,
        amount: roundMoney(paymentSession.amount || summary.total || 0),
        currency: paymentSession.currency || summary.currency || "INR",
        method: "ONLINE",
        status: "PENDING",
        fulfillmentStatus: "PENDING",
        receipt: paymentSession.metadata?.receipt || buildReceipt(paymentSession.userId),
        razorpayOrderId: paymentSession.razorpayOrderId,
        idempotencyKey: buildPaymentIdempotencyKey(paymentSession.razorpayOrderId),
        cartSnapshot: Array.isArray(paymentSession.cartSnapshot) ? paymentSession.cartSnapshot : [],
        shippingAddress: paymentSession.shippingAddress,
        amountBreakdown,
        gatewayFeeAmount: amountBreakdown.gatewayFee,
        fraudChecks: {
          priceValidated: true,
          duplicateAttemptCount: 0,
          riskScore: 5,
          flaggedReasons: [],
        },
        gatewayResponse: {
          order: buildOrderSnapshotFromSession(paymentSession),
        },
      });

      await PaymentSession.updateOne(
        { _id: paymentSession._id },
        { $set: { paymentRecordId: paymentRecord._id } }
      ).catch(() => {});

      return paymentRecord;
    } catch (error) {
      if (error?.code === 11000) {
        const concurrentPayment = await paymentRepo.findByRazorpayOrderId(paymentSession.razorpayOrderId);
        if (concurrentPayment) return concurrentPayment;
      }
      throw error;
    }
  }

  async createRazorpayOrder({ userId, cartId, shippingAddress }) {
    try {
      const gatewayConfig = await this.assertGatewayEnabled();
      const summary = await checkoutService.prepare(userId, {
        shippingAddress,
        paymentMethod: "ONLINE",
      });

      if (!summary?.total) {
        throw new AppError("Cart is empty", 400, "EMPTY_CART");
      }

      const amount = Math.round(Number(summary.total || 0) * 100);
      const currency = summary.currency || "INR";
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new AppError("Payment amount must be greater than zero", 400, "INVALID_PAYMENT_AMOUNT");
      }
      if (!/^[A-Z]{3}$/.test(String(currency))) {
        throw new AppError("Payment currency is invalid", 400, "INVALID_PAYMENT_CURRENCY");
      }
      const receipt = buildReceipt(userId);
      const credentials = readRazorpayCredentials();
      
      let razorpay;
      try {
        razorpay = this.getRazorpayClient();
      } catch (error) {
        logger.error("Failed to initialize Razorpay client", {
          message: error.message,
          stack: error.stack,
        });
        throw new AppError("Payment gateway is not configured properly", 500, "RAZORPAY_CONFIG_ERROR");
      }

      let order;
      try {
        order = await withTimeout(
          razorpay.orders.create({
            amount,
            currency,
            receipt,
            notes: {
              userId: String(userId),
              cartId: String(cartId || "current"),
            },
          }),
          10000,
          "Razorpay API timeout"
        );
      } catch (error) {
        logger.error("Razorpay order creation failed", {
          userId: String(userId),
          message: error.message,
          code: error?.error?.code,
        });
        throw normalizeRazorpayError(error, "Failed to create payment order. Please try again.");
      }

      if (!order?.id || !String(order.id).startsWith("order_") || Number(order.amount) !== amount || order.currency !== currency) {
        logger.error("Razorpay order payload failed validation", {
          userId: String(userId),
          razorpayOrderId: order?.id,
          expectedAmount: amount,
          receivedAmount: order?.amount,
          expectedCurrency: currency,
          receivedCurrency: order?.currency,
        });
        throw new AppError("Invalid Razorpay order token. Please retry checkout.", 502, "RAZORPAY_ORDER_VALIDATION_FAILED");
      }

      const amountBreakdown = buildAmountBreakdown(summary);
      const paymentSession = await PaymentSession.create({
        userId,
        razorpayOrderId: order.id,
        paymentMethod: "ONLINE",
        currency,
        amount: roundMoney(summary.total || 0),
        status: "CREATED",
        idempotencyKey: buildSessionIdempotencyKey(userId, summary, shippingAddress),
        cartSnapshot: Array.isArray(summary.items) ? summary.items : [],
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
          receipt,
          cartId: String(cartId || "current"),
        },
      });

      await recordPaymentAttempt({
        userId,
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
          paymentSessionId: paymentSession._id,
        },
      });

      this.ensurePaymentRecordForSession(paymentSession)
        .then((paymentRecord) =>
          emitDomainEvent("PAYMENT_INITIATED", {
            paymentRecordId: paymentRecord._id,
            paymentSessionId: paymentSession._id,
            razorpayOrderId: order.id,
            amount: paymentRecord.amount,
            currency,
          }).catch(() => {})
        )
        .catch((error) => {
          logger.warn("Deferred payment record creation failed after Razorpay order creation", {
            userId: String(userId),
            razorpayOrderId: order.id,
            message: error.message,
          });
        });

      return {
        paymentSessionId: paymentSession._id,
        razorpayOrderId: order.id,
        orderId: order.id,
        razorpay_order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key: credentials.keyId,
        key_id: credentials.keyId,
        gatewayMode: credentials.mode,
        expiresAt: paymentSession.expiresAt,
        checkoutIntegrity: {
          orderStatus: order.status,
          orderEntity: order.entity,
          amountMatches: Number(order.amount) === amount,
          currencyMatches: order.currency === currency,
          mode: credentials.mode,
        },
        receipt,
        summary,
      };
    } catch (error) {
      logger.error("Payment creation failed", {
        userId: String(userId),
        message: error.message,
        code: error?.code,
      });
      throw error;
    }
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
      { returnDocument: "after" }
    ).exec();
  }

  async getPaymentAndSessionByOrder(razorpayOrderId) {
    const directPayment = await paymentRepo.findByRazorpayOrderId(razorpayOrderId);
    const paymentSession = directPayment?.paymentSessionId
      ? await PaymentSession.findById(directPayment.paymentSessionId)
      : await PaymentSession.findOne({ razorpayOrderId });
    if (!paymentSession) {
      throw new AppError("Payment session not found", 404, "PAYMENT_SESSION_NOT_FOUND");
    }
    const payment = directPayment || (await this.ensurePaymentRecordForSession(paymentSession));
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
        { returnDocument: "after" }
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
    if (!razorpayPaymentId) {
      throw new AppError("Razorpay payment id is required", 400, "PAYMENT_REFERENCE_MISSING");
    }
    try {
      const razorpay = this.getRazorpayClient();
      return await withTimeout(
        razorpay.payments.fetch(razorpayPaymentId),
        Number(process.env.RAZORPAY_PAYMENT_FETCH_TIMEOUT_MS || 8000),
        "Razorpay payment fetch timed out"
      );
    } catch (error) {
      logger.error("Unable to fetch Razorpay payment for server-side confirmation", {
        paymentId: razorpayPaymentId,
        message: error?.error?.description || error.message,
        code: error?.error?.code || error.statusCode,
      });
      throw normalizeRazorpayError(error, "Unable to verify payment with Razorpay. Please retry.");
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

    const { keySecret: secret } = readRazorpayCredentials();
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
    if (!gatewayPayment?.id) {
      throw new AppError("Invalid payment returned by gateway", 409, "INVALID_GATEWAY_PAYMENT");
    }
    if (String(gatewayPayment.id) !== String(razorpay_payment_id)) {
      throw new AppError("Gateway payment id mismatch", 409, "PAYMENT_ID_MISMATCH");
    }
    if (gatewayPayment?.order_id && String(gatewayPayment.order_id) !== String(razorpay_order_id)) {
      throw new AppError("Gateway payment order mismatch", 409, "PAYMENT_ORDER_MISMATCH");
    }
    if (String(gatewayPayment.status || "").toLowerCase() !== "captured") {
      throw new AppError("Payment is not captured by Razorpay", 409, "PAYMENT_NOT_CAPTURED");
    }
    const expectedAmount = Math.round(Number(paymentSession.amount || payment.amount || 0) * 100);
    if (Number(gatewayPayment.amount) !== expectedAmount) {
      await paymentRepo.updateById(payment._id, {
        $inc: { "fraudChecks.duplicateAttemptCount": 1 },
        $addToSet: { "fraudChecks.flaggedReasons": "AMOUNT_MISMATCH" },
      });
      throw new AppError("Payment amount mismatch", 409, "PAYMENT_AMOUNT_MISMATCH");
    }
    if (String(gatewayPayment.currency || "").toUpperCase() !== String(paymentSession.currency || payment.currency || "INR").toUpperCase()) {
      await paymentRepo.updateById(payment._id, {
        $inc: { "fraudChecks.duplicateAttemptCount": 1 },
        $addToSet: { "fraudChecks.flaggedReasons": "CURRENCY_MISMATCH" },
      });
      throw new AppError("Payment currency mismatch", 409, "PAYMENT_CURRENCY_MISMATCH");
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

  async recordCheckoutFailure({
    userId,
    razorpay_order_id,
    paymentSessionId,
    key_id,
    gatewayMode,
    amount,
    currency,
    error = {},
    ipAddress,
    userAgent,
  }) {
    const credentials = readRazorpayCredentials();
    const currentMode = credentials.mode;
    const keyMode = key_id ? resolveRazorpayMode(key_id) : "unknown";
    const receivedMode = keyMode !== "unknown" ? keyMode : gatewayMode || "unknown";
    const safeError = {
      code: String(error.code || ""),
      description: String(error.description || ""),
      source: String(error.source || ""),
      step: String(error.step || ""),
      reason: String(error.reason || ""),
      metadata: error.metadata || {},
    };
    const flaggedReasons = ["CHECKOUT_PAYMENT_FAILED"];

    if (safeError.reason === "invalid_token" || safeError.description.toLowerCase().includes("invalid token")) {
      flaggedReasons.push("RAZORPAY_INVALID_TOKEN");
    }
    if (key_id && key_id !== credentials.keyId) flaggedReasons.push("CHECKOUT_KEY_MISMATCH");
    if (receivedMode !== "unknown" && receivedMode !== currentMode) flaggedReasons.push("CHECKOUT_MODE_MISMATCH");

    let payment = null;
    let paymentSession = null;
    try {
      const result = await this.getPaymentAndSessionByOrder(razorpay_order_id);
      payment = result.payment;
      paymentSession = result.paymentSession;
    } catch (lookupError) {
      logger.warn("Checkout failure could not be linked to a payment session", {
        userId: String(userId),
        razorpayOrderId: razorpay_order_id,
        message: lookupError.message,
      });
    }

    if (paymentSession && paymentSessionId && String(paymentSession._id) !== String(paymentSessionId)) {
      flaggedReasons.push("CHECKOUT_SESSION_MISMATCH");
    }

    if (payment) {
      const paymentOwnerId = String(payment.userId?._id || payment.userId);
      if (paymentOwnerId !== String(userId)) {
        flaggedReasons.push("CHECKOUT_OWNER_MISMATCH");
        await recordPaymentAttempt({
          userId,
          paymentRecordId: payment._id,
          razorpayOrderId: razorpay_order_id,
          status: "FAILED",
          stage: "checkout-failure-authorization",
          message: "Checkout failure ownership mismatch",
          requestPayload: {
            keyId: maskCredential(key_id),
            currentKeyId: maskCredential(credentials.keyId),
            currentMode,
            receivedMode,
            ipAddress,
            userAgent,
            error: safeError,
          },
        });
        throw new AppError("Forbidden", 403, "FORBIDDEN");
      }
    }

    const expectedAmount = paymentSession
      ? Math.round(Number(paymentSession.amount || 0) * 100)
      : payment
        ? Math.round(Number(payment.amount || 0) * 100)
        : null;
    const expectedCurrency = String(paymentSession?.currency || payment?.currency || "").toUpperCase();
    if (expectedAmount && amount && Number(amount) !== expectedAmount) flaggedReasons.push("CHECKOUT_AMOUNT_MISMATCH");
    if (expectedCurrency && currency && String(currency).toUpperCase() !== expectedCurrency) {
      flaggedReasons.push("CHECKOUT_CURRENCY_MISMATCH");
    }

    const diagnostic = {
      razorpayOrderId: razorpay_order_id,
      paymentSessionId: paymentSession?._id || paymentSessionId || null,
      paymentRecordId: payment?._id || null,
      currentKeyId: maskCredential(credentials.keyId),
      checkoutKeyId: maskCredential(key_id),
      currentMode,
      checkoutMode: gatewayMode || receivedMode,
      expectedAmount,
      checkoutAmount: amount || null,
      expectedCurrency,
      checkoutCurrency: currency || "",
      flaggedReasons,
      error: safeError,
      ipAddress,
      userAgent,
    };

    await recordPaymentAttempt({
      userId,
      paymentRecordId: payment?._id,
      razorpayOrderId: razorpay_order_id,
      status: "FAILED",
      stage: "checkout-payment-failed",
      message: safeError.description || safeError.reason || "Razorpay checkout payment failed",
      requestPayload: diagnostic,
    });

    if (payment) {
      await paymentRepo.updateById(payment._id, {
        $set: {
          status: "FAILED",
          failedAt: new Date(),
          gatewayResponse: {
            ...(payment.gatewayResponse || {}),
            checkoutFailure: diagnostic,
          },
        },
        $inc: { "fraudChecks.duplicateAttemptCount": 1 },
        $addToSet: { "fraudChecks.flaggedReasons": { $each: flaggedReasons } },
      }).catch((updateError) => {
        logger.warn("Unable to update payment after checkout failure", {
          paymentRecordId: String(payment._id),
          message: updateError.message,
        });
      });
    }

    if (paymentSession) {
      await PaymentSession.updateOne(
        { _id: paymentSession._id },
        {
          $set: {
            status: "FAILED",
            failedAt: new Date(),
            lastVerificationAt: new Date(),
          },
          $inc: {
            verificationAttempts: 1,
          },
        }
      ).catch((updateError) => {
        logger.warn("Unable to update payment session after checkout failure", {
          paymentSessionId: String(paymentSession._id),
          message: updateError.message,
        });
      });
    }

    logger.warn("Razorpay checkout failure recorded", diagnostic);
    return {
      recorded: true,
      status: "FAILED",
      diagnostic: {
        razorpayOrderId: diagnostic.razorpayOrderId,
        paymentSessionId: diagnostic.paymentSessionId,
        currentMode,
        checkoutMode: diagnostic.checkoutMode,
        flaggedReasons,
      },
    };
  }

  async recordCheckoutOpened({
    userId,
    razorpay_order_id,
    paymentSessionId,
    key_id,
    gatewayMode,
    amount,
    currency,
    ipAddress,
    userAgent,
  }) {
    const credentials = readRazorpayCredentials();
    const { payment, paymentSession } = await this.getPaymentAndSessionByOrder(razorpay_order_id);
    const paymentOwnerId = String(payment.userId?._id || payment.userId);
    if (paymentOwnerId !== String(userId)) {
      await recordPaymentAttempt({
        userId,
        paymentRecordId: payment._id,
        razorpayOrderId: razorpay_order_id,
        status: "FAILED",
        stage: "checkout-opened-authorization",
        message: "Checkout opened ownership mismatch",
      });
      throw new AppError("Forbidden", 403, "FORBIDDEN");
    }

    const openedAt = new Date();
    const expectedAmount = Math.round(Number(paymentSession.amount || payment.amount || 0) * 100);
    const expectedCurrency = String(paymentSession.currency || payment.currency || "INR").toUpperCase();
    const flaggedReasons = [];
    if (paymentSessionId && String(paymentSession._id) !== String(paymentSessionId)) {
      flaggedReasons.push("CHECKOUT_SESSION_MISMATCH");
    }
    if (key_id !== credentials.keyId) flaggedReasons.push("CHECKOUT_KEY_MISMATCH");
    if (gatewayMode && gatewayMode !== credentials.mode) flaggedReasons.push("CHECKOUT_MODE_MISMATCH");
    if (Number(amount) !== expectedAmount) flaggedReasons.push("CHECKOUT_AMOUNT_MISMATCH");
    if (String(currency).toUpperCase() !== expectedCurrency) flaggedReasons.push("CHECKOUT_CURRENCY_MISMATCH");

    const diagnostic = {
      razorpayOrderId: razorpay_order_id,
      paymentSessionId: paymentSession._id,
      paymentRecordId: payment._id,
      openedAt,
      currentKeyId: maskCredential(credentials.keyId),
      checkoutKeyId: maskCredential(key_id),
      currentMode: credentials.mode,
      checkoutMode: gatewayMode || "",
      expectedAmount,
      checkoutAmount: amount,
      expectedCurrency,
      checkoutCurrency: currency,
      flaggedReasons,
      ipAddress,
      userAgent,
    };

    await recordPaymentAttempt({
      userId,
      paymentRecordId: payment._id,
      razorpayOrderId: razorpay_order_id,
      status: "CREATED",
      stage: "checkout-opened",
      message: "Razorpay checkout opened",
      requestPayload: diagnostic,
    });

    if (["CREATED", "PENDING"].includes(paymentSession.status)) {
      await PaymentSession.updateOne(
        { _id: paymentSession._id },
        {
          $set: {
            status: "PENDING",
            lastVerificationAt: openedAt,
            "metadata.checkoutOpenedAt": openedAt,
            "metadata.checkoutOpenDiagnostic": diagnostic,
          },
        }
      );
    }

    await paymentRepo.updateById(payment._id, {
      $set: {
        gatewayResponse: {
          ...(payment.gatewayResponse || {}),
          checkoutOpened: diagnostic,
        },
      },
      ...(flaggedReasons.length
        ? {
            $addToSet: { "fraudChecks.flaggedReasons": { $each: flaggedReasons } },
          }
        : {}),
    }).catch((error) => {
      logger.warn("Unable to update payment checkout-opened diagnostic", {
        paymentRecordId: String(payment._id),
        message: error.message,
      });
    });

    logger.info("Razorpay checkout opened", diagnostic);
    return {
      recorded: true,
      status: "PENDING",
      diagnostic: {
        razorpayOrderId: razorpay_order_id,
        paymentSessionId: paymentSession._id,
        openedAt,
        flaggedReasons,
      },
    };
  }

  async inspectCheckoutOrder({ userId, razorpayOrderId }) {
    const normalizedOrderId = String(razorpayOrderId || "").trim();
    if (!/^order_[A-Za-z0-9]+$/.test(normalizedOrderId)) {
      throw new AppError("Invalid Razorpay order id", 400, "INVALID_RAZORPAY_ORDER_ID");
    }

    const credentials = readRazorpayCredentials();
    const { payment, paymentSession } = await this.getPaymentAndSessionByOrder(normalizedOrderId);
    const paymentOwnerId = String(payment.userId?._id || payment.userId);
    if (paymentOwnerId !== String(userId)) {
      throw new AppError("Forbidden", 403, "FORBIDDEN");
    }

    return {
      backendConfiguration: {
        key: credentials.keyId,
        key_id: credentials.keyId,
        mode: credentials.mode,
        currency: paymentSession.currency || payment.currency || "INR",
      },
      order: {
        razorpay_order_id: paymentSession.razorpayOrderId,
        order_id: paymentSession.razorpayOrderId,
        amount: Math.round(Number(paymentSession.amount || payment.amount || 0) * 100),
        currency: paymentSession.currency || payment.currency || "INR",
        status: paymentSession.status,
        expiresAt: paymentSession.expiresAt,
        paymentSessionId: paymentSession._id,
        paymentRecordId: payment._id,
        alreadyPaid: payment.status === "PAID" || payment.fulfillmentStatus === "COMPLETED",
      },
      checkoutJsUrl: "https://checkout.razorpay.com/v1/checkout.js",
      generatedAt: new Date(),
    };
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

    if (resolvedPayment.refundStatus === "FULL" || resolvedOrder.refundSummary?.status === "REFUNDED") {
      throw new AppError("Refund already completed for this order", 409, "REFUND_ALREADY_PROCESSED");
    }

    const remainingRefundable = Number(resolvedPayment.amount || 0) - Number(resolvedPayment.refundedAmount || 0);
    if (refundAmount > remainingRefundable) {
      throw new AppError("Refund amount exceeds captured amount", 400, "INVALID_REFUND_AMOUNT");
    }

    const idempotencyKey = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          orderId: String(resolvedOrder._id),
          paymentId: String(resolvedPayment._id),
          refundAmount: roundMoney(refundAmount),
          reason: String(reason || ""),
          gateway: resolvedPayment.method === "ONLINE" && resolvedPayment.razorpayPaymentId ? "RAZORPAY" : "MANUAL",
        })
      )
      .digest("hex");

    const existingRefund = await Refund.findOne({ idempotencyKey });
    if (existingRefund) {
      return {
        refund: existingRefund,
        payment: await paymentRepo.findById(resolvedPayment._id),
        order: await orderRepo.findById(resolvedOrder._id),
        duplicate: true,
      };
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
      idempotencyKey,
      amount: refundAmount,
      grossAmount: refundAmount,
      deductionAmount: 0,
      status: gateway === "MANUAL" ? "PROCESSED" : "PENDING",
      reason: reason || "Refund requested",
      gateway,
      refundMethod: gateway,
      refundType: "ADJUSTMENT",
      requestedByRole: actorRole,
      paymentMethod: resolvedOrder.paymentMethod,
      gatewayResponse: refundResponse,
      breakdown: {
        subtotal: roundMoney(resolvedOrder.subtotal || 0),
        shipping: roundMoney(resolvedOrder.shippingFee || 0),
        taxes: roundMoney(resolvedOrder.taxAmount || 0),
        couponDiscount: roundMoney(resolvedOrder.discountAmount || 0),
        platformFee: roundMoney(resolvedOrder.platformFee || 0),
        gatewayFee: roundMoney(resolvedPayment.gatewayFeeAmount || 0),
        cancellationDeduction: 0,
        shippingDeduction: 0,
        refundAmount,
      },
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
      refundSummary: {
        status: gateway === "MANUAL" ? "REFUNDED" : "PROCESSING",
        method: gateway,
        amount: refundAmount,
        deductionAmount: 0,
        grossAmount: refundAmount,
        pendingSince: new Date(),
        processedAt: gateway === "MANUAL" ? new Date() : null,
        lastAttemptAt: new Date(),
        retryCount: Number(refund.attemptCount || 0),
        failureReason: "",
      },
      fraudFlags: resolvedOrder.fraudFlags,
    });

    await emitDomainEvent("REFUND_INITIATED", {
      refundId: refund._id,
      paymentRecordId: resolvedPayment._id,
      orderId: resolvedOrder._id,
      amount: refundAmount,
      gateway,
    }).catch(() => {});

    await productAnalyticsService.refreshForRefund(refund._id);

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
      }

      await emitDomainEvent("REFUND_COMPLETED", {
        refundId: updated._id,
        paymentRecordId: refund.paymentId?._id || refund.paymentId,
        orderId: refund.orderId?._id || refund.orderId,
        amount: refund.amount,
      }).catch(() => {});

      await productAnalyticsService.refreshForRefund(updated._id);

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
