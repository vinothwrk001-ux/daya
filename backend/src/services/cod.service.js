const crypto = require("crypto");
const { AppError } = require("../utils/AppError");
const CODConfig = require("../models/CODConfig");
const Shipment = require("../models/Shipment");
const VendorOrder = require("../models/VendorOrder");
const { Order } = require("../models/Order");
const { Payment } = require("../models/Payment");
const productRepo = require("../repositories/product.repository");
const userRepo = require("../repositories/user.repository");
const walletService = require("./wallet.service");
const { emitDomainEvent } = require("../modules/events/event-bus");

const COD_EVENTS = {
  COD_ORDER_PLACED: "COD_ORDER_PLACED",
  COD_COLLECTED: "COD_COLLECTED",
  SHIPMENT_CREATED: "SHIPMENT_CREATED",
  VENDOR_ORDER_CREATED: "VENDOR_ORDER_CREATED",
  SETTLEMENT_TRIGGERED: "SETTLEMENT_TRIGGERED",
};

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function normalizePostalCode(value = "") {
  return String(value || "").trim();
}

function normalizeState(value = "") {
  return String(value || "").trim().toLowerCase();
}

function buildSettlementRef(order) {
  return `cod_${String(order?._id || "")}_${crypto.randomBytes(4).toString("hex")}`;
}

class CODService {
  async getConfig() {
    let config = await CODConfig.findOne({}).sort({ updatedAt: -1 });
    if (!config) {
      config = await CODConfig.create({});
    }
    return config;
  }

  async updateConfig(payload = {}, actorId = null) {
    const config = await this.getConfig();
    Object.assign(config, payload, { updatedBy: actorId || config.updatedBy });
    await config.save();
    return config;
  }

  matchZoneRule(config, address = {}) {
    const postalCode = normalizePostalCode(address.postalCode);
    const state = normalizeState(address.state);
    return (config.zoneRules || []).find((rule) => {
      if (!rule.isActive) return false;
      const rulePostalCodes = Array.isArray(rule.postalCodes) ? rule.postalCodes.map(normalizePostalCode) : [];
      const ruleStates = Array.isArray(rule.states) ? rule.states.map(normalizeState) : [];
      return rulePostalCodes.includes(postalCode) || ruleStates.includes(state);
    }) || null;
  }

  getCodFeeFromCharges(charges = []) {
    return roundMoney(
      (charges || [])
        .filter((charge) => {
          const key = String(charge?.key || "").toLowerCase();
          const label = String(charge?.displayName || "").toLowerCase();
          return key.includes("cod") || label.includes("cod");
        })
        .reduce((sum, charge) => sum + Number(charge?.amount || 0), 0)
    );
  }

  async evaluateEligibility({ userId, address, cartItems = [], subtotal = 0, riskScore = null }) {
    const config = await this.getConfig();
    const reasons = [];

    if (!config.isEnabled) reasons.push("COD_DISABLED");
    if (!address?.postalCode) reasons.push("ADDRESS_REQUIRED");
    if (subtotal > Number(config.maxOrderValue || 0) && Number(config.maxOrderValue || 0) > 0) reasons.push("ORDER_VALUE_EXCEEDED");
    if (subtotal < Number(config.minOrderValue || 0)) reasons.push("ORDER_VALUE_BELOW_MINIMUM");

    const postalCode = normalizePostalCode(address?.postalCode);
    const state = normalizeState(address?.state);
    if ((config.restrictedPostalCodes || []).map(normalizePostalCode).includes(postalCode)) reasons.push("PINCODE_RESTRICTED");
    if ((config.restrictedStates || []).map(normalizeState).includes(state)) reasons.push("ZONE_RESTRICTED");

    const zoneRule = this.matchZoneRule(config, address);
    if (config.disabledForRemoteZones && zoneRule?.isRemote) reasons.push("REMOTE_ZONE_RESTRICTED");

    let effectiveRiskScore = Number.isFinite(Number(riskScore)) ? Number(riskScore) : 0;
    const user = userId ? await userRepo.findById(userId) : null;
    if (effectiveRiskScore === 0) {
      effectiveRiskScore = Number(user?.fraudScore || user?.riskScore || 0);
    }
    if (effectiveRiskScore > Number(config.maxRiskScore || 0)) reasons.push("HIGH_RISK_CUSTOMER");

    for (const item of cartItems) {
      const productId = item?.productId?._id || item?.productId;
      const sellerId = item?.sellerId?._id || item?.sellerId;
      if (productId && (config.restrictedProductIds || []).some((id) => String(id) === String(productId))) {
        reasons.push(`PRODUCT_RESTRICTED:${productId}`);
      }
      if (sellerId && (config.restrictedVendorIds || []).some((id) => String(id) === String(sellerId))) {
        reasons.push(`VENDOR_RESTRICTED:${sellerId}`);
      }

      if (productId && !sellerId) {
        const product = await productRepo.findById(productId);
        const resolvedSellerId = product?.sellerId || null;
        if (resolvedSellerId && (config.restrictedVendorIds || []).some((id) => String(id) === String(resolvedSellerId))) {
          reasons.push(`VENDOR_RESTRICTED:${resolvedSellerId}`);
        }
      }
    }

    return {
      codAvailable: reasons.length === 0,
      reasons,
      zoneRule,
      config,
      riskScore: effectiveRiskScore,
    };
  }

  buildOrderPriceBreakdown({ pricingBreakdown = {}, subtotal = 0, shippingFee = 0, taxAmount = 0, discountAmount = 0, totalAmount = 0, paymentMethod = "COD", currency = "INR" }) {
    return {
      subtotal: roundMoney(subtotal),
      shippingFee: roundMoney(shippingFee),
      codFee: this.getCodFeeFromCharges(pricingBreakdown.charges || []),
      taxAmount: roundMoney(taxAmount),
      discountAmount: roundMoney(discountAmount),
      chargesTotal: roundMoney(pricingBreakdown.chargesTotal || 0),
      totalAmount: roundMoney(totalAmount),
      currency,
      paymentMethod,
      charges: pricingBreakdown.charges || [],
      calculatedAt: pricingBreakdown.calculatedAt ? new Date(pricingBreakdown.calculatedAt) : new Date(),
    };
  }

  async createShipmentRecord(order, { session = null } = {}) {
    const [shipment] = await Shipment.create(
      [
        {
          orderId: order._id,
          orderGroupId: order.orderGroupId || "",
          vendorId: order.sellerId?._id || order.sellerId,
          shipmentId: order.shipmentId || "",
          paymentMethod: order.paymentMethod,
          prepaid: order.paymentMethod === "ONLINE",
          shipmentStatus: "PENDING",
          shippingMode: order.shippingMode || "SELF",
          codAmountCollectable: order.paymentMethod === "COD" ? roundMoney(order.totalAmount || 0) : 0,
          shippingAddressSnapshot: order.shippingAddress || {},
        },
      ],
      { session: session || undefined }
    );

    return shipment;
  }

  async createVendorOrderRecord(order, { session = null } = {}) {
    const [vendorOrder] = await VendorOrder.create(
      [
        {
          orderId: order._id,
          orderGroupId: order.orderGroupId || "",
          vendorId: order.sellerId?._id || order.sellerId,
          userId: order.userId?._id || order.userId,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          subtotal: order.subtotal,
          totalAmount: order.totalAmount,
          codAmount: order.paymentMethod === "COD" ? roundMoney(order.totalAmount || 0) : 0,
          shipmentId: order.shipmentId || "",
          settlementStatus:
            order.paymentMethod === "COD" ? "PENDING_COLLECTION" : "NOT_APPLICABLE",
          vendorSettlementStatus:
            order.paymentMethod === "COD" ? "PENDING_COLLECTION" : "NOT_APPLICABLE",
        },
      ],
      { session: session || undefined }
    );

    return vendorOrder;
  }

  async syncShipmentForOrder(order, changes = {}, { session = null } = {}) {
    return await Shipment.findOneAndUpdate(
      { orderId: order._id },
      { $set: changes },
      { new: true, session: session || undefined }
    );
  }

  async collectPayment({ orderId, orderGroupId, actor = "SYSTEM", collectedAmount = null, reference = "", actorId = null }) {
    const query = orderId ? { _id: orderId } : { orderGroupId };
    const orders = await Order.find(query);
    if (!orders.length) {
      throw new AppError("COD order not found", 404, "COD_ORDER_NOT_FOUND");
    }

    const totalCollectable = roundMoney(orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0));
    const amountToCollect = roundMoney(collectedAmount == null ? totalCollectable : collectedAmount);
    if (amountToCollect !== totalCollectable) {
      throw new AppError("Collected amount does not match COD payable total", 400, "COD_AMOUNT_MISMATCH");
    }

    const paymentRecordId = orders[0].paymentRecordId;
    const payment = paymentRecordId ? await Payment.findById(paymentRecordId) : null;
    const config = await this.getConfig();
    const holdDays = Number(config.vendorHoldDays || 0);
    const holdUntil = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000);

    for (const order of orders) {
      order.paymentStatus = "Paid";
      order.paymentCapturedAt = new Date();
      order.settlementStatus = "COLLECTED";
      order.cod.status = "collected";
      order.cod.collectedAt = new Date();
      order.cod.collectedBy = String(actor || "SYSTEM");
      order.cod.collectedReference = String(reference || "");
      order.cod.holdUntil = holdUntil;
      order.payoutEligibleAt = holdUntil;
      if (order.attribution && !order.attribution.lockedAt) {
        order.attribution.lockedAt = new Date();
      }
      order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
      order.timeline.push({
        status: "Placed",
        note: "COD payment collected",
        timestamp: new Date(),
      });
      await order.save();

      await VendorOrder.findOneAndUpdate(
        { orderId: order._id },
        {
          $set: {
            paymentStatus: "Paid",
            settlementStatus: "COLLECTED",
            vendorSettlementStatus: "COLLECTED",
          },
        }
      );

      await this.syncShipmentForOrder(order, {
        shipmentStatus: order.status === "Delivered" ? "DELIVERED" : "READY",
        codAmountCollectable: 0,
      });
    }

    if (payment) {
      payment.status = "PAID";
      payment.paidAt = new Date();
      payment.codDetails.status = "collected";
      payment.codDetails.collectedAt = new Date();
      payment.codDetails.collectedAmount = amountToCollect;
      payment.codDetails.collectedBy = actor;
      payment.codDetails.collectionReference = reference;
      await payment.save();
    }

    await emitDomainEvent(COD_EVENTS.COD_COLLECTED, {
      orderGroupId: orders[0].orderGroupId,
      paymentRecordId,
      amount: amountToCollect,
      actor,
      actorId,
    }).catch(() => {});

    await emitDomainEvent(COD_EVENTS.SETTLEMENT_TRIGGERED, {
      orderGroupId: orders[0].orderGroupId,
      orderIds: orders.map((order) => order._id),
      holdUntil,
    }).catch(() => {});

    return {
      orderGroupId: orders[0].orderGroupId,
      amountCollected: amountToCollect,
      orders,
      payment,
      holdUntil,
    };
  }

  async cancelCodOrder(orderId, { reason = "COD order cancelled" } = {}) {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError("Order not found", 404, "NOT_FOUND");
    if (order.paymentMethod !== "COD") throw new AppError("Order is not COD", 400, "INVALID_PAYMENT_METHOD");

    order.status = "Cancelled";
    order.paymentStatus = "Failed";
    order.cancelledAt = new Date();
    order.cancelReason = reason;
    order.settlementStatus = "CANCELLED";
    order.cod.status = "cancelled";
    order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
    order.timeline.push({
      status: "Cancelled",
      note: reason,
      timestamp: new Date(),
    });
    await order.save();

    await VendorOrder.findOneAndUpdate(
      { orderId: order._id },
      { $set: { paymentStatus: "Failed", settlementStatus: "CANCELLED", vendorSettlementStatus: "CANCELLED" } }
    );
    await this.syncShipmentForOrder(order, { shipmentStatus: "CANCELLED", codAmountCollectable: 0 });

    if (order.paymentRecordId) {
      await Payment.findByIdAndUpdate(order.paymentRecordId, {
        $set: {
          status: "FAILED",
          "codDetails.status": "cancelled",
        },
      });
    }

    return order;
  }

  async settleCollectedOrder(orderId) {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError("Order not found", 404, "NOT_FOUND");
    if (order.paymentMethod !== "COD") return { skipped: true, reason: "NOT_COD" };
    if (order.cod?.status !== "collected") return { skipped: true, reason: "NOT_COLLECTED" };

    const result = await walletService.settleOrderEarning(orderId);
    if (result?.skipped) return result;
    const settlementRef = buildSettlementRef(order);

    await Order.updateOne(
      { _id: orderId },
      { $set: { settlementStatus: "SETTLED" } }
    );
    await VendorOrder.updateOne(
      { orderId },
      { $set: { settlementStatus: "SETTLED", vendorSettlementStatus: "SETTLED" } }
    );
    if (result.ledgerEntry?._id) {
      const Ledger = require("../models/Ledger").Ledger;
      await Ledger.updateOne(
        { _id: result.ledgerEntry._id },
        {
          $set: {
            source: "COD_SETTLEMENT",
            codFee: this.getCodFeeFromCharges(order.priceBreakdown?.charges || order.chargesBreakdown || []),
            settlementRef,
          },
        }
      );
    }

    return { settled: true, settlementRef, result };
  }

  async getAnalytics({ days = 30 } = {}) {
    const start = new Date(Date.now() - Number(days || 30) * 24 * 60 * 60 * 1000);
    const orders = await Order.find({
      paymentMethod: "COD",
      createdAt: { $gte: start },
    }).select("status paymentStatus cod totalAmount createdAt");

    const total = orders.length;
    const collected = orders.filter((order) => order.cod?.status === "collected").length;
    const failed = orders.filter((order) => order.cod?.status === "failed" || order.status === "Cancelled").length;
    const rto = orders.filter((order) => order.status === "Returned").length;

    return {
      totalOrders: total,
      totalAmount: roundMoney(orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0)),
      collectedOrders: collected,
      failedOrders: failed,
      returnedOrders: rto,
      successRate: total ? roundMoney((collected / total) * 100) : 0,
      failureRate: total ? roundMoney((failed / total) * 100) : 0,
      rtoPercentage: total ? roundMoney((rto / total) * 100) : 0,
    };
  }
}

module.exports = new CODService();
module.exports.COD_EVENTS = COD_EVENTS;
