const mongoose = require("mongoose");
const { Order } = require("../../models/Order");
const { AppError } = require("../../utils/AppError");
const { emitDomainEvent, registerHandler } = require("../events/event-bus");
const { INFLUENCER_EVENTS } = require("../shared/constants");
const { roundMoney } = require("../shared/helpers");
const {
  InfluencerWallet,
  InfluencerLedger,
  CommissionRecord,
  InfluencerPayoutAccount,
  InfluencerWithdrawalRequest,
} = require("./models");
const { Reel } = require("../reel/model");
const { Campaign } = require("../campaign/model");
const {
  InfluencerProfile,
  InfluencerSocialAccount,
} = require("../influencer/model");
const auditService = require("../../services/audit.service");
const { getEncryptionService, EncryptionService } = require("../../utils/encryption");

const HOLD_DAYS = Number(process.env.INFLUENCER_HOLD_DAYS || 7);
const MIN_WITHDRAWAL_AMOUNT = Number(process.env.INFLUENCER_MIN_WITHDRAWAL_AMOUNT || 500);
const MAX_WITHDRAWAL_AMOUNT = Number(process.env.INFLUENCER_MAX_WITHDRAWAL_AMOUNT || 1000000);

function buildCommissionRecordKey(orderId) {
  return `commission:${orderId}`;
}

function buildLedgerKey(orderId, type) {
  return `commission:${type.toLowerCase()}:${orderId}`;
}

function buildWithdrawalLedgerKey(requestId, type = "request") {
  return `withdrawal:${type}:${requestId}`;
}

function startOfDay(date) {
  const next = new Date(date);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseDashboardRange(query = {}) {
  const now = new Date();
  const range = String(query.range || "30d").toLowerCase();
  let end = query.endDate ? new Date(query.endDate) : now;
  if (Number.isNaN(end.getTime())) end = now;
  let start;

  if (query.startDate) {
    start = new Date(query.startDate);
  } else if (range === "today") {
    start = startOfDay(now);
  } else if (range === "7d") {
    start = addDays(now, -6);
  } else if (range === "90d") {
    start = addDays(now, -89);
  } else if (range === "12m") {
    start = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate()));
  } else {
    start = addDays(now, -29);
  }

  if (Number.isNaN(start.getTime())) start = addDays(now, -29);
  return { start: startOfDay(start), end };
}

function objectIdOrNull(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function percentChange(current, previous) {
  const currentValue = Number(current || 0);
  const previousValue = Number(previous || 0);
  if (!previousValue) return currentValue ? 100 : 0;
  return roundMoney(((currentValue - previousValue) / previousValue) * 100);
}

function buildDateBuckets(start, end) {
  const buckets = [];
  const cursor = startOfDay(start);
  const last = startOfDay(end);
  while (cursor <= last) {
    const key = cursor.toISOString().slice(0, 10);
    buckets.push({ date: key, revenue: 0, commission: 0, orders: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return buckets;
}

function includesProduct(order, productId) {
  if (!productId) return true;
  return (order?.items || []).some((item) => String(item.productId?._id || item.productId) === String(productId));
}

function productImage(product) {
  const first = Array.isArray(product?.images) ? product.images[0] : null;
  return typeof first === "string" ? first : first?.url || "";
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

function maskSensitive(value = "") {
  if (!value) return "";
  return EncryptionService.maskString(String(value));
}

function maskInfluencerPayoutAccount(account) {
  if (!account) return null;
  const encService = getEncryptionService();
  const doc = account.toObject ? account.toObject() : account;
  let accountNumber = "";
  let upiId = "";
  try {
    accountNumber = doc.accountNumberEncrypted ? maskSensitive(encService.decrypt(doc.accountNumberEncrypted)) : "";
  } catch (error) {
    accountNumber = "XXXX****";
  }
  try {
    upiId = doc.upiIdEncrypted ? maskSensitive(encService.decrypt(doc.upiIdEncrypted)) : "";
  } catch (error) {
    upiId = "XXXX****";
  }
  return {
    _id: doc._id,
    influencerId: doc.influencerId,
    accountHolderName: doc.accountHolderName,
    accountNumber,
    ifscCode: doc.ifscCode,
    bankName: doc.bankName,
    upiId,
    paypalEmail: doc.paypalEmail,
    paymentMethod: doc.paymentMethod,
    isDefault: doc.isDefault,
    isActive: doc.isActive,
    isVerified: doc.isVerified,
    verificationStatus: doc.verificationStatus,
    rejectionReason: doc.rejectionReason,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function normalizeWithdrawalStatus(tab = "") {
  const value = String(tab || "").toLowerCase();
  if (value === "pending") return ["PENDING", "UNDER_REVIEW"];
  if (value === "approved") return ["APPROVED", "PROCESSING", "PAID"];
  if (value === "rejected") return ["REJECTED", "FAILED", "CANCELLED"];
  if (value === "history") return ["APPROVED", "PROCESSING", "PAID", "FAILED"];
  return [];
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

  async getInfluencerDashboard(userId, query = {}) {
    const profile = await require("../influencer/service").getProfile(userId);
    const influencerId = profile._id;
    const wallet = await getOrCreateWallet(influencerId);
    const { start, end } = parseDashboardRange(query);
    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - (end.getTime() - start.getTime()));
    const campaignId = objectIdOrNull(query.campaignId);
    const productId = objectIdOrNull(query.productId);
    const category = query.category ? String(query.category).trim().toLowerCase() : "";
    const brand = query.brand ? String(query.brand).trim().toLowerCase() : "";
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 8));

    const baseRecordMatch = {
      influencerId,
      createdAt: { $gte: start, $lte: end },
    };
    if (campaignId) baseRecordMatch.campaignId = campaignId;

    const previousRecordMatch = {
      influencerId,
      createdAt: { $gte: previousStart, $lte: previousEnd },
    };
    if (campaignId) previousRecordMatch.campaignId = campaignId;

    const campaignFilter = { influencerId };
    if (campaignId) campaignFilter._id = campaignId;

    const reelFilter = { influencerId };
    if (campaignId) reelFilter.campaignId = campaignId;
    if (productId) reelFilter.productIds = productId;

    const [
      currentAgg,
      previousAgg,
      pendingAgg,
      ledgerAgg,
      recentLedger,
      records,
      reels,
      campaigns,
      socialAccounts,
      activeProfile,
    ] = await Promise.all([
      CommissionRecord.aggregate([
        { $match: baseRecordMatch },
        {
          $group: {
            _id: null,
            commission: { $sum: "$influencerShare" },
            gross: { $sum: "$gross" },
            orders: { $sum: 1 },
          },
        },
      ]),
      CommissionRecord.aggregate([
        { $match: previousRecordMatch },
        {
          $group: {
            _id: null,
            commission: { $sum: "$influencerShare" },
            gross: { $sum: "$gross" },
            orders: { $sum: 1 },
          },
        },
      ]),
      CommissionRecord.aggregate([
        { $match: { influencerId, state: "HOLD" } },
        { $group: { _id: null, total: { $sum: "$influencerShare" } } },
      ]),
      InfluencerLedger.aggregate([
        {
          $match: {
            influencerId,
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: "$source",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      InfluencerLedger.find({ influencerId }).sort({ createdAt: -1 }).limit(8).lean(),
      CommissionRecord.find(baseRecordMatch)
        .populate({
          path: "orderId",
          select: "orderNumber userId items totalAmount subtotal status paymentStatus createdAt",
          populate: [
            { path: "userId", select: "name email" },
            { path: "items.productId", select: "name images category brand price discountPrice analytics" },
          ],
        })
        .populate({ path: "campaignId", select: "state commissionPercent fixedFee deadline vendorId createdAt", populate: { path: "vendorId", select: "shopName companyName" } })
        .populate("reelId", "caption videoUrl metrics state publishedAt createdAt productIds")
        .sort({ createdAt: -1 })
        .limit(500)
        .lean(),
      Reel.find(reelFilter)
        .populate({ path: "campaignId", select: "state commissionPercent fixedFee deadline vendorId", populate: { path: "vendorId", select: "shopName companyName" } })
        .sort({ "metrics.orders": -1, "metrics.clicks": -1, createdAt: -1 })
        .limit(10)
        .lean(),
      Campaign.find(campaignFilter)
        .populate("productIds", "name category brand images")
        .populate("vendorId", "shopName companyName")
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
      InfluencerSocialAccount.find({ influencerId }).select("platform followersCount engagementRate updatedAt").lean(),
      InfluencerProfile.findById(influencerId).select("followers stats permissions").lean(),
    ]);

    const filteredRecords = records.filter((record) => {
      const order = record.orderId;
      if (!includesProduct(order, productId)) return false;
      if (!category && !brand) return true;
      return (order?.items || []).some((item) => {
        const product = item.productId || {};
        const productCategory = String(product.category || "").toLowerCase();
        const productBrand = String(product.brand || "").toLowerCase();
        return (!category || productCategory === category) && (!brand || productBrand.includes(brand));
      });
    });

    const current = currentAgg[0] || {};
    const previous = previousAgg[0] || {};
    const totalClicks = reels.reduce((sum, reel) => sum + Number(reel.metrics?.clicks || 0), 0);
    const totalViews = reels.reduce((sum, reel) => sum + Number(reel.metrics?.views || 0), 0);
    const totalOrders = filteredRecords.length;
    const totalEarnings = roundMoney(filteredRecords.reduce((sum, record) => sum + Number(record.influencerShare || 0), 0));
    const grossRevenue = roundMoney(filteredRecords.reduce((sum, record) => sum + Number(record.gross || 0), 0));
    const conversionRate = totalClicks > 0 ? roundMoney((totalOrders / totalClicks) * 100) : 0;
    const averageOrderValue = totalOrders > 0 ? roundMoney(grossRevenue / totalOrders) : 0;
    const followers = Number(activeProfile?.followers || socialAccounts.reduce((sum, account) => sum + Number(account.followersCount || 0), 0));
    const engagementRate = socialAccounts.length
      ? roundMoney(socialAccounts.reduce((sum, account) => sum + Number(account.engagementRate || 0), 0) / socialAccounts.length)
      : 0;

    const revenueBuckets = buildDateBuckets(start, end);
    const revenueMap = new Map(revenueBuckets.map((item) => [item.date, item]));
    for (const record of filteredRecords) {
      const key = new Date(record.createdAt).toISOString().slice(0, 10);
      const row = revenueMap.get(key);
      if (row) {
        row.revenue = roundMoney(row.revenue + Number(record.gross || 0));
        row.commission = roundMoney(row.commission + Number(record.influencerShare || 0));
        row.orders += 1;
      }
    }

    const productRows = new Map();
    for (const record of filteredRecords) {
      const order = record.orderId;
      for (const item of order?.items || []) {
        const product = item.productId || {};
        const id = String(product._id || item.productId || "");
        if (!id) continue;
        if (productId && id !== String(productId)) continue;
        const row = productRows.get(id) || {
          id,
          name: product.name || item.name || "Product",
          image: productImage(product) || item.image || "",
          category: product.category || "",
          brand: product.brand || "",
          orders: 0,
          revenue: 0,
          commission: 0,
          clicks: 0,
        };
        row.orders += Number(item.quantity || 1);
        row.revenue = roundMoney(row.revenue + Number(item.price || 0) * Number(item.quantity || 1));
        row.commission = roundMoney(row.commission + Number(record.influencerShare || 0));
        productRows.set(id, row);
      }
    }

    for (const reel of reels) {
      const linkedProducts = (reel.productIds || []).map((id) => String(id));
      for (const linkedProductId of linkedProducts) {
        const row = productRows.get(linkedProductId);
        if (row) row.clicks += Number(reel.metrics?.clicks || 0);
      }
    }

    const reelRevenue = new Map();
    for (const record of filteredRecords) {
      const id = String(record.reelId?._id || record.reelId || "");
      if (!id) continue;
      const row = reelRevenue.get(id) || { revenue: 0, commission: 0, orders: 0 };
      row.revenue = roundMoney(row.revenue + Number(record.gross || 0));
      row.commission = roundMoney(row.commission + Number(record.influencerShare || 0));
      row.orders += 1;
      reelRevenue.set(id, row);
    }

    const topProducts = [...productRows.values()]
      .map((row) => ({
        ...row,
        ctr: totalViews ? roundMoney((row.clicks / totalViews) * 100) : 0,
        conversionRate: totalClicks ? roundMoney((row.orders / totalClicks) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders)
      .slice(0, 8);

    const topVideos = reels.map((reel) => {
      const money = reelRevenue.get(String(reel._id)) || {};
      const clicks = Number(reel.metrics?.clicks || 0);
      const views = Number(reel.metrics?.views || 0);
      return {
        id: String(reel._id),
        title: reel.caption || "Untitled content",
        thumbnail: reel.videoUrl || "",
        views,
        clicks,
        orders: Number(reel.metrics?.orders || money.orders || 0),
        revenue: roundMoney(money.revenue || 0),
        commission: roundMoney(money.commission || 0),
        ctr: views ? roundMoney((clicks / views) * 100) : 0,
        engagementRate: views ? roundMoney(((clicks + Number(reel.metrics?.orders || 0)) / views) * 100) : 0,
        publishedAt: reel.publishedAt || reel.createdAt,
        status: reel.state,
      };
    });

    const activeCampaigns = campaigns.map((campaign) => {
      const campaignRecords = filteredRecords.filter((record) => String(record.campaignId?._id || record.campaignId) === String(campaign._id));
      return {
        id: String(campaign._id),
        name: campaign.productIds?.[0]?.name || `${campaign.vendorId?.shopName || campaign.vendorId?.companyName || "Brand"} campaign`,
        brand: campaign.vendorId?.shopName || campaign.vendorId?.companyName || "Brand",
        category: campaign.productIds?.[0]?.category || "",
        status: campaign.state,
        startDate: campaign.createdAt,
        endDate: campaign.deadline,
        budget: Number(campaign.fixedFee || 0),
        commissionPercent: Number(campaign.commissionPercent || 0),
        revenueEarned: roundMoney(campaignRecords.reduce((sum, record) => sum + Number(record.influencerShare || 0), 0)),
      };
    });

    const recentOrders = filteredRecords.slice((page - 1) * limit, page * limit).map((record) => {
      const order = record.orderId || {};
      const firstItem = order.items?.[0] || {};
      return {
        id: String(order._id || record.orderId),
        orderNumber: order.orderNumber || String(order._id || record.orderId).slice(-8),
        product: firstItem.name || firstItem.productId?.name || "Product",
        productId: String(firstItem.productId?._id || firstItem.productId || ""),
        customer: order.userId?.name || order.userId?.email || "Customer",
        amount: Number(order.totalAmount || record.gross || 0),
        commission: Number(record.influencerShare || 0),
        status: record.state === "HOLD" ? "Pending" : record.state === "SETTLED" ? "Completed" : record.state,
        orderStatus: order.status,
        createdAt: order.createdAt || record.createdAt,
      };
    });

    const earningsBreakdown = ledgerAgg.map((row) => ({
      source: row._id === "COMMISSION" ? "Product Commissions" : row._id === "REVERSAL" ? "Reversals" : row._id || "Other Earnings",
      amount: roundMoney(row.total || 0),
      count: row.count,
    }));
    const breakdownTotal = earningsBreakdown.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    for (const item of earningsBreakdown) {
      item.percentage = breakdownTotal ? roundMoney((item.amount / breakdownTotal) * 100) : 0;
    }

    const pendingEarnings = roundMoney(pendingAgg[0]?.total || 0);
    const recentActivity = [
      ...recentLedger.map((entry) => ({
        id: String(entry._id),
        type: "wallet",
        title: entry.type === "CREDIT" ? "Commission approved" : "Wallet adjustment",
        message: entry.source === "COMMISSION" ? "Order commission moved through your ledger." : entry.source,
        amount: entry.amount,
        entryType: entry.type,
        createdAt: entry.createdAt,
      })),
      ...activeCampaigns
        .filter((campaign) => campaign.status === "proposed")
        .slice(0, 3)
        .map((campaign) => ({
          id: `campaign-${campaign.id}`,
          type: "campaign",
          title: "Campaign invitation",
          message: `${campaign.brand} invited you to a campaign.`,
          createdAt: campaign.startDate,
        })),
    ]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 10);

    return {
      filters: {
        range: query.range || "30d",
        startDate: start,
        endDate: end,
        campaignId: campaignId ? String(campaignId) : "",
        productId: productId ? String(productId) : "",
        category,
        brand,
      },
      totalEarnings,
      pendingEarnings,
      totalOrders,
      totalClicks,
      conversionRate,
      availableBalance: roundMoney(wallet.availableBalance || 0),
      followers,
      earningsOverTime: [...revenueMap.values()].map((row) => ({ date: row.date, amount: row.commission })),
      recentActivity,
      kpis: [
        { key: "earnings", label: "Total Earnings", value: totalEarnings, format: "currency", growth: percentChange(current.commission, previous.commission), sparkline: [...revenueMap.values()].map((row) => row.commission) },
        { key: "clicks", label: "Product Clicks", value: totalClicks, format: "number", growth: percentChange(totalClicks, 0), sparkline: reels.map((row) => row.metrics?.clicks || 0).slice(0, 12) },
        { key: "orders", label: "Orders Generated", value: totalOrders, format: "number", growth: percentChange(current.orders, previous.orders), sparkline: [...revenueMap.values()].map((row) => row.orders) },
        { key: "conversion", label: "Conversion Rate", value: conversionRate, format: "percent", growth: percentChange(conversionRate, 0), sparkline: [...revenueMap.values()].map((row) => row.orders) },
        { key: "followers", label: "Followers Count", value: followers, format: "number", growth: 0, sparkline: [followers, followers, followers] },
        { key: "balance", label: "Withdrawable Balance", value: roundMoney(wallet.availableBalance || 0), format: "currency", growth: 0, sparkline: [wallet.availableBalance || 0] },
      ],
      metrics: {
        grossRevenue,
        commissionRevenue: totalEarnings,
        bonusRevenue: 0,
        campaignRevenue: totalEarnings,
        averageOrderValue,
        engagementRate,
        totalViews,
      },
      revenueOverview: [...revenueMap.values()],
      earningsBreakdown,
      topProducts,
      topVideos,
      activeCampaigns: activeCampaigns.filter((campaign) => ["active", "accepted", "completed", "proposed"].includes(campaign.status)),
      campaignInvitations: activeCampaigns.filter((campaign) => campaign.status === "proposed"),
      followersGrowth: [...revenueMap.values()].map((row, index, rows) => ({
        date: row.date,
        followers,
        newFollowers: index === rows.length - 1 ? 0 : 0,
        lostFollowers: 0,
        growthRate: 0,
      })),
      recentOrders: {
        rows: recentOrders,
        page,
        limit,
        total: filteredRecords.length,
        totalPages: Math.ceil(filteredRecords.length / limit) || 1,
      },
      earningsSummary: {
        pending: pendingEarnings,
        approved: roundMoney(wallet.totalEarnings || 0),
        withdrawable: roundMoney(wallet.availableBalance || 0),
        lifetime: roundMoney(wallet.totalEarnings || 0),
        withdrawn: roundMoney(wallet.withdrawnBalance || 0),
      },
      quickActions: [
        { key: "affiliate", label: "Create Affiliate Link", href: "/influencer/affiliate-links", enabled: Boolean(profile.permissions?.affiliateLinks) },
        { key: "product", label: "Add Product", href: "/influencer/collections", enabled: Boolean(profile.permissions?.collections) },
        { key: "video", label: "Upload Video", href: "/influencer/reels/upload", enabled: true },
        { key: "collection", label: "Create Collection", href: "/influencer/collections", enabled: Boolean(profile.permissions?.collections) },
        { key: "withdraw", label: "Request Withdrawal", href: "/influencer/earnings", enabled: Boolean(profile.permissions?.wallet) },
        { key: "analytics", label: "Analytics", href: "/influencer/analytics", enabled: Boolean(profile.permissions?.analytics) },
      ],
      notifications: {
        unreadCount: 0,
        items: [],
      },
    };
  }

  async getInfluencerEarnings(userId, query = {}) {
    const profile = await require("../influencer/service").getProfile(userId);
    const influencerId = profile._id;
    const wallet = await getOrCreateWallet(influencerId);
    const { start, end } = parseDashboardRange(query);

    const pendingAgg = await CommissionRecord.aggregate([
      { $match: { influencerId, state: "HOLD" } },
      { $group: { _id: null, total: { $sum: "$influencerShare" } } },
    ]);
    const pending = roundMoney(pendingAgg[0]?.total || 0);
    const settledAgg = await CommissionRecord.aggregate([
      { $match: { influencerId, state: "SETTLED" } },
      { $group: { _id: null, total: { $sum: "$influencerShare" }, gross: { $sum: "$gross" }, count: { $sum: 1 } } },
    ]);
    const bonusAgg = await InfluencerLedger.aggregate([
      { $match: { influencerId, source: { $in: ["BONUS", "REFERRAL", "ADJUSTMENT", "CAMPAIGN"] } } },
      { $group: { _id: "$source", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const ledgerFilter = { influencerId };
    if (query.type === "CREDIT" || query.type === "DEBIT") {
      ledgerFilter.type = query.type;
    }
    if (["COMMISSION", "REVERSAL", "WITHDRAWAL", "WITHDRAWAL_REVERSAL", "BONUS", "REFERRAL", "ADJUSTMENT", "CAMPAIGN"].includes(query.source)) {
      ledgerFilter.source = query.source;
    }
    if (query.from || query.to) {
      ledgerFilter.createdAt = {};
      if (query.from) ledgerFilter.createdAt.$gte = new Date(query.from);
      if (query.to) ledgerFilter.createdAt.$lte = new Date(query.to);
    }

    const [transactions, total, records, withdrawals, account] = await Promise.all([
      InfluencerLedger.find(ledgerFilter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      InfluencerLedger.countDocuments(ledgerFilter),
      CommissionRecord.find({ influencerId, createdAt: { $gte: start, $lte: end } })
        .populate({ path: "orderId", select: "orderNumber totalAmount status paymentStatus createdAt items", populate: { path: "items.productId", select: "name category brand images" } })
        .populate({ path: "campaignId", select: "title campaignType category vendorId", populate: { path: "vendorId", select: "shopName companyName" } })
        .sort({ createdAt: -1 })
        .limit(300)
        .lean(),
      InfluencerWithdrawalRequest.find({ influencerId }).populate("payoutAccountId").sort({ requestedAt: -1 }).limit(100).lean(),
      InfluencerPayoutAccount.findOne({ influencerId, isActive: true, isDefault: true }).sort({ createdAt: -1 }).lean(),
    ]);

    const dailyMap = new Map(buildDateBuckets(start, end).map((bucket) => [bucket.date, bucket]));
    const productBreakdown = new Map();
    const campaignBreakdown = new Map();
    for (const record of records) {
      const key = new Date(record.createdAt).toISOString().slice(0, 10);
      const bucket = dailyMap.get(key);
      if (bucket) {
        bucket.revenue = roundMoney(bucket.revenue + Number(record.gross || 0));
        bucket.commission = roundMoney(bucket.commission + Number(record.influencerShare || 0));
        bucket.orders += 1;
      }
      const campaignId = String(record.campaignId?._id || record.campaignId || "");
      if (campaignId) {
        const row = campaignBreakdown.get(campaignId) || {
          id: campaignId,
          campaign: record.campaignId?.title || `${record.campaignId?.vendorId?.shopName || record.campaignId?.vendorId?.companyName || "Brand"} campaign`,
          orders: 0,
          revenue: 0,
          commission: 0,
        };
        row.orders += 1;
        row.revenue = roundMoney(row.revenue + Number(record.gross || 0));
        row.commission = roundMoney(row.commission + Number(record.influencerShare || 0));
        campaignBreakdown.set(campaignId, row);
      }
      for (const item of record.orderId?.items || []) {
        const product = item.productId || {};
        const id = String(product._id || item.productId || "");
        if (!id) continue;
        const row = productBreakdown.get(id) || {
          id,
          productName: product.name || item.name || "Product",
          campaign: record.campaignId?.title || "",
          category: product.category || "",
          brand: product.brand || "",
          orders: 0,
          revenue: 0,
          commissionRate: Number(record.commissionPercent || 0),
          commissionEarned: 0,
        };
        row.orders += Number(item.quantity || 1);
        row.revenue = roundMoney(row.revenue + Number(item.price || 0) * Number(item.quantity || 1));
        row.commissionEarned = roundMoney(row.commissionEarned + Number(record.influencerShare || 0));
        productBreakdown.set(id, row);
      }
    }

    const withdrawalBuckets = withdrawals.reduce(
      (acc, request) => {
        if (["PENDING", "UNDER_REVIEW"].includes(request.status)) acc.pending.push(request);
        if (["APPROVED", "PROCESSING", "PAID"].includes(request.status)) acc.approved.push(request);
        if (["REJECTED", "FAILED", "CANCELLED"].includes(request.status)) acc.rejected.push(request);
        if (["PAID", "PROCESSING", "APPROVED", "FAILED"].includes(request.status)) acc.history.push(request);
        return acc;
      },
      { pending: [], approved: [], rejected: [], history: [] }
    );

    const bonusEarnings = bonusAgg.map((row) => ({
      type: row._id,
      description: `${String(row._id || "").toLowerCase()} earnings`,
      amount: roundMoney(row.total || 0),
      count: row.count,
      status: "APPROVED",
    }));
    const bonusTotal = roundMoney(bonusEarnings.reduce((sum, row) => sum + Number(row.amount || 0), 0));
    const approved = roundMoney(settledAgg[0]?.total || wallet.totalEarnings || 0);
    const taxableIncome = roundMoney(approved + bonusTotal);
    const taxWithheld = roundMoney(taxableIncome * Number(process.env.INFLUENCER_TAX_WITHHOLDING_RATE || 0));

    return {
      available: roundMoney(wallet.availableBalance || 0),
      pendingBalance: roundMoney(wallet.pendingBalance || 0),
      pending,
      approved,
      totalEarnings: roundMoney(wallet.totalEarnings || approved),
      withdrawn: roundMoney(wallet.withdrawnBalance || 0),
      transactions,
      wallet: {
        availableBalance: roundMoney(wallet.availableBalance || 0),
        pendingBalance: roundMoney(wallet.pendingBalance || 0),
        reservedBalance: roundMoney(wallet.pendingBalance || 0),
        totalBalance: roundMoney(Number(wallet.availableBalance || 0) + Number(wallet.pendingBalance || 0)),
        totalEarnings: roundMoney(wallet.totalEarnings || 0),
        withdrawnBalance: roundMoney(wallet.withdrawnBalance || 0),
        status: wallet.status,
      },
      kpis: {
        totalEarnings: roundMoney(wallet.totalEarnings || approved),
        pendingEarnings: pending,
        approvedEarnings: approved,
        withdrawableBalance: roundMoney(wallet.availableBalance || 0),
        totalWithdrawn: roundMoney(wallet.withdrawnBalance || 0),
        bonusEarnings: bonusTotal,
      },
      earningsHistory: transactions,
      pendingEarnings: records.filter((record) => record.state === "HOLD").map((record) => ({
        id: record._id,
        referenceId: record.metadata?.orderNumber || String(record.orderId?._id || record.orderId || "").slice(-8),
        source: "Commission",
        orderId: record.orderId?.orderNumber || "",
        campaign: record.campaignId?.title || "",
        amount: Number(record.influencerShare || 0),
        expectedApprovalDate: record.holdUntil,
        status: "Pending",
      })),
      approvedEarnings: records.filter((record) => record.state === "SETTLED").map((record) => ({
        id: record._id,
        date: record.settledAt || record.createdAt,
        source: "Commission",
        order: record.orderId?.orderNumber || "",
        campaign: record.campaignId?.title || "",
        amount: Number(record.gross || 0),
        commission: Number(record.influencerShare || 0),
        status: record.state,
      })),
      commissionBreakdown: {
        products: [...productBreakdown.values()].sort((a, b) => b.commissionEarned - a.commissionEarned),
        campaigns: [...campaignBreakdown.values()].sort((a, b) => b.commission - a.commission),
        averageCommission: records.length ? roundMoney(records.reduce((sum, record) => sum + Number(record.commissionPercent || 0), 0) / records.length) : 0,
      },
      bonusEarnings,
      taxSummary: {
        taxableIncome,
        totalEarnings: roundMoney(wallet.totalEarnings || approved),
        taxWithheld,
        netEarnings: roundMoney(taxableIncome - taxWithheld),
        deductions: 0,
        documents: [],
      },
      revenueTrend: [...dailyMap.values()],
      withdrawals: withdrawalBuckets,
      payoutAccount: maskInfluencerPayoutAccount(account),
      withdrawalRules: {
        minimumAmount: MIN_WITHDRAWAL_AMOUNT,
        maximumAmount: MAX_WITHDRAWAL_AMOUNT,
        processingTime: "2-5 business days",
      },
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async listInfluencerWithdrawals(userId, query = {}) {
    const profile = await require("../influencer/service").getProfile(userId);
    const influencerId = profile._id;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const filter = { influencerId };
    const statuses = normalizeWithdrawalStatus(query.tab || query.status);
    if (statuses.length) filter.status = { $in: statuses };
    const [requests, total] = await Promise.all([
      InfluencerWithdrawalRequest.find(filter).populate("payoutAccountId").sort({ requestedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      InfluencerWithdrawalRequest.countDocuments(filter),
    ]);
    return {
      requests: requests.map((request) => ({ ...request, payoutAccountId: maskInfluencerPayoutAccount(request.payoutAccountId) })),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async requestWithdrawal(userId, payload = {}, actor = {}, meta = {}) {
    const profile = await require("../influencer/service").getProfile(userId);
    const influencerId = profile._id;
    const amount = roundMoney(payload.amount || 0);
    if (amount < MIN_WITHDRAWAL_AMOUNT) {
      throw new AppError(`Minimum withdrawal amount is ${MIN_WITHDRAWAL_AMOUNT}`, 400, "WITHDRAWAL_MINIMUM_NOT_MET");
    }
    if (amount > MAX_WITHDRAWAL_AMOUNT) {
      throw new AppError(`Maximum withdrawal amount is ${MAX_WITHDRAWAL_AMOUNT}`, 400, "WITHDRAWAL_MAXIMUM_EXCEEDED");
    }

    return await executeWithOptionalTransaction(async (session) => {
      const wallet = await getOrCreateWallet(influencerId, session);
      if (roundMoney(wallet.availableBalance || 0) < amount) {
        throw new AppError("Insufficient withdrawable balance", 400, "INSUFFICIENT_BALANCE");
      }
      const pending = await attachSession(
        InfluencerWithdrawalRequest.findOne({ influencerId, status: { $in: ["PENDING", "UNDER_REVIEW", "APPROVED", "PROCESSING"] } }),
        session
      ).lean();
      if (pending) throw new AppError("A withdrawal request is already pending", 409, "WITHDRAWAL_ALREADY_PENDING");

      const account = payload.payoutAccountId
        ? await attachSession(InfluencerPayoutAccount.findOne({ _id: payload.payoutAccountId, influencerId, isActive: true }), session)
        : await attachSession(InfluencerPayoutAccount.findOne({ influencerId, isActive: true, isDefault: true }).sort({ createdAt: -1 }), session);
      if (!account) throw new AppError("Add a bank account or payout method before requesting withdrawal", 400, "PAYOUT_ACCOUNT_REQUIRED");

      const updatedWallet = await InfluencerWallet.findByIdAndUpdate(
        wallet._id,
        {
          $set: {
            availableBalance: roundMoney(wallet.availableBalance || 0) - amount,
            pendingBalance: roundMoney(wallet.pendingBalance || 0) + amount,
          },
        },
        { new: true, session: session || undefined, runValidators: true }
      );

      const [request] = await InfluencerWithdrawalRequest.create(
        [
          {
            influencerId,
            payoutAccountId: account._id,
            amount,
            paymentMethod: payload.paymentMethod || account.paymentMethod || "bank_transfer",
            status: "PENDING",
            remarks: payload.remarks || "",
            expectedProcessingAt: addDays(new Date(), 3),
          },
        ],
        { session: session || undefined }
      );

      const [ledgerEntry] = await InfluencerLedger.create(
        [
          {
            influencerId,
            type: "DEBIT",
            amount,
            source: "WITHDRAWAL",
            idempotencyKey: buildWithdrawalLedgerKey(request._id),
            balanceAfter: updatedWallet.availableBalance,
            meta: {
              withdrawalRequestId: request._id,
              payoutAccountId: account._id,
              status: request.status,
            },
          },
        ],
        { session: session || undefined }
      );

      await auditService.log({
        actor: actor || { _id: userId, role: "influencer" },
        action: "influencer.withdrawal.requested",
        entityType: "InfluencerWithdrawalRequest",
        entityId: request._id,
        metadata: { influencerId: String(influencerId), amount, ledgerEntryId: String(ledgerEntry._id) },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      }).catch(() => {});

      return { request, wallet: updatedWallet, ledgerEntry };
    });
  }

  async cancelWithdrawal(userId, requestId, meta = {}) {
    const profile = await require("../influencer/service").getProfile(userId);
    const influencerId = profile._id;
    return await executeWithOptionalTransaction(async (session) => {
      const request = await attachSession(InfluencerWithdrawalRequest.findOne({ _id: requestId, influencerId }), session);
      if (!request) throw new AppError("Withdrawal request not found", 404, "NOT_FOUND");
      if (!["PENDING", "UNDER_REVIEW"].includes(request.status)) {
        throw new AppError("Only pending withdrawal requests can be cancelled", 400, "INVALID_WITHDRAWAL_STATUS");
      }
      const wallet = await getOrCreateWallet(influencerId, session);
      const updatedWallet = await InfluencerWallet.findByIdAndUpdate(
        wallet._id,
        {
          $set: {
            availableBalance: roundMoney(wallet.availableBalance || 0) + roundMoney(request.amount || 0),
            pendingBalance: Math.max(0, roundMoney(wallet.pendingBalance || 0) - roundMoney(request.amount || 0)),
          },
        },
        { new: true, session: session || undefined, runValidators: true }
      );
      request.status = "CANCELLED";
      request.rejectedAt = new Date();
      request.rejectionReason = "Cancelled by influencer";
      await request.save({ session: session || undefined });

      await InfluencerLedger.create(
        [
          {
            influencerId,
            type: "CREDIT",
            amount: request.amount,
            source: "WITHDRAWAL_REVERSAL",
            idempotencyKey: buildWithdrawalLedgerKey(request._id, "cancel"),
            balanceAfter: updatedWallet.availableBalance,
            meta: { withdrawalRequestId: request._id, reason: "cancelled" },
          },
        ],
        { session: session || undefined }
      );
      return { request, wallet: updatedWallet };
    });
  }

  async getInfluencerPayoutAccounts(userId) {
    const profile = await require("../influencer/service").getProfile(userId);
    const accounts = await InfluencerPayoutAccount.find({ influencerId: profile._id, isActive: true }).sort({ isDefault: -1, createdAt: -1 });
    return { accounts: accounts.map(maskInfluencerPayoutAccount) };
  }

  async upsertInfluencerPayoutAccount(userId, payload = {}, meta = {}) {
    const profile = await require("../influencer/service").getProfile(userId);
    const influencerId = profile._id;
    const encService = getEncryptionService();
    const normalized = {
      accountHolderName: String(payload.accountHolderName || "").trim(),
      accountNumber: String(payload.accountNumber || "").trim(),
      ifscCode: String(payload.ifscCode || "").trim().toUpperCase(),
      bankName: String(payload.bankName || "").trim(),
      upiId: String(payload.upiId || "").trim().toLowerCase(),
      paypalEmail: String(payload.paypalEmail || "").trim().toLowerCase(),
      paymentMethod: payload.paymentMethod || "bank_transfer",
    };
    const hasBank = normalized.accountHolderName && normalized.accountNumber && normalized.ifscCode;
    const hasUpi = Boolean(normalized.upiId);
    const hasPaypal = Boolean(normalized.paypalEmail);
    if (!hasBank && !hasUpi && !hasPaypal) {
      throw new AppError("Provide bank, UPI, or PayPal payout details", 400, "PAYOUT_ACCOUNT_REQUIRED");
    }

    const existing = await InfluencerPayoutAccount.findOne({ influencerId, isActive: true, isDefault: true }).sort({ createdAt: -1 });
    if (existing) {
      await InfluencerPayoutAccount.updateMany({ influencerId, isActive: true, isDefault: true }, { $set: { isDefault: false, isActive: false } });
    }
    const account = await InfluencerPayoutAccount.create({
      influencerId,
      accountHolderName: normalized.accountHolderName,
      accountNumberEncrypted: normalized.accountNumber ? encService.encrypt(normalized.accountNumber) : "",
      ifscCode: normalized.ifscCode,
      bankName: normalized.bankName,
      upiIdEncrypted: normalized.upiId ? encService.encrypt(normalized.upiId) : "",
      paypalEmail: normalized.paypalEmail,
      paymentMethod: normalized.paymentMethod,
      isDefault: true,
      isActive: true,
      isVerified: false,
      verificationStatus: "PENDING",
      version: existing ? Number(existing.version || 1) + 1 : 1,
      previousVersions: existing ? [existing.toObject ? existing.toObject() : existing] : [],
      updateReason: payload.updateReason || "Influencer updated payout account",
    });

    await auditService.log({
      actor: { _id: userId, role: "influencer" },
      action: existing ? "influencer.payout_account.updated" : "influencer.payout_account.created",
      entityType: "InfluencerPayoutAccount",
      entityId: account._id,
      metadata: { influencerId: String(influencerId), paymentMethod: account.paymentMethod },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    }).catch(() => {});

    return maskInfluencerPayoutAccount(account);
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
