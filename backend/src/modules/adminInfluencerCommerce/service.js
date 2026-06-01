const mongoose = require("mongoose");
const auditService = require("../../services/audit.service");
const notificationService = require("../../services/notification.service");
const { isInfluencerCommerceEnabled, invalidateInfluencerCommerceConfigCache } = require("../../services/influencer-commerce-config.service");
const { AppError } = require("../../utils/AppError");
const { Campaign } = require("../campaign/model");
const {
  InfluencerProfile,
  InfluencerApplication,
  InfluencerSocialAccount,
  InfluencerBusinessProfile,
  InfluencerPaymentProfile,
  InfluencerProductAssignment,
} = require("../influencer/model");
const {
  CommissionRecord,
  InfluencerWallet,
  InfluencerLedger,
  InfluencerWithdrawalRequest,
  InfluencerPayoutAccount,
} = require("../commission/models");
const { Reel } = require("../reel/model");
const { TrackingSession } = require("../tracking/model");

async function upsertProductAssignments({ campaign, influencerId, status = "approved", source = "admin_manual", actorId = null }) {
  const now = new Date();
  await Promise.all((campaign.productIds || []).map((productId) => InfluencerProductAssignment.findOneAndUpdate(
    { influencerId, productId, campaignId: campaign._id },
    {
      $set: {
        influencerId,
        vendorId: campaign.vendorId,
        productId,
        campaignId: campaign._id,
        status,
        source,
        approvedAt: status === "approved" ? now : undefined,
        "metadata.lastActorId": actorId || undefined,
      },
      $setOnInsert: { assignedAt: now },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )));
}
const { Vendor } = require("../../models/Vendor");
const { Product } = require("../../models/Product");
const { Order } = require("../../models/Order");
const { AuditLog } = require("../../models/AuditLog");
const PlatformConfig = require("../../models/PlatformConfig");
const { VendorInfluencerRelationship } = require("../influencerCommerce/model");
const { InfluencerCommerceFraudAlert, InfluencerCommerceReportSchedule } = require("./model");

function oid(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pageOptions(query = {}, fallback = 20) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || fallback));
  return { page, limit, skip: (page - 1) * limit };
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

function parseRange(query = {}) {
  const now = new Date();
  let end = query.endDate ? new Date(query.endDate) : now;
  if (Number.isNaN(end.getTime())) end = now;
  let start = query.startDate ? new Date(query.startDate) : addDays(now, -29);
  if (Number.isNaN(start.getTime())) start = addDays(now, -29);
  return { start: startOfDay(start), end };
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function buckets(start, end) {
  const rows = [];
  const cursor = startOfDay(start);
  const last = startOfDay(end);
  while (cursor <= last) {
    rows.push({ date: cursor.toISOString().slice(0, 10), revenue: 0, commission: 0, campaigns: 0, influencers: 0, vendors: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return rows;
}

function influencerName(profile = {}) {
  return profile.displayName || profile.userId?.name || profile.userId?.email || "Influencer";
}

function vendorName(vendor = {}) {
  return vendor.shopName || vendor.companyName || vendor.userId?.name || "Vendor";
}

function productImage(product = {}) {
  return product.thumbnail || product.images?.find((image) => image?.isPrimary)?.url || product.images?.[0]?.url || "";
}

function normalizeSort(sort = "", fallback = { createdAt: -1 }) {
  const map = {
    revenue: { "analytics.revenue": -1, createdAt: -1 },
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    followers: { followers: -1 },
    commission: { influencerShare: -1 },
  };
  return map[sort] || fallback;
}

class AdminInfluencerCommerceService {
  dateMatch(query = {}) {
    const { start, end } = parseRange(query);
    return { createdAt: { $gte: start, $lte: end } };
  }

  campaignFilter(query = {}) {
    const filter = {};
    if (oid(query.vendorId)) filter.vendorId = oid(query.vendorId);
    if (oid(query.influencerId)) {
      filter.$or = [{ influencerId: oid(query.influencerId) }, { "applications.influencerId": oid(query.influencerId) }];
    }
    if (query.status || query.state) filter.state = query.status || query.state;
    if (query.campaignType) filter.campaignType = query.campaignType;
    if (query.category) filter.category = query.category;
    if (query.search) {
      const re = new RegExp(escapeRegex(query.search), "i");
      filter.$and = [{ $or: [{ title: re }, { description: re }, { category: re }] }];
    }
    return filter;
  }

  commissionFilter(query = {}) {
    const filter = { ...this.dateMatch(query) };
    if (oid(query.vendorId)) filter.vendorId = oid(query.vendorId);
    if (oid(query.influencerId)) filter.influencerId = oid(query.influencerId);
    if (oid(query.campaignId)) filter.campaignId = oid(query.campaignId);
    if (query.status || query.state) filter.state = String(query.status || query.state).toUpperCase();
    return filter;
  }

  async dashboard(query = {}) {
    const { start, end } = parseRange(query);
    const commissionMatch = this.commissionFilter(query);
    const campaignMatch = this.campaignFilter(query);

    const [
      totalInfluencers,
      activeInfluencers,
      totalVendors,
      activeCampaigns,
      commissionAgg,
      pendingWithdrawals,
      pendingWithdrawalAmount,
      contentPendingApproval,
      fraudAlerts,
      recentCampaigns,
      topInfluencers,
      topVendors,
      pendingVerifications,
      revenueTrendRows,
      campaignTrendRows,
      influencerGrowthRows,
      vendorGrowthRows,
    ] = await Promise.all([
      InfluencerProfile.countDocuments({}),
      InfluencerProfile.countDocuments({ state: "active" }),
      Vendor.countDocuments({}),
      Campaign.countDocuments({ ...campaignMatch, state: "active" }),
      CommissionRecord.aggregate([
        { $match: commissionMatch },
        { $group: { _id: null, revenue: { $sum: "$gross" }, commission: { $sum: "$influencerShare" }, paid: { $sum: { $cond: [{ $eq: ["$state", "SETTLED"] }, "$influencerShare", 0] } }, pending: { $sum: { $cond: [{ $eq: ["$state", "HOLD"] }, "$influencerShare", 0] } }, orders: { $sum: 1 } } },
      ]),
      InfluencerWithdrawalRequest.countDocuments({ status: { $in: ["PENDING", "UNDER_REVIEW"] } }),
      InfluencerWithdrawalRequest.aggregate([{ $match: { status: { $in: ["PENDING", "UNDER_REVIEW"] } } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]),
      Reel.countDocuments({ state: { $in: ["uploaded", "pending_review"] } }),
      InfluencerCommerceFraudAlert.countDocuments({ status: { $in: ["OPEN", "UNDER_REVIEW", "ESCALATED"] } }),
      Campaign.find(campaignMatch).populate("vendorId", "shopName companyName").populate({ path: "influencerId", populate: { path: "userId", select: "name email" } }).sort({ createdAt: -1 }).limit(8).lean(),
      CommissionRecord.aggregate([{ $match: commissionMatch }, { $group: { _id: "$influencerId", revenue: { $sum: "$gross" }, commission: { $sum: "$influencerShare" }, orders: { $sum: 1 } } }, { $sort: { revenue: -1 } }, { $limit: 8 }]),
      CommissionRecord.aggregate([{ $match: commissionMatch }, { $group: { _id: "$vendorId", revenue: { $sum: "$gross" }, commission: { $sum: "$influencerShare" }, orders: { $sum: 1 } } }, { $sort: { revenue: -1 } }, { $limit: 8 }]),
      InfluencerApplication.find({ status: { $in: ["submitted", "under_review", "pending_documents", "verification_in_progress", "requires_changes"] } }).sort({ updatedAt: -1 }).limit(8).lean(),
      CommissionRecord.aggregate([{ $match: commissionMatch }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, revenue: { $sum: "$gross" }, commission: { $sum: "$influencerShare" } } }]),
      Campaign.aggregate([{ $match: { createdAt: { $gte: start, $lte: end } } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, campaigns: { $sum: 1 } } }]),
      InfluencerProfile.aggregate([{ $match: { createdAt: { $gte: start, $lte: end } } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, influencers: { $sum: 1 } } }]),
      Vendor.aggregate([{ $match: { createdAt: { $gte: start, $lte: end } } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, vendors: { $sum: 1 } } }]),
    ]);

    const trendMap = new Map(buckets(start, end).map((row) => [row.date, row]));
    revenueTrendRows.forEach((row) => Object.assign(trendMap.get(row._id) || {}, { revenue: money(row.revenue), commission: money(row.commission) }));
    campaignTrendRows.forEach((row) => Object.assign(trendMap.get(row._id) || {}, { campaigns: row.campaigns }));
    influencerGrowthRows.forEach((row) => Object.assign(trendMap.get(row._id) || {}, { influencers: row.influencers }));
    vendorGrowthRows.forEach((row) => Object.assign(trendMap.get(row._id) || {}, { vendors: row.vendors }));

    const influencerIds = topInfluencers.map((row) => row._id).filter(Boolean);
    const vendorIds = topVendors.map((row) => row._id).filter(Boolean);
    const [influencers, vendors] = await Promise.all([
      InfluencerProfile.find({ _id: { $in: influencerIds } }).populate("userId", "name email").lean(),
      Vendor.find({ _id: { $in: vendorIds } }).lean(),
    ]);
    const influencerMap = new Map(influencers.map((row) => [String(row._id), row]));
    const vendorMap = new Map(vendors.map((row) => [String(row._id), row]));
    const summary = commissionAgg[0] || {};

    return {
      kpis: {
        totalInfluencers,
        activeInfluencers,
        totalVendors,
        activeCampaigns,
        campaignRevenue: money(summary.revenue),
        commissionPaid: money(summary.paid),
        escrowBalance: money(summary.pending),
        pendingWithdrawals,
        pendingWithdrawalAmount: money(pendingWithdrawalAmount[0]?.amount || 0),
        contentPendingApproval,
        fraudAlerts,
      },
      charts: {
        revenueTrend: [...trendMap.values()],
        campaignTrend: [...trendMap.values()].map(({ date, campaigns }) => ({ date, campaigns })),
        influencerGrowth: [...trendMap.values()].map(({ date, influencers }) => ({ date, influencers })),
        vendorGrowth: [...trendMap.values()].map(({ date, vendors }) => ({ date, vendors })),
        commissionTrend: [...trendMap.values()].map(({ date, commission }) => ({ date, commission })),
      },
      widgets: {
        recentCampaigns,
        topInfluencers: topInfluencers.map((row) => ({ ...row, influencer: influencerMap.get(String(row._id)), name: influencerName(influencerMap.get(String(row._id))) })),
        topVendors: topVendors.map((row) => ({ ...row, vendor: vendorMap.get(String(row._id)), name: vendorName(vendorMap.get(String(row._id))) })),
        pendingVerifications,
        pendingWithdrawals: await InfluencerWithdrawalRequest.find({ status: { $in: ["PENDING", "UNDER_REVIEW"] } }).populate("influencerId", "displayName userId").sort({ requestedAt: -1 }).limit(8).lean(),
        pendingContentReviews: await Reel.find({ state: { $in: ["uploaded", "pending_review"] } }).populate({ path: "influencerId", populate: { path: "userId", select: "name email" } }).populate("campaignId", "title vendorId").sort({ createdAt: -1 }).limit(8).lean(),
        recentFraudAlerts: await InfluencerCommerceFraudAlert.find({}).sort({ createdAt: -1 }).limit(8).lean(),
      },
    };
  }

  async influencers(query = {}) {
    const { page, limit, skip } = pageOptions(query);
    const filter = {};
    if (query.status) filter.state = query.status;
    if (query.category) filter.$or = [{ categories: query.category }, { primaryCategory: query.category }, { secondaryCategories: query.category }];
    if (query.country) filter["location.country"] = query.country;
    if (query.search) {
      const re = new RegExp(escapeRegex(query.search), "i");
      filter.$and = [{ $or: [{ displayName: re }, { influencerCode: re }, { primaryCategory: re }] }];
    }
    const [items, total, commissionRows, socialAccounts] = await Promise.all([
      InfluencerProfile.find(filter).populate("userId", "name email username status").sort(normalizeSort(query.sort, { createdAt: -1 })).skip(skip).limit(limit).lean(),
      InfluencerProfile.countDocuments(filter),
      CommissionRecord.aggregate([{ $group: { _id: "$influencerId", revenue: { $sum: "$gross" }, commission: { $sum: "$influencerShare" }, orders: { $sum: 1 } } }]),
      InfluencerSocialAccount.find({}).lean(),
    ]);
    const commissionMap = new Map(commissionRows.map((row) => [String(row._id), row]));
    const socialMap = socialAccounts.reduce((map, account) => {
      const key = String(account.influencerId || "");
      const list = map.get(key) || [];
      list.push(account);
      map.set(key, list);
      return map;
    }, new Map());
    return {
      items: items.map((profile) => {
        const stats = commissionMap.get(String(profile._id)) || {};
        const socials = socialMap.get(String(profile._id)) || [];
        const engagementRate = socials.length ? money(socials.reduce((sum, item) => sum + Number(item.engagementRate || 0), 0) / socials.length) : 0;
        const clicks = Number(profile.stats?.clicks || 0);
        return {
          ...profile,
          name: influencerName(profile),
          username: profile.userId?.username || profile.influencerCode,
          engagementRate,
          conversionRate: clicks ? money((Number(profile.stats?.sales || 0) / clicks) * 100) : 0,
          revenueGenerated: money(stats.revenue),
          commissionEarned: money(stats.commission),
          kycStatus: profile.verified ? "verified" : profile.state,
          accountStatus: profile.userId?.status || profile.state,
        };
      }),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async vendors(query = {}) {
    const { page, limit, skip } = pageOptions(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.search) {
      const re = new RegExp(escapeRegex(query.search), "i");
      filter.$or = [{ shopName: re }, { companyName: re }, { vendorCode: re }];
    }
    const [items, total, campaignAgg, commissionAgg, relationshipAgg] = await Promise.all([
      Vendor.find(filter).populate("userId", "name email status").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Vendor.countDocuments(filter),
      Campaign.aggregate([{ $group: { _id: "$vendorId", activeCampaigns: { $sum: { $cond: [{ $eq: ["$state", "active"] }, 1, 0] } }, totalCampaigns: { $sum: 1 } } }]),
      CommissionRecord.aggregate([{ $group: { _id: "$vendorId", revenue: { $sum: "$gross" }, commission: { $sum: "$influencerShare" }, pending: { $sum: { $cond: [{ $eq: ["$state", "HOLD"] }, "$influencerShare", 0] } } } }]),
      VendorInfluencerRelationship.aggregate([{ $group: { _id: "$vendorId", influencersConnected: { $sum: 1 } } }]),
    ]);
    const campaignMap = new Map(campaignAgg.map((row) => [String(row._id), row]));
    const commissionMap = new Map(commissionAgg.map((row) => [String(row._id), row]));
    const relationshipMap = new Map(relationshipAgg.map((row) => [String(row._id), row]));
    return {
      items: items.map((vendor) => {
        const c = campaignMap.get(String(vendor._id)) || {};
        const m = commissionMap.get(String(vendor._id)) || {};
        const r = relationshipMap.get(String(vendor._id)) || {};
        return {
          ...vendor,
          name: vendorName(vendor),
          activeCampaigns: c.activeCampaigns || 0,
          influencersConnected: r.influencersConnected || 0,
          campaignRevenue: money(m.revenue),
          commissionLiability: money(m.pending),
          escrowUsage: money(m.pending),
          pendingSettlements: money(m.pending),
          fraudFlags: 0,
        };
      }),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async campaigns(query = {}) {
    const { page, limit, skip } = pageOptions(query);
    const filter = this.campaignFilter(query);
    const [items, total] = await Promise.all([
      Campaign.find(filter).populate("vendorId", "shopName companyName").populate({ path: "influencerId", populate: { path: "userId", select: "name email" } }).populate("productIds", "name category images thumbnail").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Campaign.countDocuments(filter),
    ]);
    return {
      items: items.map((campaign) => ({
        ...campaign,
        vendorName: vendorName(campaign.vendorId),
        influencerName: campaign.influencerId ? influencerName(campaign.influencerId) : "",
        budget: Number(campaign.fixedFee || 0),
        revenue: Number(campaign.analytics?.revenue || 0),
        applicationsCount: campaign.applications?.length || 0,
        approvedCreators: (campaign.applications || []).filter((app) => app.status === "approved").length + (campaign.influencerId ? 1 : 0),
      })),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async applications(query = {}) {
    const campaignFilter = this.campaignFilter(query);
    const campaigns = await Campaign.find(campaignFilter).populate("vendorId", "shopName companyName").lean();
    const rows = campaigns.flatMap((campaign) => (campaign.applications || []).map((application) => ({
      id: `${campaign._id}:${application.influencerId}`,
      campaignId: campaign._id,
      campaignTitle: campaign.title,
      vendorId: campaign.vendorId?._id || campaign.vendorId,
      vendorName: vendorName(campaign.vendorId),
      ...application,
    })));
    const influencerIds = rows.map((row) => row.influencerId).filter(Boolean);
    const influencers = influencerIds.length ? await InfluencerProfile.find({ _id: { $in: influencerIds } }).populate("userId", "name email").lean() : [];
    const map = new Map(influencers.map((row) => [String(row._id), row]));
    return {
      items: rows.map((row) => ({ ...row, influencer: map.get(String(row.influencerId)), influencerName: influencerName(map.get(String(row.influencerId))) })),
      pagination: { total: rows.length, page: 1, limit: rows.length || 1, pages: 1 },
    };
  }

  async reviewCampaignApplication(actor, campaignId, influencerId, payload = {}) {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new AppError("Campaign not found", 404, "NOT_FOUND");
    const application = campaign.applications.find((item) => String(item.influencerId) === String(influencerId));
    if (!application) throw new AppError("Application not found", 404, "NOT_FOUND");
    if (payload.decision === "reopen") application.status = "submitted";
    else application.status = payload.decision === "approve" ? "approved" : "rejected";
    application.reviewedAt = new Date();
    campaign.history.push({ state: application.status, actorId: actor.sub || actor._id, note: payload.note || `Admin ${application.status} application`, changedAt: new Date() });
    await campaign.save();
    if (application.status === "approved") {
      await upsertProductAssignments({ campaign, influencerId, status: "approved", source: "admin_manual", actorId: actor.sub || actor._id });
    }
    await auditService.log({ actor, action: `admin.influencer_commerce.application.${application.status}`, entityType: "Campaign", entityId: campaign._id, metadata: { influencerId, note: payload.note || "" } }).catch(() => {});
    await notificationService.notifyVendorUser(campaign.vendorId, {
      module: "GROWTH",
      subModule: "INFLUENCER_COMMERCE",
      type: "CAMPAIGN_APPLICATION",
      title: "Campaign application updated",
      message: `Admin marked an application as ${application.status}.`,
      referenceId: campaign._id,
    }).catch(() => {});
    return campaign;
  }

  async updateCampaign(actor, campaignId, payload = {}) {
    const allowed = {};
    ["title", "description", "campaignType", "category", "country", "language", "commissionPercent", "fixedFee", "deadline"].forEach((key) => {
      if (payload[key] !== undefined) allowed[key] = payload[key];
    });
    if (payload.state) allowed.state = payload.state;
    const campaign = await Campaign.findByIdAndUpdate(
      campaignId,
      { $set: allowed, $push: { history: { state: allowed.state || "updated", actorId: actor.sub || actor._id, note: payload.note || "Admin updated campaign", changedAt: new Date() } } },
      { new: true, runValidators: true }
    );
    if (!campaign) throw new AppError("Campaign not found", 404, "NOT_FOUND");
    await auditService.log({ actor, action: "admin.influencer_commerce.campaign.update", entityType: "Campaign", entityId: campaign._id, metadata: allowed }).catch(() => {});
    return campaign;
  }

  async matching(query = {}) {
    const [vendors, influencers, campaigns, products] = await Promise.all([
      Vendor.find({ status: "approved" }).limit(25).lean(),
      InfluencerProfile.find({ state: { $in: ["verified", "active"] } }).populate("userId", "name email").sort({ followers: -1, rating: -1 }).limit(50).lean(),
      Campaign.find({ state: { $nin: ["completed", "cancelled"] } }).populate("vendorId", "shopName companyName").sort({ "analytics.revenue": -1, createdAt: -1 }).limit(25).lean(),
      Product.find({ status: "APPROVED", isActive: true }).populate("sellerId", "shopName companyName").sort({ "analytics.salesCount": -1 }).limit(25).lean(),
    ]);
    const matches = vendors.slice(0, 12).flatMap((vendor) => influencers.slice(0, 5).map((influencer) => {
      const categoryMatch = (influencer.categories || []).some((category) => (vendor.storeCategories || []).includes(category));
      const score = Math.min(99, Math.round(52 + Number(influencer.rating || 0) * 8 + (categoryMatch ? 18 : 0) + Math.log10(Number(influencer.followers || 0) + 1) * 4));
      return { vendor, influencer, score, reasons: [categoryMatch ? "Category fit" : "Audience scale", "Verified creator profile", "Revenue potential"] };
    })).sort((a, b) => b.score - a.score);
    return { recommendedInfluencersForVendor: matches, recommendedCampaigns: campaigns, recommendedProducts: products };
  }

  async affiliateProducts(query = {}) {
    const { page, limit, skip } = pageOptions(query);
    const filter = { isActive: true };
    if (query.search) filter.name = new RegExp(escapeRegex(query.search), "i");
    if (query.category) filter.category = query.category;
    if (oid(query.vendorId)) filter.sellerId = oid(query.vendorId);
    const [items, total, commissionRows] = await Promise.all([
      Product.find(filter).populate("sellerId", "shopName companyName").sort({ "analytics.salesCount": -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
      CommissionRecord.aggregate([{ $group: { _id: "$metadata.productId", revenue: { $sum: "$gross" }, commission: { $sum: "$influencerShare" }, orders: { $sum: 1 }, influencers: { $addToSet: "$influencerId" } } }]),
    ]);
    const map = new Map(commissionRows.map((row) => [String(row._id), row]));
    return {
      items: items.map((product) => {
        const stats = map.get(String(product._id)) || {};
        const clicks = Number(product.analytics?.views || 0);
        const orders = Number(stats.orders || product.analytics?.salesCount || 0);
        return {
          id: product._id,
          product,
          name: product.name,
          vendor: vendorName(product.sellerId),
          image: productImage(product),
          influencersPromoting: stats.influencers?.length || 0,
          clicks,
          orders,
          revenue: money(stats.revenue || product.analytics?.totalRevenue),
          commission: money(stats.commission),
          conversionRate: clicks ? money((orders / clicks) * 100) : 0,
          status: product.status,
        };
      }),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async tracking(query = {}) {
    const { page, limit, skip } = pageOptions(query);
    const filter = {};
    if (oid(query.influencerId)) filter.influencerId = oid(query.influencerId);
    if (oid(query.campaignId)) filter.campaignId = oid(query.campaignId);
    if (oid(query.productId)) filter.productId = oid(query.productId);
    const [items, total] = await Promise.all([
      TrackingSession.find(filter)
        .populate({ path: "influencerId", populate: { path: "userId", select: "name email" } })
        .populate({ path: "campaignId", populate: { path: "vendorId", select: "shopName companyName" } })
        .populate("productId", "name category")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TrackingSession.countDocuments(filter),
    ]);
    const ids = items.map((row) => row._id);
    const orderRows = ids.length ? await Order.find({ "attribution.trackingSessionId": { $in: ids } }).select("orderNumber totalAmount status attribution createdAt").lean() : [];
    const orderMap = new Map(orderRows.map((order) => [String(order.attribution?.trackingSessionId), order]));
    return {
      items: items.map((row) => ({ ...row, influencerName: influencerName(row.influencerId), vendorName: vendorName(row.campaignId?.vendorId), productName: row.productId?.name, order: orderMap.get(String(row._id)), conversionStatus: orderMap.has(String(row._id)) ? "converted" : "pending", fraudRisk: row.userId && row.userId === row.influencerId?.userId ? "high" : "low" })),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async content(query = {}) {
    const { page, limit, skip } = pageOptions(query);
    const filter = {};
    if (query.status) filter.state = query.status;
    if (query.contentType) filter.contentType = query.contentType;
    if (oid(query.campaignId)) filter.campaignId = oid(query.campaignId);
    if (oid(query.influencerId)) filter.influencerId = oid(query.influencerId);
    const [items, total] = await Promise.all([
      Reel.find(filter).populate({ path: "influencerId", populate: { path: "userId", select: "name email" } }).populate({ path: "campaignId", populate: { path: "vendorId", select: "shopName companyName" } }).populate("productIds", "name").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Reel.countDocuments(filter),
    ]);
    return {
      items: items.map((row) => ({ ...row, creatorName: influencerName(row.influencerId), vendorName: vendorName(row.campaignId?.vendorId), campaignTitle: row.campaignId?.title, products: row.productIds || [] })),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async moderateContent(actor, reelId, payload = {}) {
    const nextState = payload.decision === "approve" ? "approved" : payload.decision === "publish" ? "published" : payload.decision === "changes" ? "pending_review" : "rejected";
    const update = {
      state: nextState,
      "moderation.reviewerId": actor.sub || actor._id,
      "moderation.reviewedAt": new Date(),
      "moderation.notes": payload.note || payload.requestedChanges || "",
    };
    if (nextState === "published") {
      update.visibility = "published";
      update.publishedAt = new Date();
    }
    const reel = await Reel.findByIdAndUpdate(
      reelId,
      { $set: update },
      { new: true }
    );
    if (!reel) throw new AppError("Content not found", 404, "NOT_FOUND");
    await auditService.log({ actor, action: `admin.influencer_commerce.content.${payload.decision}`, entityType: "Reel", entityId: reel._id, metadata: { note: payload.note || payload.requestedChanges || "" } }).catch(() => {});
    return reel;
  }

  async productPromotions(query = {}) {
    return this.affiliateProducts(query);
  }

  async commissions(query = {}) {
    const { page, limit, skip } = pageOptions(query);
    const filter = this.commissionFilter(query);
    const [items, total] = await Promise.all([
      CommissionRecord.find(filter).populate("vendorId", "shopName companyName").populate({ path: "influencerId", populate: { path: "userId", select: "name email" } }).populate("campaignId", "title campaignType").populate("orderId", "orderNumber status paymentStatus totalAmount").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CommissionRecord.countDocuments(filter),
    ]);
    return { items, pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } };
  }

  async updateCommission(actor, commissionId, payload = {}) {
    const allowed = {};
    if (payload.state) allowed.state = payload.state;
    if (payload.note) allowed["metadata.adminNote"] = payload.note;
    const record = await CommissionRecord.findByIdAndUpdate(commissionId, { $set: allowed }, { new: true });
    if (!record) throw new AppError("Commission record not found", 404, "NOT_FOUND");
    await auditService.log({ actor, action: "admin.influencer_commerce.commission.update", entityType: "CommissionRecord", entityId: record._id, metadata: allowed }).catch(() => {});
    return record;
  }

  async settlements(query = {}) {
    const records = await this.commissions({ ...query, status: query.status || "HOLD" });
    return {
      ...records,
      items: records.items.map((row) => ({
        ...row,
        escrowAmount: row.influencerShare,
        commissionHold: row.influencerShare,
        settlementStatus: row.state,
        releasedDate: row.settledAt,
      })),
    };
  }

  async payouts(query = {}) {
    const { page, limit, skip } = pageOptions(query);
    const [wallets, total] = await Promise.all([
      InfluencerWallet.find({}).populate({ path: "influencerId", populate: { path: "userId", select: "name email" } }).sort({ totalEarnings: -1 }).skip(skip).limit(limit).lean(),
      InfluencerWallet.countDocuments({}),
    ]);
    const accountIds = wallets.map((wallet) => wallet.influencerId?._id || wallet.influencerId);
    const accounts = await InfluencerPayoutAccount.find({ influencerId: { $in: accountIds }, isActive: true }).lean();
    const accountMap = new Map(accounts.map((account) => [String(account.influencerId), account]));
    return {
      items: wallets.map((wallet) => ({ ...wallet, influencerName: influencerName(wallet.influencerId), payoutAccount: accountMap.get(String(wallet.influencerId?._id || wallet.influencerId)) })),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async withdrawals(query = {}) {
    const { page, limit, skip } = pageOptions(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (oid(query.influencerId)) filter.influencerId = oid(query.influencerId);
    const [items, total] = await Promise.all([
      InfluencerWithdrawalRequest.find(filter).populate({ path: "influencerId", populate: { path: "userId", select: "name email" } }).populate("payoutAccountId").sort({ requestedAt: -1 }).skip(skip).limit(limit).lean(),
      InfluencerWithdrawalRequest.countDocuments(filter),
    ]);
    return { items: items.map((row) => ({ ...row, influencerName: influencerName(row.influencerId) })), pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } };
  }

  async updateWithdrawal(actor, requestId, payload = {}) {
    const statusMap = { approve: "APPROVED", reject: "REJECTED", process: "PROCESSING", paid: "PAID", review: "UNDER_REVIEW" };
    const status = statusMap[payload.action] || payload.status;
    if (!status) throw new AppError("Withdrawal status is required", 400, "VALIDATION_ERROR");
    const request = await InfluencerWithdrawalRequest.findByIdAndUpdate(
      requestId,
      { $set: { status, adminNote: payload.note || "", ...(status === "APPROVED" ? { approvedAt: new Date() } : {}), ...(status === "REJECTED" ? { rejectedAt: new Date(), rejectionReason: payload.note || "" } : {}), ...(status === "PAID" ? { processedAt: new Date() } : {}) } },
      { new: true }
    );
    if (!request) throw new AppError("Withdrawal request not found", 404, "NOT_FOUND");
    await auditService.log({ actor, action: `admin.influencer_commerce.withdrawal.${status.toLowerCase()}`, entityType: "InfluencerWithdrawalRequest", entityId: request._id, metadata: { note: payload.note || "" } }).catch(() => {});
    return request;
  }

  async creatorPerformance(query = {}) {
    const rows = await CommissionRecord.aggregate([{ $match: this.commissionFilter(query) }, { $group: { _id: "$influencerId", revenue: { $sum: "$gross" }, commission: { $sum: "$influencerShare" }, orders: { $sum: 1 } } }, { $sort: { revenue: -1 } }]);
    const ids = rows.map((row) => row._id).filter(Boolean);
    const [profiles, reels, withdrawals] = await Promise.all([
      InfluencerProfile.find({ _id: { $in: ids } }).populate("userId", "name email").lean(),
      Reel.aggregate([{ $match: { influencerId: { $in: ids } } }, { $group: { _id: "$influencerId", clicks: { $sum: "$metrics.clicks" }, engagement: { $sum: { $add: ["$metrics.likes", "$metrics.comments", "$metrics.shares"] } } } }]),
      InfluencerWithdrawalRequest.aggregate([{ $match: { influencerId: { $in: ids } } }, { $group: { _id: "$influencerId", withdrawalVolume: { $sum: "$amount" } } }]),
    ]);
    const profileMap = new Map(profiles.map((row) => [String(row._id), row]));
    const reelMap = new Map(reels.map((row) => [String(row._id), row]));
    const withdrawalMap = new Map(withdrawals.map((row) => [String(row._id), row]));
    return { items: rows.map((row) => {
      const reel = reelMap.get(String(row._id)) || {};
      return {
        influencerId: row._id,
        name: influencerName(profileMap.get(String(row._id))),
        revenueGenerated: money(row.revenue),
        ordersGenerated: row.orders,
        clicks: reel.clicks || 0,
        conversions: row.orders,
        ctr: reel.clicks ? money((row.orders / reel.clicks) * 100) : 0,
        roi: row.commission ? money(((row.revenue - row.commission) / row.commission) * 100) : 0,
        engagement: reel.engagement || 0,
        averageOrderValue: row.orders ? money(row.revenue / row.orders) : 0,
        commissionEarned: money(row.commission),
        withdrawalVolume: money(withdrawalMap.get(String(row._id))?.withdrawalVolume || 0),
      };
    }) };
  }

  async vendorPerformance(query = {}) {
    const rows = await CommissionRecord.aggregate([{ $match: this.commissionFilter(query) }, { $group: { _id: "$vendorId", revenue: { $sum: "$gross" }, commission: { $sum: "$influencerShare" }, pending: { $sum: { $cond: [{ $eq: ["$state", "HOLD"] }, "$influencerShare", 0] } }, orders: { $sum: 1 } } }, { $sort: { revenue: -1 } }]);
    const ids = rows.map((row) => row._id).filter(Boolean);
    const [vendors, campaigns, relationships] = await Promise.all([
      Vendor.find({ _id: { $in: ids } }).lean(),
      Campaign.aggregate([{ $match: { vendorId: { $in: ids } } }, { $group: { _id: "$vendorId", activeCampaigns: { $sum: { $cond: [{ $eq: ["$state", "active"] }, 1, 0] } }, approvedCampaigns: { $sum: 1 }, campaignSpend: { $sum: "$fixedFee" } } }]),
      VendorInfluencerRelationship.aggregate([{ $match: { vendorId: { $in: ids } } }, { $group: { _id: "$vendorId", activeInfluencers: { $sum: 1 } } }]),
    ]);
    const vendorMap = new Map(vendors.map((row) => [String(row._id), row]));
    const campaignMap = new Map(campaigns.map((row) => [String(row._id), row]));
    const relMap = new Map(relationships.map((row) => [String(row._id), row]));
    return { items: rows.map((row) => {
      const campaign = campaignMap.get(String(row._id)) || {};
      return {
        vendorId: row._id,
        name: vendorName(vendorMap.get(String(row._id))),
        campaignRevenue: money(row.revenue),
        campaignSpend: money(campaign.campaignSpend || 0),
        commissionPaid: money(row.commission),
        commissionPending: money(row.pending),
        activeInfluencers: relMap.get(String(row._id))?.activeInfluencers || 0,
        approvedCampaigns: campaign.approvedCampaigns || 0,
        productPromotions: 0,
        roi: row.commission ? money(((row.revenue - row.commission) / row.commission) * 100) : 0,
        conversionRate: 0,
      };
    }) };
  }

  async campaignAnalytics(query = {}) {
    const dashboard = await this.dashboard(query);
    const campaigns = await this.campaigns({ ...query, limit: 100 });
    const applications = await this.applications(query);
    return {
      kpis: {
        campaignRevenue: dashboard.kpis.campaignRevenue,
        campaignSpend: campaigns.items.reduce((sum, row) => sum + Number(row.fixedFee || 0), 0),
        roi: dashboard.kpis.commissionPaid ? money(((dashboard.kpis.campaignRevenue - dashboard.kpis.commissionPaid) / dashboard.kpis.commissionPaid) * 100) : 0,
        commissionPaid: dashboard.kpis.commissionPaid,
        conversions: dashboard.charts.revenueTrend.reduce((sum, row) => sum + Number(row.orders || 0), 0),
        orders: dashboard.charts.revenueTrend.reduce((sum, row) => sum + Number(row.orders || 0), 0),
        clicks: await TrackingSession.countDocuments({}),
        applications: applications.items.length,
        approvalRate: applications.items.length ? money((applications.items.filter((row) => row.status === "approved").length / applications.items.length) * 100) : 0,
      },
      charts: dashboard.charts,
      campaignComparison: campaigns.items,
      applicationFunnel: [
        { label: "Submitted", value: applications.items.filter((row) => row.status === "submitted").length },
        { label: "Approved", value: applications.items.filter((row) => row.status === "approved").length },
        { label: "Rejected", value: applications.items.filter((row) => row.status === "rejected").length },
      ],
    };
  }

  async revenueAnalytics(query = {}) {
    const commissionMatch = this.commissionFilter(query);
    const [summary, byCampaign, byVendor, byInfluencer, byProduct, byCategory] = await Promise.all([
      CommissionRecord.aggregate([{ $match: commissionMatch }, { $group: { _id: null, gross: { $sum: "$gross" }, influencerRevenue: { $sum: "$influencerShare" }, vendorNet: { $sum: "$vendorNet" }, platformCommission: { $sum: "$platformFee" }, paid: { $sum: { $cond: [{ $eq: ["$state", "SETTLED"] }, "$influencerShare", 0] } }, pending: { $sum: { $cond: [{ $eq: ["$state", "HOLD"] }, "$influencerShare", 0] } }, reversed: { $sum: { $cond: [{ $eq: ["$state", "REVERSED"] }, "$influencerShare", 0] } } } }]),
      CommissionRecord.aggregate([{ $match: commissionMatch }, { $group: { _id: "$campaignId", revenue: { $sum: "$gross" } } }, { $sort: { revenue: -1 } }, { $limit: 20 }]),
      CommissionRecord.aggregate([{ $match: commissionMatch }, { $group: { _id: "$vendorId", revenue: { $sum: "$gross" } } }, { $sort: { revenue: -1 } }, { $limit: 20 }]),
      CommissionRecord.aggregate([{ $match: commissionMatch }, { $group: { _id: "$influencerId", revenue: { $sum: "$gross" } } }, { $sort: { revenue: -1 } }, { $limit: 20 }]),
      CommissionRecord.aggregate([{ $match: commissionMatch }, { $group: { _id: "$metadata.productId", revenue: { $sum: "$gross" } } }, { $sort: { revenue: -1 } }, { $limit: 20 }]),
      Order.aggregate([{ $match: { attribution: { $exists: true, $ne: null } } }, { $unwind: "$items" }, { $group: { _id: "$items.category", revenue: { $sum: "$items.total" } } }, { $sort: { revenue: -1 } }, { $limit: 20 }]),
    ]);
    return { metrics: summary[0] || {}, charts: { byCampaign, byVendor, byInfluencer, byProduct, byCategory } };
  }

  async fraud(query = {}) {
    await this.generateFraudSignals().catch(() => {});
    const { page, limit, skip } = pageOptions(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.severity) filter.severity = query.severity;
    const [items, total] = await Promise.all([
      InfluencerCommerceFraudAlert.find(filter).populate("vendorId", "shopName companyName").populate({ path: "influencerId", populate: { path: "userId", select: "name email" } }).populate("campaignId", "title").populate("orderId", "orderNumber").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      InfluencerCommerceFraudAlert.countDocuments(filter),
    ]);
    return { items, pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } };
  }

  async generateFraudSignals() {
    const duplicateWithdrawals = await InfluencerWithdrawalRequest.aggregate([
      { $match: { status: { $in: ["PENDING", "UNDER_REVIEW"] } } },
      { $group: { _id: "$influencerId", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
      { $match: { count: { $gt: 1 } } },
    ]);
    for (const row of duplicateWithdrawals) {
      await InfluencerCommerceFraudAlert.findOneAndUpdate(
        { alertType: "DUPLICATE_WITHDRAWAL", influencerId: row._id, status: { $in: ["OPEN", "UNDER_REVIEW", "ESCALATED"] } },
        { $setOnInsert: { alertType: "DUPLICATE_WITHDRAWAL", influencerId: row._id, severity: "MEDIUM", evidence: row } },
        { upsert: true, new: true }
      );
    }
  }

  async updateFraud(actor, alertId, payload = {}) {
    const update = { status: payload.status || "UNDER_REVIEW", notes: payload.notes || "" };
    if (["SAFE", "RESOLVED"].includes(update.status)) {
      update.resolvedAt = new Date();
      update.resolvedBy = actor.sub || actor._id;
    }
    const alert = await InfluencerCommerceFraudAlert.findByIdAndUpdate(alertId, { $set: update }, { new: true });
    if (!alert) throw new AppError("Fraud alert not found", 404, "NOT_FOUND");
    await auditService.log({ actor, action: "admin.influencer_commerce.fraud.update", entityType: "InfluencerCommerceFraudAlert", entityId: alert._id, metadata: update }).catch(() => {});
    return alert;
  }

  async communication(query = {}) {
    const [vendorTickets, userTickets] = await Promise.all([
      require("../../models/SupportTicket").SupportTicket.find({}).sort({ updatedAt: -1 }).limit(50).lean().catch(() => []),
      require("../../models/UserSupportTicket").UserSupportTicket.find({}).sort({ updatedAt: -1 }).limit(50).lean().catch(() => []),
    ]);
    return { conversations: [...vendorTickets, ...userTickets].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 50) };
  }

  async reports(query = {}) {
    const schedules = await InfluencerCommerceReportSchedule.find({}).sort({ createdAt: -1 }).lean();
    return {
      reports: [
        "campaigns",
        "influencers",
        "vendors",
        "revenue",
        "commissions",
        "settlements",
        "withdrawals",
        "content",
        "conversions",
        "fraud",
      ].map((id) => ({ id, name: `${id[0].toUpperCase()}${id.slice(1)} Report`, exportFormats: ["csv", "excel", "pdf"] })),
      schedules,
    };
  }

  async saveReportSchedule(actor, payload = {}) {
    const schedule = await InfluencerCommerceReportSchedule.create({ ...payload, createdBy: actor.sub || actor._id });
    await auditService.log({ actor, action: "admin.influencer_commerce.report_schedule.create", entityType: "InfluencerCommerceReportSchedule", entityId: schedule._id, metadata: payload }).catch(() => {});
    return schedule;
  }

  async settings() {
    return {
      enabled: await isInfluencerCommerceEnabled(),
      defaultCommissionRate: Number(process.env.INFLUENCER_DEFAULT_COMMISSION_RATE || 10),
      maximumCommissionRate: Number(process.env.INFLUENCER_MAX_COMMISSION_RATE || 50),
      minimumWithdrawalAmount: Number(process.env.INFLUENCER_MIN_WITHDRAWAL_AMOUNT || 500),
      maximumWithdrawalAmount: Number(process.env.INFLUENCER_MAX_WITHDRAWAL_AMOUNT || 1000000),
      commissionHoldDays: Number(process.env.INFLUENCER_HOLD_DAYS || 7),
      trackingCookieDurationHours: Number(process.env.INFLUENCER_TRACKING_TTL_HOURS || 24),
      selfAttributionBlocking: true,
      fraudDetectionThresholds: { repeatedClicks: 10, conversionSpike: 5 },
      campaignApprovalRules: { adminOverrideEnabled: true },
      contentApprovalRules: { vendorAndAdminModeration: true },
      autoSettlementRules: { enabled: true },
      payoutProcessingRules: { manualReviewRequired: true },
    };
  }

  async updateSettings(actor, payload = {}) {
    if (payload.enabled !== undefined) {
      await PlatformConfig.findOneAndUpdate(
        { key: "influencer_commerce_enabled" },
        {
          $set: {
            value: Boolean(payload.enabled),
            description: "Master switch for influencer commerce, vendor campaign tools, reels, and attribution.",
            category: "feature",
            type: "boolean",
            isPublic: true,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      invalidateInfluencerCommerceConfigCache();
    }
    await auditService.log({ actor, action: "admin.influencer_commerce.settings.update", entityType: "PlatformConfig", entityId: "influencer_commerce", metadata: payload }).catch(() => {});
    return this.settings();
  }

  async auditLogs(query = {}) {
    const { page, limit, skip } = pageOptions(query);
    const filter = { action: /influencer_commerce|influencer|campaign|commission|withdrawal|content/i };
    const [items, total] = await Promise.all([
      AuditLog.find(filter).populate("actorId", "name email role").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);
    return { items, pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } };
  }
}

module.exports = new AdminInfluencerCommerceService();
