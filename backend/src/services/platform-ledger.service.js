const { PlatformLedger } = require("../models/PlatformLedger");

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

class PlatformLedgerService {
  async recordOrderCommission(order, { session = null } = {}) {
    if (!order || Number(order.platformCommissionAmount || 0) <= 0) return null;
    return await PlatformLedger.findOneAndUpdate(
      {
        source: "ORDER_COMMISSION",
        referenceId: order._id,
        orderId: order._id,
        vendorId: order.sellerId,
      },
      {
        $setOnInsert: {
          type: "CREDIT",
          source: "ORDER_COMMISSION",
          amount: roundMoney(order.platformCommissionAmount),
          referenceId: order._id,
          orderId: order._id,
          vendorId: order.sellerId,
          ruleId: order.commissionSummary?.appliedRuleIds?.[0] || null,
          ruleName: "",
          meta: {
            orderNumber: order.orderNumber,
            categoryId: order.items?.[0]?.commissionSnapshot?.categoryId || null,
            productId: order.items?.[0]?.productId || null,
          },
        },
      },
      { upsert: true, returnDocument: "after", session: session || undefined, setDefaultsOnInsert: true }
    );
  }

  async recordRefundCommissionReversal(order, reversalAmount, refundRef = "", { session = null } = {}) {
    if (!order || Number(reversalAmount || 0) <= 0) return null;
    return await PlatformLedger.findOneAndUpdate(
      {
        source: "REFUND_COMMISSION_REVERSAL",
        referenceId: refundRef || String(order._id),
        orderId: order._id,
        vendorId: order.sellerId,
      },
      {
        $setOnInsert: {
          type: "DEBIT",
          source: "REFUND_COMMISSION_REVERSAL",
          amount: roundMoney(reversalAmount),
          referenceId: refundRef || String(order._id),
          orderId: order._id,
          vendorId: order.sellerId,
          ruleId: order.commissionSummary?.appliedRuleIds?.[0] || null,
          ruleName: "",
          meta: {
            orderNumber: order.orderNumber,
            reason: "Refund commission reversal",
          },
        },
      },
      { upsert: true, returnDocument: "after", session: session || undefined, setDefaultsOnInsert: true }
    );
  }
}

module.exports = new PlatformLedgerService();

