const mongoose = require("mongoose");
const { Order } = require("../../models/Order");
const { AppError } = require("../../utils/AppError");
const { emitDomainEvent, registerHandler } = require("../events/event-bus");
const { INFLUENCER_EVENTS } = require("../shared/constants");
const { roundMoney } = require("../shared/helpers");
const { InfluencerWallet, InfluencerLedger, CommissionRecord } = require("./models");
const { Reel } = require("../reel/model");

const HOLD_DAYS = Number(process.env.INFLUENCER_HOLD_DAYS || 7);

function buildCommissionRecordKey(orderId) {
  return `commission:${orderId}`;
}

function buildLedgerKey(orderId, type) {
  return `commission:${type.toLowerCase()}:${orderId}`;
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
      return await work(null);
    }
    throw error;
  } finally {
    await session.endSession().catch(() => {});
  }
}

function attachSession(query, session) {
  if (session) query.session(session);
  return query;
}

async function getOrCreateWallet(influencerId, session = null) {
  return await InfluencerWallet.findOneAndUpdate(
    { influencerId },
    { $setOnInsert: { influencerId } },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      session: session || undefined,
    }
  );
}

class CommissionService {
  async createHoldRecord(order, session = null) {
    if (!order?.attribution?.influencerId) return null;

    const payload = {
      orderId: order._id,
      vendorId: order.sellerId,
      influencerId: order.attribution.influencerId,
      campaignId: order.attribution.campaignId,
      reelId: order.attribution.reelId,
      trackingSessionId: order.attribution.trackingSessionId,
      state: "HOLD",
      idempotencyKey: buildCommissionRecordKey(order._id),
      holdUntil: order.payoutEligibleAt || new Date(Date.now() + HOLD_DAYS * 24 * 60 * 60 * 1000),
      gross: roundMoney(order.subtotal || 0),
      platformFee: roundMoney(order.attribution?.commission?.platformFee || order.platformCommissionAmount || 0),
      influencerShare: roundMoney(order.attribution.commission?.influencerShare || 0),
      vendorNet: roundMoney(order.attribution?.commission?.vendorNet || order.vendorEarning || 0),
      commissionPercent: roundMoney(order.attribution.commission?.commissionPercent || 0),
      metadata: {
        orderNumber: order.orderNumber,
        productId: order.attribution.productId,
      },
    };

    return await CommissionRecord.findOneAndUpdate(
      { orderId: order._id },
      { $setOnInsert: payload },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        session: session || undefined,
      }
    );
  }

  async settleForOrder(orderId) {
    return await executeWithOptionalTransaction(async (session) => {
      const order = await attachSession(Order.findById(orderId), session).lean();
      if (!order) throw new AppError("Order not found", 404, "NOT_FOUND");
      if (!order.attribution?.influencerId) return { skipped: true, reason: "NO_ATTRIBUTION" };
      if (order.status !== "Delivered") return { skipped: true, reason: "ORDER_NOT_DELIVERED" };
      if (order.paymentStatus !== "Paid") return { skipped: true, reason: "PAYMENT_NOT_CAPTURED" };

      const holdRecord = await this.createHoldRecord(order, session);
      if (!holdRecord) return { skipped: true, reason: "NO_COMMISSION_RECORD" };
      if (holdRecord.state === "SETTLED") return { skipped: true, reason: "ALREADY_SETTLED" };
      if (holdRecord.state === "REVERSED") return { skipped: true, reason: "ALREADY_REVERSED" };
      if (holdRecord.holdUntil > new Date()) return { skipped: true, reason: "HOLD_OPEN" };

      const alreadyLedgered = await attachSession(
        InfluencerLedger.findOne({ idempotencyKey: buildLedgerKey(order._id, "COMMISSION") }),
        session
      ).lean();
      if (alreadyLedgered) {
        await CommissionRecord.updateOne(
          { _id: holdRecord._id, state: { $ne: "SETTLED" } },
          { $set: { state: "SETTLED", settledAt: new Date() } },
          { session: session || undefined }
        );
        return { skipped: true, reason: "ALREADY_SETTLED" };
      }

      const updatedRecord = await CommissionRecord.findOneAndUpdate(
        {
          _id: holdRecord._id,
          state: "HOLD",
          holdUntil: { $lte: new Date() },
        },
        {
          $set: {
            state: "SETTLED",
            settledAt: new Date(),
          },
        },
        {
          new: true,
          session: session || undefined,
        }
      );

      if (!updatedRecord) {
        const latest = await attachSession(CommissionRecord.findOne({ orderId }), session).lean();
        return { skipped: true, reason: latest?.state === "SETTLED" ? "ALREADY_SETTLED" : "STATE_CHANGED" };
      }

      const wallet = await getOrCreateWallet(updatedRecord.influencerId, session);
      const nextAvailable = roundMoney(wallet.availableBalance) + roundMoney(updatedRecord.influencerShare);
      const nextTotal = roundMoney(wallet.totalEarnings) + roundMoney(updatedRecord.influencerShare);

      const updatedWallet = await InfluencerWallet.findByIdAndUpdate(
        wallet._id,
        {
          $set: {
            availableBalance: nextAvailable,
            totalEarnings: nextTotal,
          },
        },
        {
          new: true,
          runValidators: true,
          session: session || undefined,
        }
      );

      await InfluencerLedger.create(
        [
          {
            influencerId: updatedRecord.influencerId,
            orderId: order._id,
            type: "CREDIT",
            amount: updatedRecord.influencerShare,
            source: "COMMISSION",
            idempotencyKey: buildLedgerKey(order._id, "COMMISSION"),
            balanceAfter: updatedWallet.availableBalance,
            meta: {
              campaignId: updatedRecord.campaignId,
              reelId: updatedRecord.reelId,
              trackingSessionId: updatedRecord.trackingSessionId,
            },
          },
        ],
        { session: session || undefined }
      );

      return {
        settled: true,
        record: updatedRecord,
        wallet: updatedWallet,
      };
    }).then(async (result) => {
      if (result?.settled) {
        await emitDomainEvent(INFLUENCER_EVENTS.COMMISSION_DISTRIBUTED, {
          orderId,
          influencerId: result.record.influencerId,
          amount: result.record.influencerShare,
        });
      }
      return result;
    });
  }

  async reverseForRefund(orderId) {
    return await executeWithOptionalTransaction(async (session) => {
      const record = await attachSession(CommissionRecord.findOne({ orderId }), session);
      if (!record) return { skipped: true, reason: "NOT_FOUND" };
      if (record.state === "REVERSED") return { skipped: true, reason: "ALREADY_REVERSED" };
      if (record.state === "CANCELLED") return { skipped: true, reason: "ALREADY_CANCELLED" };

      if (record.state === "HOLD") {
        await CommissionRecord.updateOne(
          { _id: record._id, state: "HOLD" },
          { $set: { state: "CANCELLED", reversedAt: new Date() } },
          { session: session || undefined }
        );
        return { cancelled: true };
      }

      if (record.state !== "SETTLED") {
        return { skipped: true, reason: "NOT_SETTLED" };
      }

      const reversalKey = buildLedgerKey(orderId, "REVERSAL");
      const existingReversal = await attachSession(InfluencerLedger.findOne({ idempotencyKey: reversalKey }), session).lean();
      if (existingReversal) {
        await CommissionRecord.updateOne(
          { _id: record._id, state: { $ne: "REVERSED" } },
          { $set: { state: "REVERSED", reversedAt: new Date() } },
          { session: session || undefined }
        );
        return { skipped: true, reason: "ALREADY_REVERSED" };
      }

      const updatedRecord = await CommissionRecord.findOneAndUpdate(
        { _id: record._id, state: "SETTLED" },
        { $set: { state: "REVERSED", reversedAt: new Date() } },
        { new: true, session: session || undefined }
      );

      if (!updatedRecord) return { skipped: true, reason: "STATE_CHANGED" };

      const wallet = await getOrCreateWallet(record.influencerId, session);
      if (roundMoney(wallet.availableBalance) < roundMoney(record.influencerShare)) {
        throw new AppError("Influencer wallet does not have enough available balance for reversal", 409, "REVERSAL_BLOCKED");
      }

      const updatedWallet = await InfluencerWallet.findByIdAndUpdate(
        wallet._id,
        {
          $set: {
            availableBalance: roundMoney(wallet.availableBalance) - roundMoney(record.influencerShare),
            reversedAmount: roundMoney(wallet.reversedAmount) + roundMoney(record.influencerShare),
          },
        },
        {
          new: true,
          runValidators: true,
          session: session || undefined,
        }
      );

      await InfluencerLedger.create(
        [
          {
            influencerId: record.influencerId,
            orderId,
            type: "DEBIT",
            amount: record.influencerShare,
            source: "REVERSAL",
            idempotencyKey: reversalKey,
            balanceAfter: updatedWallet.availableBalance,
            meta: {
              campaignId: record.campaignId,
              reelId: record.reelId,
              trackingSessionId: record.trackingSessionId,
            },
          },
        ],
        { session: session || undefined }
      );

      return { reversed: true, wallet: updatedWallet };
    });
  }

  async settleEligibleOrders() {
    const eligible = await CommissionRecord.find({
      state: "HOLD",
      holdUntil: { $lte: new Date() },
    })
      .select("orderId")
      .lean();

    const results = [];
    for (const record of eligible) {
      results.push(await this.settleForOrder(record.orderId));
    }

    return {
      processed: results.filter((item) => item?.settled).length,
      results,
    };
  }

  async getInfluencerWallet(userId, influencerId) {
    if (!influencerId) {
      const profile = await require("../influencer/service").getProfile(userId);
      influencerId = profile._id;
    }
    const wallet = await getOrCreateWallet(influencerId);
    const ledger = await InfluencerLedger.find({ influencerId }).sort({ createdAt: -1 }).limit(50).lean();
    return { wallet, ledger };
  }

  async getInfluencerDashboard(userId) {
    const profile = await require("../influencer/service").getProfile(userId);
    const influencerId = profile._id;
    const wallet = await getOrCreateWallet(influencerId);

    const [pendingAgg, orderCount, clickAgg] = await Promise.all([
      CommissionRecord.aggregate([
        { $match: { influencerId, state: "HOLD" } },
        { $group: { _id: null, total: { $sum: "$influencerShare" } } },
      ]),
      CommissionRecord.countDocuments({
        influencerId,
        state: { $in: ["HOLD", "SETTLED"] },
      }),
      Reel.aggregate([{ $match: { influencerId } }, { $group: { _id: null, clicks: { $sum: "$metrics.clicks" } } }]),
    ]);

    const pendingEarnings = roundMoney(pendingAgg[0]?.total || 0);
    const totalClicks = Number(clickAgg[0]?.clicks || 0);
    const totalOrders = orderCount;
    const conversionRate = totalClicks > 0 ? roundMoney((totalOrders / totalClicks) * 100) : 0;

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 30);
    const credits = await InfluencerLedger.find({
      influencerId,
      type: "CREDIT",
      source: "COMMISSION",
      createdAt: { $gte: since },
    })
      .sort({ createdAt: 1 })
      .select("amount createdAt")
      .lean();

    const earningsByDayMap = new Map();
    for (const row of credits) {
      const key = new Date(row.createdAt).toISOString().slice(0, 10);
      earningsByDayMap.set(key, roundMoney((earningsByDayMap.get(key) || 0) + Number(row.amount || 0)));
    }
    const earningsOverTime = [...earningsByDayMap.entries()].map(([date, amount]) => ({ date, amount }));

    const recentLedger = await InfluencerLedger.find({ influencerId })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    const recentActivity = recentLedger.map((entry) => ({
      id: String(entry._id),
      type: "ledger",
      title: entry.type === "CREDIT" ? "Commission credited" : "Balance adjustment",
      detail: entry.source === "COMMISSION" ? "Order commission" : entry.source,
      amount: entry.amount,
      entryType: entry.type,
      createdAt: entry.createdAt,
    }));

    return {
      totalEarnings: roundMoney(wallet.totalEarnings || 0),
      pendingEarnings,
      totalOrders,
      totalClicks,
      conversionRate,
      availableBalance: roundMoney(wallet.availableBalance || 0),
      earningsOverTime,
      recentActivity,
    };
  }

  async getInfluencerEarnings(userId, query = {}) {
    const profile = await require("../influencer/service").getProfile(userId);
    const influencerId = profile._id;
    const wallet = await getOrCreateWallet(influencerId);

    const pendingAgg = await CommissionRecord.aggregate([
      { $match: { influencerId, state: "HOLD" } },
      { $group: { _id: null, total: { $sum: "$influencerShare" } } },
    ]);
    const pending = roundMoney(pendingAgg[0]?.total || 0);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const ledgerFilter = { influencerId };
    if (query.type === "CREDIT" || query.type === "DEBIT") {
      ledgerFilter.type = query.type;
    }
    if (query.source === "COMMISSION" || query.source === "REVERSAL") {
      ledgerFilter.source = query.source;
    }
    if (query.from || query.to) {
      ledgerFilter.createdAt = {};
      if (query.from) ledgerFilter.createdAt.$gte = new Date(query.from);
      if (query.to) ledgerFilter.createdAt.$lte = new Date(query.to);
    }

    const [transactions, total] = await Promise.all([
      InfluencerLedger.find(ledgerFilter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      InfluencerLedger.countDocuments(ledgerFilter),
    ]);

    return {
      available: roundMoney(wallet.availableBalance || 0),
      pending,
      withdrawn: roundMoney(wallet.withdrawnBalance || 0),
      transactions,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getOverview() {
    const [records, ledgers] = await Promise.all([
      CommissionRecord.find({})
        .populate("influencerId", "userId")
        .populate("vendorId", "shopName companyName")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      InfluencerLedger.find({}).sort({ createdAt: -1 }).limit(100).lean(),
    ]);
    return { records, ledgers };
  }

  registerEventHandlers() {
    registerHandler(INFLUENCER_EVENTS.ORDER_DELIVERED, async ({ orderId }) => {
      await this.settleForOrder(orderId);
    });
    registerHandler(INFLUENCER_EVENTS.ORDER_ELIGIBLE_FOR_SETTLEMENT, async ({ orderId }) => {
      await this.settleForOrder(orderId);
    });
  }
}

module.exports = new CommissionService();
