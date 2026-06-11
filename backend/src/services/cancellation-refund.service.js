const crypto = require("crypto");
const Razorpay = require("razorpay");
const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const { Order } = require("../models/Order");
const { Refund } = require("../models/Refund");
const { User } = require("../models/User");
const { UserNotification } = require("../models/UserNotification");
const orderRepo = require("../repositories/order.repository");
const paymentRepo = require("../repositories/payment.repository");
const refundRepo = require("../repositories/refund.repository");
const inventoryService = require("./inventory.service");
const cancellationPolicyService = require("./cancellation-policy.service");
const auditService = require("./audit.service");
const productAnalyticsService = require("./product-analytics.service");
const { withOptionalTransaction } = require("../utils/withOptionalTransaction");

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function deriveOrderPaymentStatus({
  order = {},
  refundStatus = "",
  refundAmount = 0,
  grossAmount = 0,
}) {
  const currentStatus = String(order.paymentStatus || "Pending");
  if (currentStatus !== "Paid" && currentStatus !== "Refunded" && currentStatus !== "Partially Refunded") {
    return currentStatus;
  }

  if (refundStatus !== "PROCESSED" && refundStatus !== "REFUNDED") {
    return currentStatus === "Refunded" || currentStatus === "Partially Refunded" ? currentStatus : "Paid";
  }

  return Number(refundAmount || 0) >= Number(grossAmount || order.totalAmount || 0) ? "Refunded" : "Partially Refunded";
}

function buildIdempotencyKey(prefix, source = "") {
  return `${prefix}:${crypto.createHash("sha256").update(String(source || "")).digest("hex").slice(0, 24)}`;
}

function getOrderStage(order = {}) {
  const normalized = String(order.status || "").trim().toUpperCase().replace(/\s+/g, "_");
  if (normalized === "PENDING" || normalized === "PLACED") return "PLACED";
  if (normalized === "CONFIRMED") return "CONFIRMED";
  if (normalized === "PACKED") return "PACKED";
  if (normalized === "SHIPPED") return "SHIPPED";
  if (normalized === "OUT_FOR_DELIVERY") return "OUT_FOR_DELIVERY";
  if (normalized === "DELIVERED") return "DELIVERED";
  return "PLACED";
}

function getPaymentMethodKey(order = {}, payment = null) {
  if (String(order.paymentMethod || payment?.method || "").toUpperCase() === "COD") {
    return "COD";
  }
  return "RAZORPAY";
}

function getGatewayFee(order = {}, payment = null) {
  return roundMoney(
    payment?.gatewayFeeAmount ||
      order?.priceBreakdown?.gatewayFee ||
      order?.paymentRecordId?.gatewayFeeAmount ||
      0
  );
}

function getPolicyPaymentConfig(policy, paymentMethod) {
  return (policy.paymentMethodConfigs || []).find((item) => item.paymentMethod === paymentMethod) || null;
}

function ensureCancelableStage(order, stageRule) {
  if (order.status === "Cancelled" || order.cancellation?.status === "CANCELLED") {
    throw new AppError("Order is already cancelled", 409, "ORDER_ALREADY_CANCELLED");
  }
  if (!stageRule?.cancellationEnabled) {
    throw new AppError("Cancellation is disabled for this order stage", 409, "CANCELLATION_DISABLED");
  }
}

function ensureFeatureFlags(policy, paymentMethod) {
  const flags = policy.featureFlags || {};
  if (paymentMethod === "COD" && flags.codCancellationEnabled === false) {
    throw new AppError("COD cancellation is disabled", 409, "CANCELLATION_DISABLED");
  }
  if (paymentMethod === "RAZORPAY" && flags.razorpayCancellationEnabled === false) {
    throw new AppError("Razorpay cancellation is disabled", 409, "CANCELLATION_DISABLED");
  }
}

function ensureRefundFeatureFlags(policy, paymentMethod, refundMethod) {
  const flags = policy.featureFlags || {};
  if (paymentMethod === "COD" && flags.codRefundEnabled === false) {
    throw new AppError("COD refunds are disabled", 409, "REFUND_DISABLED");
  }
  if (paymentMethod === "RAZORPAY" && flags.razorpayRefundEnabled === false && refundMethod === "RAZORPAY") {
    throw new AppError("Razorpay refunds are disabled", 409, "REFUND_DISABLED");
  }
  if (refundMethod === "MANUAL" && flags.manualRefundEnabled === false) {
    throw new AppError("Manual refunds are disabled", 409, "REFUND_DISABLED");
  }
  if (refundMethod === "WALLET" && flags.walletRefundEnabled === false) {
    throw new AppError("Wallet refunds are disabled", 409, "REFUND_DISABLED");
  }
  if (refundMethod === "RAZORPAY" && flags.autoRefundEnabled === false) {
    throw new AppError("Auto refunds are disabled", 409, "REFUND_DISABLED");
  }
}

function calculateDeductionAmount(deduction = {}, context = {}) {
  if (deduction.enabled === false) return 0;
  const type = String(deduction.type || "").toUpperCase();
  let amount = 0;

  if (type === "FIXED") {
    amount = Number(deduction.value || 0);
  } else if (type === "PERCENTAGE") {
    amount = roundMoney(Number(context.refundableBase || 0) * (Number(deduction.value || 0) / 100));
  } else if (type === "SHIPPING") {
    amount = Number(deduction.value || context.shipping || 0);
  } else if (type === "GATEWAY_FEE") {
    amount = Number(context.gatewayFee || deduction.value || 0);
  } else if (type === "PLATFORM_ADJUSTMENT") {
    amount = Number(deduction.value || 0);
  }

  const capAmount =
    deduction.capAmount === null || deduction.capAmount === undefined ? null : Number(deduction.capAmount || 0);
  if (capAmount !== null) {
    amount = Math.min(amount, capAmount);
  }
  return roundMoney(Math.max(0, amount));
}

function decideRefundMethod({ paymentMethod, payment, policy, paymentConfig }) {
  const allowed = new Set(paymentConfig?.allowedRefundMethods || []);
  if (paymentMethod === "RAZORPAY" && payment?.razorpayPaymentId && allowed.has("RAZORPAY")) {
    return "RAZORPAY";
  }
  if (allowed.has("WALLET") && policy.featureFlags?.walletRefundEnabled !== false) {
    return "WALLET";
  }
  return "MANUAL";
}

function normalizeRefundMethod(method = "") {
  const normalized = String(method || "").trim().toUpperCase();
  return ["RAZORPAY", "MANUAL", "WALLET"].includes(normalized) ? normalized : "";
}

function resolveFinanceSelectedRefundMethod(refund = {}, payload = {}) {
  return normalizeRefundMethod(payload.refundMethod || refund.refundMethod || refund.recommendedRefundMethod);
}

function buildRefundPreview({ order, payment, policy }) {
  const stage = getOrderStage(order);
  const paymentMethod = getPaymentMethodKey(order, payment);
  const stageRule = (policy.stages || []).find((item) => item.stage === stage);
  const paymentConfig = getPolicyPaymentConfig(policy, paymentMethod);

  if (!stageRule) throw new AppError("No cancellation rule configured for this order stage", 409, "POLICY_MISSING");
  ensureCancelableStage(order, stageRule);
  ensureFeatureFlags(policy, paymentMethod);

  const subtotal = roundMoney(order.subtotal || order.priceBreakdown?.subtotal || 0);
  const shipping = roundMoney(order.shippingFee || order.priceBreakdown?.shippingFee || 0);
  const taxes = roundMoney(order.taxAmount || order.priceBreakdown?.taxAmount || 0);
  const couponDiscount = roundMoney(order.discountAmount || order.priceBreakdown?.discountAmount || 0);
  const platformFee = roundMoney(order.platformFee || 0);
  const gatewayFee = getGatewayFee(order, payment);
  const grossAmount = roundMoney(order.totalAmount || order.priceBreakdown?.totalAmount || 0);
  const refundableBase = grossAmount;
  const deductions = (stageRule.deductions || []).map((deduction) => ({
    type: deduction.type,
    label: deduction.label,
    amount: calculateDeductionAmount(deduction, {
      refundableBase,
      subtotal,
      shipping,
      taxes,
      couponDiscount,
      platformFee,
      gatewayFee,
    }),
  }));
  const deductionAmount = roundMoney(deductions.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const refundAmount = roundMoney(Math.max(0, grossAmount - deductionAmount));
  const refundMethod = decideRefundMethod({ paymentMethod, payment, policy, paymentConfig });
  const approvalRequired = Boolean(stageRule.manualApproval && !stageRule.autoApproval);

  return {
    stage,
    orderStatus: order.status,
    paymentMethod,
    approvalRequired,
    autoApproval: !approvalRequired,
    refundStatus: refundAmount > 0 ? (approvalRequired ? "PENDING" : "PROCESSING") : "NONE",
    refundMethod,
    grossAmount,
    deductionAmount,
    refundAmount,
    breakdown: {
      subtotal,
      shipping,
      taxes,
      couponDiscount,
      platformFee,
      gatewayFee,
      cancellationDeduction: deductionAmount,
      deductions,
    },
    featureFlags: policy.featureFlags,
    paymentConfig,
    stageRule,
    policyId: policy._id,
    refundSlaHours: Number(stageRule.refundSlaHours || 0),
  };
}

class CancellationRefundService {
  getRazorpayClient() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new AppError("Razorpay is not configured", 500, "RAZORPAY_NOT_CONFIGURED");
    }
    return new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  async loadOrderForActor(orderId, actor) {
    if (!mongoose.isValidObjectId(orderId)) {
      throw new AppError("Invalid orderId", 400, "VALIDATION_ERROR");
    }
    const order = await orderRepo.findById(orderId);
    if (!order) throw new AppError("Order not found", 404, "NOT_FOUND");

    if (actor?.role === "user" && String(order.userId?._id || order.userId) !== String(actor.sub || actor._id)) {
      throw new AppError("Forbidden", 403, "FORBIDDEN");
    }
    return order;
  }

  async getCancellationPreview(orderId, actor) {
    const order = await this.loadOrderForActor(orderId, actor);
    const payment = order.paymentRecordId?._id
      ? await paymentRepo.findById(order.paymentRecordId._id)
      : order.paymentRecordId
        ? await paymentRepo.findById(order.paymentRecordId)
        : null;
    const policy = await cancellationPolicyService.getActivePolicy();
    const preview = buildRefundPreview({ order, payment, policy });
    return {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      cancellation: preview,
    };
  }

  async createCustomerWalletRefund(userId, amount, referenceId, note, { session = null } = {}) {
    const user = await User.findById(userId).session(session || null);
    if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
    user.wallet = user.wallet || {};
    user.wallet.balance = roundMoney(Number(user.wallet.balance || 0) + Number(amount || 0));
    user.wallet.totalCredited = roundMoney(Number(user.wallet.totalCredited || 0) + Number(amount || 0));
    user.wallet.lastUpdatedAt = new Date();
    const transactions = Array.isArray(user.wallet.transactions) ? user.wallet.transactions : [];
    transactions.push({
      type: "CREDIT",
      amount: roundMoney(amount),
      source: "ORDER_CANCELLATION_REFUND",
      referenceId: String(referenceId || ""),
      note: String(note || ""),
      createdAt: new Date(),
    });
    user.wallet.transactions = transactions.slice(-100);
    await user.save({ session: session || undefined });
    return user.wallet;
  }

  async restoreInventoryForOrder(order, actorId, { session = null } = {}) {
    if (order.cancellation?.inventoryRestored || order.inventoryRestoredAt) {
      return { skipped: true, reason: "INVENTORY_ALREADY_RESTORED" };
    }

    const skippedItems = [];
    const skippableInventoryErrors = new Set(["INVALID_UNRESERVE", "VARIANT_NOT_FOUND", "PRODUCT_NOT_FOUND"]);
    for (const item of order.items || []) {
      if (!order.inventoryCommittedAt) {
        try {
          await inventoryService.unreserveStock(
            item.productId?._id || item.productId,
            item.variantId || "",
            Number(item.quantity || 0),
            order._id,
            actorId,
            { session }
          );
        } catch (error) {
          // Some legacy orders were created without an inventory reservation.
          // In that case there is nothing to release, so cancellation should continue.
          if (skippableInventoryErrors.has(error?.code)) {
            skippedItems.push({
              productId: item.productId?._id || item.productId,
              variantId: item.variantId || "",
              quantity: Number(item.quantity || 0),
              code: error.code,
              reason: error.message,
            });
            continue;
          }
          throw error;
        }
      } else {
        try {
          await inventoryService.restoreStock(
            item.productId?._id || item.productId,
            item.variantId || "",
            Number(item.quantity || 0),
            null,
            order._id,
            actorId,
            "Order cancelled by policy engine",
            { session }
          );
        } catch (error) {
          if (skippableInventoryErrors.has(error?.code)) {
            skippedItems.push({
              productId: item.productId?._id || item.productId,
              variantId: item.variantId || "",
              quantity: Number(item.quantity || 0),
              code: error.code,
              reason: error.message,
            });
            continue;
          }
          throw error;
        }
      }
    }

    return { restored: true, skippedItems };
  }

  async recordCancellationAccounting() {
    return { recorded: true };
  }

  async createRefundRecord({
    order,
    payment,
    preview,
    actor,
    reason,
    notes,
    refundMethod,
    approvalStatus = "AUTO_APPROVED",
    session = null,
  }) {
    const idempotencyKey = buildIdempotencyKey(
      "refund",
      `${order._id}:${preview.refundAmount}:${preview.deductionAmount}:${refundMethod}:${reason || ""}`
    );

    const existing = await Refund.findOne({ idempotencyKey }).session(session || null);
    if (existing) {
      return existing;
    }

    const refund = await Refund.create(
      [
        {
          orderId: order._id,
          paymentId: payment?._id || order.paymentRecordId || null,
          idempotencyKey,
          amount: preview.refundAmount,
          deductionAmount: preview.deductionAmount,
          grossAmount: preview.grossAmount,
          status: "PENDING",
          reason: reason || "Order cancelled",
          gateway: "",
          refundMethod: "",
          recommendedRefundMethod: refundMethod,
          refundType: "CANCELLATION",
          requestedByRole: actor?.role || "system",
          requestedById: actor?.sub || actor?._id || null,
          paymentMethod: order.paymentMethod,
          attemptCount: 0,
          lastAttemptAt: new Date(),
          retryable: true,
          approval: {
            status: approvalStatus,
            ...(approvalStatus === "APPROVED" || approvalStatus === "AUTO_APPROVED"
              ? { approvedBy: actor?.sub || actor?._id || null, approvedAt: new Date() }
              : {}),
          },
          breakdown: {
            ...preview.breakdown,
            refundAmount: preview.refundAmount,
          },
          notes: notes || "",
        },
      ],
      { session: session || undefined }
    );

    return refund[0];
  }

  async triggerRefund(refund, order, payment, actor, { session = null } = {}) {
    const refundMethod = refund.refundMethod;
    const policy = await cancellationPolicyService.getActivePolicy();
    ensureRefundFeatureFlags(policy, getPaymentMethodKey(order, payment), refundMethod);

    let gatewayResponse = {};
    let nextStatus = "PROCESSED";
    let failureReason = "";

    try {
      if (refundMethod === "RAZORPAY") {
        if (!payment?.razorpayPaymentId) {
          throw new AppError("Razorpay payment reference missing", 409, "PAYMENT_REFERENCE_MISSING");
        }
        const razorpay = this.getRazorpayClient();
        gatewayResponse = await razorpay.payments.refund(payment.razorpayPaymentId, {
          amount: Math.round(Number(refund.amount || 0) * 100),
          notes: {
            orderId: String(order._id),
            reason: String(refund.reason || "Order cancelled"),
          },
        });
        nextStatus = "PENDING";
      } else if (refundMethod === "WALLET") {
        gatewayResponse = await this.createCustomerWalletRefund(
          order.userId?._id || order.userId,
          refund.amount,
          refund._id,
          `Wallet refund for cancelled order ${order.orderNumber}`,
          { session }
        );
      } else {
        gatewayResponse = {
          id: `manual_refund_${Date.now()}`,
          status: "pending_manual_action",
        };
        nextStatus = "PENDING";
      }
    } catch (error) {
      nextStatus = "FAILED";
      failureReason = error.message;
      gatewayResponse = {
        error: error.message,
        code: error.code || error.statusCode || "REFUND_FAILED",
      };
    }

    const update = {
      $set: {
        status: nextStatus,
        gatewayResponse,
        failureReason,
        lastAttemptAt: new Date(),
      },
      $inc: {
        attemptCount: 1,
      },
      $push: {
        retryHistory: {
          attemptedAt: new Date(),
          status: nextStatus,
          note: failureReason || `Refund dispatched via ${refundMethod}`,
        },
      },
    };

    if (nextStatus === "PROCESSED") {
      update.$set.processedAt = new Date();
    }
    if (nextStatus === "FAILED") {
      update.$set.failedAt = new Date();
    }
    if (nextStatus === "PENDING" && gatewayResponse?.id) {
      update.$set.refundId = gatewayResponse.id;
    }

    const updatedRefund = await Refund.findByIdAndUpdate(refund._id, update, {
      returnDocument: "after",
      session: session || undefined,
    });

    const nextRefundedAmount = roundMoney(Number(payment?.refundedAmount || 0) + Number(updatedRefund.amount || 0));
    const isFullRefund = nextRefundedAmount >= Number(payment?.amount || order.totalAmount || 0);
    if (payment?._id) {
      await paymentRepo.updateById(payment._id, {
        $set: {
          refundedAmount: nextRefundedAmount,
          refundStatus:
            nextStatus === "FAILED" ? payment.refundStatus || "NONE" : nextStatus === "PENDING" ? "PENDING" : isFullRefund ? "FULL" : "PARTIAL",
          status:
            nextStatus === "FAILED"
              ? payment.status
              : nextStatus === "PENDING"
                ? "REFUND_PENDING"
                : isFullRefund
                  ? "REFUNDED"
                  : "PARTIALLY_REFUNDED",
        },
      });
    }

    return updatedRefund;
  }

  async processOrderCancellation({
    orderId,
    actor,
    meta,
    reason,
    notes,
    previewOnly = false,
  }) {
    const order = await this.loadOrderForActor(orderId, actor);
    const payment = order.paymentRecordId?._id
      ? await paymentRepo.findById(order.paymentRecordId._id)
      : order.paymentRecordId
        ? await paymentRepo.findById(order.paymentRecordId)
        : null;
    const policy = await cancellationPolicyService.getActivePolicy();
    const preview = buildRefundPreview({ order, payment, policy });

    if (previewOnly) {
      return {
        previewOnly: true,
        orderId: order._id,
        orderNumber: order.orderNumber,
        preview,
      };
    }

    const claim = await Order.findOneAndUpdate(
      {
        _id: order._id,
        "cancellation.status": { $nin: ["REQUESTED", "APPROVED", "CANCELLED"] },
        status: { $ne: "Cancelled" },
      },
      {
        $set: {
          "cancellation.status": preview.approvalRequired ? "REQUESTED" : "APPROVED",
          "cancellation.reason": String(reason || "").trim(),
          "cancellation.requestedAt": new Date(),
          "cancellation.requestedByRole": actor?.role || "system",
          "cancellation.requestedById": actor?.sub || actor?._id || null,
          "cancellation.currentStageKey": preview.stage,
          "cancellation.policyId": preview.policyId,
          "cancellation.autoApproved": !preview.approvalRequired,
          "cancellation.preview": preview,
          "cancellation.idempotencyKey": buildIdempotencyKey("cancel", `${order._id}:${reason || ""}:${preview.refundAmount}`),
          "refundSummary.status": preview.refundAmount > 0 ? "PENDING" : "NONE",
          "refundSummary.method": preview.refundMethod,
          "refundSummary.amount": preview.refundAmount,
          "refundSummary.deductionAmount": preview.deductionAmount,
          "refundSummary.grossAmount": preview.grossAmount,
          "refundSummary.pendingSince": preview.refundAmount > 0 ? new Date() : null,
        },
      },
      { returnDocument: "after" }
    ).exec();

    if (!claim) {
      const latest = await orderRepo.findById(order._id);
      if (latest?.cancellation?.status === "CANCELLED" || latest?.status === "Cancelled") {
        return {
          duplicate: true,
          order: latest,
        };
      }
      throw new AppError("Cancellation is already being processed", 409, "CANCELLATION_IN_PROGRESS");
    }

    const refundMethod = preview.refundMethod;
    const approvalStatus = preview.approvalRequired ? "PENDING_REVIEW" : "AUTO_APPROVED";

    const result = await withOptionalTransaction(
      async (session) => {
        await this.restoreInventoryForOrder(claim, actor?.sub || actor?._id, { session });

        const refund =
          preview.refundAmount > 0
            ? await this.createRefundRecord({
                order: claim,
                payment,
                preview,
                actor,
                reason,
                notes,
                refundMethod,
                approvalStatus,
                session,
              })
            : null;

        await Order.updateOne(
          { _id: claim._id },
          {
            $set: {
              status: "Cancelled",
              paymentStatus: claim.paymentStatus,
              cancelledAt: new Date(),
              cancelReason: String(reason || "").trim(),
              inventoryReservationReleasedAt: claim.inventoryCommittedAt ? claim.inventoryReservationReleasedAt : new Date(),
              inventoryRestoredAt: new Date(),
              "cancellation.status": "CANCELLED",
              "cancellation.approvedAt": new Date(),
              "cancellation.approvedByRole": actor?.role || "system",
              "cancellation.approvedById": actor?.sub || actor?._id || null,
              "cancellation.cancellationProcessedAt": new Date(),
              "cancellation.inventoryRestored": true,
              "cancellation.inventoryRestoredAt": new Date(),
              "cancellation.shipmentCancellationAttemptedAt": new Date(),
              "refundSummary.status": preview.refundAmount > 0 ? "PENDING" : "NONE",
              "refundSummary.method": "",
              "refundSummary.processedAt": null,
              "refundSummary.lastAttemptAt": null,
              "refundSummary.failedAt": null,
              "refundSummary.failureReason": "",
              ...(refund ? { refundId: refund._id } : {}),
            },
            $push: {
              timeline: {
                status: "Cancelled",
                note: preview.refundAmount > 0 ? `Cancelled with refund ${preview.refundAmount}` : "Cancelled with no refund",
                timestamp: new Date(),
              },
            },
          },
          { session: session || undefined }
        );

        await this.recordCancellationAccounting();

        const freshOrder = await orderRepo.findById(claim._id);
        return { order: freshOrder, refund };
      },
      { source: "cancellation-refund.service.cancel" }
    );

    await auditService.log({
      actor,
      action: "order.cancellation.processed",
      entityType: "Order",
      entityId: orderId,
      metadata: {
        reason,
        refundAmount: preview.refundAmount,
        deductionAmount: preview.deductionAmount,
        refundMethod,
        paymentMethod: order.paymentMethod,
        ipAddress: meta?.ipAddress,
        deviceInfo: meta?.userAgent,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    await Promise.all([
      productAnalyticsService.refreshForOrder(orderId),
      UserNotification.create({
        userId: order.userId?._id || order.userId,
        type: "ORDER",
        title: preview.refundAmount > 0 ? "Refund pending" : "Order cancelled",
        message:
          preview.refundAmount > 0
            ? `Your cancellation was accepted for order ${order.orderNumber}. Refund review is pending with the finance team.`
            : `Order ${order.orderNumber} was cancelled successfully.`,
        entityType: "Refund",
        entityId: result.refund?._id || order._id,
        meta: {
          refundAmount: preview.refundAmount,
          deductionAmount: preview.deductionAmount,
          refundMethod,
        },
      }).catch(() => null),
    ]);

    return {
      order: result.order,
      refund: result.refund,
      preview,
    };
  }

  async listRefunds(query = {}) {
    await cancellationPolicyService.ensureDefaultPolicy();
    const filters = {};
    if (query.status) filters.status = query.status;
    if (query.startDate) filters.startDate = query.startDate;
    if (query.endDate) filters.endDate = query.endDate;
    const refunds = await refundRepo.list({
      ...filters,
      limit: Math.min(Math.max(Number(query.limit || 100), 1), 200),
    });

    const grouped = refunds.map((refund) => ({
      ...refund.toObject?.() || refund,
      orderStatus: refund.orderId?.status || "",
      paymentMethod: refund.orderId?.paymentMethod || refund.paymentMethod || "",
      customer: refund.orderId?.userId || null,
    }));

    const overview = grouped.reduce(
      (acc, refund) => {
        const amount = Number(refund.amount || 0);
        acc.totalAmount += amount;
        if (refund.status === "PROCESSED") acc.processedAmount += amount;
        if (refund.status === "PENDING" || refund.status === "PROCESSING") acc.pendingAmount += amount;
        if (refund.status === "FAILED") acc.failedAmount += amount;
        if (refund.status === "REJECTED") acc.rejectedAmount += amount;
        return acc;
      },
      { totalAmount: 0, processedAmount: 0, pendingAmount: 0, failedAmount: 0, rejectedAmount: 0 }
    );

    return { refunds: grouped, overview };
  }

  async getRefundDetails(refundId) {
    const refund = await refundRepo.findById(refundId);
    if (!refund) throw new AppError("Refund not found", 404, "NOT_FOUND");
    const order = await orderRepo.findById(refund.orderId?._id || refund.orderId);
    const payment = await paymentRepo.findById(refund.paymentId?._id || refund.paymentId);
    return {
      refund,
      order,
      payment,
      inventoryLogs: order?._id
        ? await require("../models/InventoryLedger").InventoryLedger.find({ orderId: order._id }).sort({ createdAt: -1 }).lean()
        : [],
      auditLogs: await require("../models/AuditLog").AuditLog.find({
        $or: [{ entityId: String(refund._id) }, { entityId: String(order?._id || "") }],
      })
        .sort({ createdAt: -1 })
        .lean(),
    };
  }

  async processRefundAction(refundId, actor, payload = {}, meta = {}) {
    const refund = await refundRepo.findById(refundId);
    if (!refund) throw new AppError("Refund not found", 404, "NOT_FOUND");
    const order = await orderRepo.findById(refund.orderId?._id || refund.orderId);
    const payment = await paymentRepo.findById(refund.paymentId?._id || refund.paymentId);
    if (!order) throw new AppError("Linked order not found", 404, "NOT_FOUND");

    if (payload.action === "approve") {
      if (refund.status === "PROCESSED") {
        return { refund, order, payment, duplicate: true };
      }
      const refundMethod = resolveFinanceSelectedRefundMethod(refund, payload);
      if (!refundMethod) {
        throw new AppError("Refund method must be selected by finance", 400, "VALIDATION_ERROR");
      }

      await Refund.updateOne(
        { _id: refund._id },
        {
          $set: {
            "approval.status": "APPROVED",
            "approval.approvedBy": actor?.sub || actor?._id || null,
            "approval.approvedAt": new Date(),
            refundMethod,
            gateway: refundMethod,
            status: "PROCESSING",
          },
        }
      );

      const updatedRefund = await this.triggerRefund(
        { ...refund.toObject?.() || refund, refundMethod, gateway: refundMethod, amount: refund.amount },
        order,
        payment,
        actor
      );

      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            paymentStatus: deriveOrderPaymentStatus({
              order,
              refundStatus: updatedRefund.status,
              refundAmount: updatedRefund.amount,
              grossAmount: updatedRefund.grossAmount || order.totalAmount,
            }),
            "refundSummary.status":
              updatedRefund.status === "PROCESSED"
                ? "REFUNDED"
                : updatedRefund.status === "FAILED"
                  ? "FAILED"
                  : "PROCESSING",
            "refundSummary.method": updatedRefund.refundMethod || refundMethod,
            "refundSummary.processedAt": updatedRefund.processedAt || null,
            "refundSummary.failedAt": updatedRefund.failedAt || null,
            "refundSummary.failureReason": updatedRefund.failureReason || "",
            "refundSummary.retryCount": Number(updatedRefund.attemptCount || 0),
            "refundSummary.lastAttemptAt": updatedRefund.lastAttemptAt || new Date(),
          },
        }
      );

      await auditService.log({
        actor,
        action: "refund.approved",
        entityType: "Refund",
        entityId: refundId,
        metadata: { orderId: String(order._id), refundMethod },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });

      return {
        refund: await refundRepo.findById(refundId),
        order: await orderRepo.findById(order._id),
        payment: payment?._id ? await paymentRepo.findById(payment._id) : null,
      };
    }

    if (payload.action === "reject") {
      const updated = await Refund.findByIdAndUpdate(
        refund._id,
        {
          $set: {
            status: "REJECTED",
            failedAt: new Date(),
            "approval.status": "REJECTED",
            "approval.approvedBy": actor?.sub || actor?._id || null,
            "approval.approvedAt": new Date(),
            "approval.rejectionReason": String(payload.notes || payload.reason || "Rejected by admin"),
          },
        },
        { returnDocument: "after" }
      );
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            "refundSummary.status": "FAILED",
            "refundSummary.failedAt": new Date(),
            "refundSummary.failureReason": updated.approval?.rejectionReason || "Rejected by admin",
          },
        }
      );
      return { refund: updated, order: await orderRepo.findById(order._id), payment };
    }

    throw new AppError("Unsupported refund action", 400, "VALIDATION_ERROR");
  }

  async markWalletRefund(refundId, actor, payload = {}, meta = {}) {
    const refund = await refundRepo.findById(refundId);
    if (!refund) throw new AppError("Refund not found", 404, "NOT_FOUND");
    if (refund.status === "PROCESSED") {
      throw new AppError("Refund is already completed", 409, "REFUND_ALREADY_PROCESSED");
    }

    const order = await orderRepo.findById(refund.orderId?._id || refund.orderId);
    const payment = await paymentRepo.findById(refund.paymentId?._id || refund.paymentId);
    if (!order) throw new AppError("Linked order not found", 404, "NOT_FOUND");

    await Refund.updateOne(
      { _id: refund._id },
      {
        $set: {
          "approval.status": "APPROVED",
          "approval.approvedBy": actor?.sub || actor?._id || null,
          "approval.approvedAt": new Date(),
          refundMethod: "WALLET",
          gateway: "WALLET",
          status: "PROCESSING",
          notes: String(payload.notes || refund.notes || ""),
        },
      }
    );

    const updatedRefund = await this.triggerRefund(
      { ...refund.toObject?.() || refund, refundMethod: "WALLET", gateway: "WALLET", amount: refund.amount },
      order,
      payment,
      actor
    );

    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          paymentStatus: deriveOrderPaymentStatus({
            order,
            refundStatus: updatedRefund.status,
            refundAmount: updatedRefund.amount,
            grossAmount: updatedRefund.grossAmount || order.totalAmount,
          }),
          "refundSummary.status":
            updatedRefund.status === "PROCESSED"
              ? "REFUNDED"
              : updatedRefund.status === "FAILED"
                ? "FAILED"
                : "PROCESSING",
          "refundSummary.method": "WALLET",
          "refundSummary.processedAt": updatedRefund.processedAt || null,
          "refundSummary.failedAt": updatedRefund.failedAt || null,
          "refundSummary.failureReason": updatedRefund.failureReason || "",
          "refundSummary.retryCount": Number(updatedRefund.attemptCount || 0),
          "refundSummary.lastAttemptAt": updatedRefund.lastAttemptAt || new Date(),
        },
      }
    );

    await auditService.log({
      actor,
      action: "refund.wallet_processed",
      entityType: "Refund",
      entityId: refundId,
      metadata: { orderId: String(order._id), refundMethod: "WALLET" },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      refund: await refundRepo.findById(refundId),
      order: await orderRepo.findById(order._id),
      payment: payment?._id ? await paymentRepo.findById(payment._id) : null,
    };
  }

  async markManualRefund(refundId, actor, payload = {}, meta = {}) {
    const refund = await refundRepo.findById(refundId);
    if (!refund) throw new AppError("Refund not found", 404, "NOT_FOUND");
    if (refund.status === "PROCESSED") {
      throw new AppError("Refund is already completed", 409, "REFUND_ALREADY_PROCESSED");
    }

    const updated = await Refund.findByIdAndUpdate(
      refund._id,
      {
        $set: {
          status: "PROCESSED",
          refundMethod: "MANUAL",
          gateway: "MANUAL",
          processedAt: new Date(),
          manualDetails: {
            transactionReference: String(payload.transactionReference || ""),
            bankReference: String(payload.bankReference || ""),
            notes: String(payload.notes || ""),
            processedBy: actor?.sub || actor?._id || null,
            processedAt: new Date(),
          },
        },
      },
      { returnDocument: "after" }
    );

    const order = await orderRepo.findById(refund.orderId?._id || refund.orderId);
    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          paymentStatus: deriveOrderPaymentStatus({
            order,
            refundStatus: "PROCESSED",
            refundAmount: updated.amount,
            grossAmount: updated.grossAmount || order.totalAmount,
          }),
          "refundSummary.status": "REFUNDED",
          "refundSummary.method": "MANUAL",
          "refundSummary.processedAt": new Date(),
        },
      }
    );

    await auditService.log({
      actor,
      action: "refund.marked_manual",
      entityType: "Refund",
      entityId: refundId,
      metadata: {
        transactionReference: payload.transactionReference,
        bankReference: payload.bankReference,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      refund: updated,
      order: await orderRepo.findById(order._id),
      payment: await paymentRepo.findById(refund.paymentId?._id || refund.paymentId),
    };
  }

  async retryRefund(refundId, actor, meta = {}) {
    const refund = await refundRepo.findById(refundId);
    if (!refund) throw new AppError("Refund not found", 404, "NOT_FOUND");
    if (refund.status === "PROCESSED") {
      throw new AppError("Refund is already completed", 409, "REFUND_ALREADY_PROCESSED");
    }

    const order = await orderRepo.findById(refund.orderId?._id || refund.orderId);
    const payment = await paymentRepo.findById(refund.paymentId?._id || refund.paymentId);
    const updated = await this.triggerRefund(refund, order, payment, actor);

    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          paymentStatus: deriveOrderPaymentStatus({
            order,
            refundStatus: updated.status,
            refundAmount: updated.amount,
            grossAmount: updated.grossAmount || order.totalAmount,
          }),
          "refundSummary.status":
            updated.status === "PROCESSED"
              ? "REFUNDED"
              : updated.status === "FAILED"
                ? "FAILED"
                : "PROCESSING",
          "refundSummary.retryCount": Number(updated.attemptCount || 0),
          "refundSummary.lastAttemptAt": new Date(),
          "refundSummary.failureReason": updated.failureReason || "",
        },
      }
    );

    await auditService.log({
      actor,
      action: "refund.retried",
      entityType: "Refund",
      entityId: refundId,
      metadata: { refundMethod: refund.refundMethod },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      refund: await refundRepo.findById(refundId),
      order: await orderRepo.findById(order._id),
      payment: payment?._id ? await paymentRepo.findById(payment._id) : null,
    };
  }

  async getRefundStatus(refundId, actor) {
    const refund = await refundRepo.findById(refundId);
    if (!refund) throw new AppError("Refund not found", 404, "NOT_FOUND");
    const order = await orderRepo.findById(refund.orderId?._id || refund.orderId);
    if (actor?.role === "user" && String(order?.userId?._id || order?.userId) !== String(actor.sub || actor._id)) {
      throw new AppError("Forbidden", 403, "FORBIDDEN");
    }
    return {
      refundId: refund._id,
      status: refund.status,
      refundMethod: refund.refundMethod,
      amount: refund.amount,
      deductionAmount: refund.deductionAmount,
      processedAt: refund.processedAt,
      failedAt: refund.failedAt,
      failureReason: refund.failureReason,
      orderId: order?._id || null,
      orderNumber: order?.orderNumber || "",
    };
  }
}

const service = new CancellationRefundService();
service.__private = {
  getOrderStage,
  getPaymentMethodKey,
  buildRefundPreview,
  calculateDeductionAmount,
  decideRefundMethod,
};

module.exports = service;
