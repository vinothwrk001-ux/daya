const mongoose = require("mongoose");
const VendorWallet = require("../models/VendorWallet");
const { Order } = require("../models/Order");
const vendorRepo = require("../repositories/vendor.repository");
const ledgerService = require("./ledger.service");
const platformLedgerService = require("./platform-ledger.service");
const { logger } = require("../utils/logger");
const { AppError } = require("../utils/AppError");
const {
  calculateOrderSettlementAmount,
  applyOrderCredit,
  buildWalletSnapshot,
  roundMoney,
} = require("./vendorFinance.rules");

function attachSession(query, session) {
  if (session) query.session(session);
  return query;
}

async function executeWithOptionalTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    const message = String(error?.message || "");
    if (
      message.includes("Transaction numbers are only allowed") ||
      message.includes("replica set") ||
      message.includes("standalone")
    ) {
      logger.warn("Mongo transaction unavailable, falling back to non-transactional wallet flow", {
        source: "wallet.service",
      });
      return await work(null);
    }
    throw error;
  } finally {
    await session.endSession().catch(() => {});
  }
}

class WalletService {
  async getVendorContext(userId) {
    const vendor = await vendorRepo.findByUserId(userId);
    if (!vendor) {
      throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
    }
    return vendor;
  }

  async getOrCreateWallet(vendorId, { session = null } = {}) {
    return await VendorWallet.findOneAndUpdate(
      { vendorId },
      { $setOnInsert: { vendorId } },
      {
        returnDocument: "after",
        upsert: true,
        setDefaultsOnInsert: true,
        session: session || undefined,
      }
    );
  }

  async getWalletForVendor(vendorId) {
    await this.releaseEligibleOrderEarnings({ vendorId });
    return await this.getOrCreateWallet(vendorId);
  }

  async getWalletForVendorUser(userId) {
    const vendor = await this.getVendorContext(userId);
    return await this.getWalletForVendor(vendor._id);
  }

  async settleOrderEarning(orderId) {
    return await executeWithOptionalTransaction(async (session) => {
      const order = await attachSession(
        Order.findById(orderId).select(
          "_id sellerId orderNumber totalAmount vendorEarning platformCommissionAmount payoutEligibleAt deliveredAt paymentStatus status vendorWalletReleasedAt"
        ),
        session
      ).exec();

      if (!order) throw new AppError("Order not found", 404, "NOT_FOUND");
      if (order.status !== "Delivered") return { orderId, skipped: true, reason: "ORDER_NOT_DELIVERED" };
      if (order.paymentStatus !== "Paid") return { orderId, skipped: true, reason: "PAYMENT_NOT_CAPTURED" };
      if (order.vendorWalletReleasedAt) return { orderId, skipped: true, reason: "ALREADY_SETTLED" };
      if (!order.payoutEligibleAt || order.payoutEligibleAt > new Date()) {
        return { orderId, skipped: true, reason: "SETTLEMENT_WINDOW_OPEN" };
      }

      const wallet = await this.getOrCreateWallet(order.sellerId, { session });
      const settlementAmount = calculateOrderSettlementAmount(order);
      const walletSnapshot = applyOrderCredit(wallet, settlementAmount);
      let ledgerEntry;
      try {
        ledgerEntry = await ledgerService.createEntry({
          vendorId: order.sellerId,
          type: "CREDIT",
          amount: settlementAmount,
          source: "ORDER",
          referenceId: order._id,
          walletSnapshot,
          meta: {
            orderNumber: order.orderNumber,
            payoutEligibleAt: order.payoutEligibleAt,
          },
          session,
        });
      } catch (error) {
        if (error?.code === 11000) {
          return { orderId, skipped: true, reason: "ALREADY_SETTLED" };
        }
        throw error;
      }

      const updatedWallet = await VendorWallet.findOneAndUpdate(
        { _id: wallet._id },
        { $set: walletSnapshot },
        { returnDocument: "after", session: session || undefined, runValidators: true }
      );

      await Order.updateOne(
        {
          _id: order._id,
          $or: [{ vendorWalletReleasedAt: { $exists: false } }, { vendorWalletReleasedAt: null }],
        },
        {
          $set: {
            vendorWalletReleasedAt: new Date(),
            vendorWalletReleaseReferenceId: ledgerEntry._id,
          },
        },
        { session: session || undefined }
      );

      await platformLedgerService.recordOrderCommission(order, { session });

      return {
        orderId: order._id,
        wallet: updatedWallet,
        ledgerEntry,
        settledAmount: settlementAmount,
      };
    });
  }

  async releaseEligibleOrderEarnings({ vendorId = null, limit = 100 } = {}) {
    const query = {
      status: "Delivered",
      paymentStatus: "Paid",
      payoutEligibleAt: { $lte: new Date() },
      isActive: true,
      $or: [{ vendorWalletReleasedAt: { $exists: false } }, { vendorWalletReleasedAt: null }],
    };

    if (vendorId) query.sellerId = vendorId;

    const orders = await Order.find(query).sort({ payoutEligibleAt: 1 }).limit(Math.max(Number(limit) || 100, 1)).select("_id").lean();
    const results = [];
    for (const order of orders) {
      results.push(await this.settleOrderEarning(order._id));
    }
    return {
      processed: results.filter((item) => !item.skipped).length,
      skipped: results.filter((item) => item.skipped).length,
      results,
    };
  }

  async assertLedgerConsistency(vendorId) {
    const wallet = await this.getOrCreateWallet(vendorId);
    const latestEntry = await require("../models/Ledger").Ledger.findOne({ vendorId }).sort({ createdAt: -1 }).lean();
    if (!latestEntry) {
      return {
        wallet: buildWalletSnapshot(wallet),
        ledgerMatchesWallet: roundMoney(wallet.availableBalance) === 0 &&
          roundMoney(wallet.pendingBalance) === 0 &&
          roundMoney(wallet.withdrawnAmount) === 0 &&
          roundMoney(wallet.totalEarnings) === 0,
      };
    }
    return {
      wallet: buildWalletSnapshot(wallet),
      latestLedgerSnapshot: latestEntry.walletSnapshot,
      ledgerMatchesWallet:
        JSON.stringify(buildWalletSnapshot(wallet)) === JSON.stringify(buildWalletSnapshot(latestEntry.walletSnapshot)),
    };
  }
}

module.exports = new WalletService();
