const mongoose = require("mongoose");
const vendorRepo = require("../../repositories/vendor.repository");
const productRepo = require("../../repositories/product.repository");
const campaignService = require("../campaign/service");
const reelService = require("../reel/service");
const auditService = require("../../services/audit.service");
const notificationService = require("../../services/notification.service");
const { AppError } = require("../../utils/AppError");
const { Campaign } = require("../campaign/model");
const { CommissionRecord } = require("../commission/models");
const { InfluencerProfile, InfluencerSocialAccount, InfluencerProductAssignment } = require("../influencer/model");
const { Reel } = require("../reel/model");
const { TrackingSession } = require("../tracking/model");
const { Product } = require("../../models/Product");
const { Order } = require("../../models/Order");
const { emitDomainEvent } = require("../events/event-bus");
const { VendorInfluencerRelationship } = require("./model");

const SYNC_EVENTS = {
  CAMPAIGN_INVITED: "CAMPAIGN_INVITED",
  CAMPAIGN_APPLICATION_APPROVED: "CAMPAIGN_APPLICATION_APPROVED",
  CAMPAIGN_APPLICATION_REJECTED: "CAMPAIGN_APPLICATION_REJECTED",
  CONTENT_APPROVED: "CONTENT_APPROVED",
  CONTENT_REJECTED: "CONTENT_REJECTED",
  CONTENT_CHANGES_REQUESTED: "CONTENT_CHANGES_REQUESTED",
  RELATIONSHIP_UPDATED: "RELATIONSHIP_UPDATED",
};

async function upsertProductAssignments({ campaign, influencerId, status = "approved", source = "campaign_application", actorId = null }) {
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

function objectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pageOptions(query = {}, fallbackLimit = 20) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || fallbackLimit));
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

function buildBuckets(start, end) {
  const buckets = [];
  const cursor = startOfDay(start);
  const last = startOfDay(end);
  while (cursor <= last) {
    buckets.push({
      date: cursor.toISOString().slice(0, 10),
      revenue: 0,
      commission: 0,
      conversions: 0,
      clicks: 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return buckets;
}

function money(value) {
  const number = Number(value || 0);
  return Number(number.toFixed(2));
}

async function campaignIdsForFilter(filter) {
  const campaigns = await Campaign.find(filter).select("_id").lean();
  return campaigns.map((campaign) => campaign._id);
}

function productImage(product = {}) {
  return product.thumbnail || product.images?.find((image) => image?.isPrimary)?.url || product.images?.[0]?.url || "";
}

function profileName(profile = {}) {
  return profile.displayName || profile.userId?.name || profile.userId?.email || "Creator";
}

function profileUsername(profile = {}) {
  return profile.userId?.username || profile.userId?.email || profile.influencerCode || String(profile._id || "").slice(-8);
}

function normalizeStatus(status = "") {
  const value = String(status || "").toLowerCase();
  if (["saved", "invited", "applied", "approved", "active", "paused", "blacklisted"].includes(value)) return value;
  return "saved";
}

async function notifyInfluencer(influencerId, payload) {
  const profile = await InfluencerProfile.findById(influencerId).select("userId").lean();
  if (!profile?.userId) return null;
  return notificationService.createNotification({
    userId: profile.userId,
    role: "INFLUENCER",
    module: "GROWTH",
    subModule: "INFLUENCER_COMMERCE",
    type: "INFLUENCER_COMMERCE",
    ...payload,
  }).catch(() => null);
}

async function notifyVendor(vendorId, payload) {
  return notificationService.notifyVendorUser(vendorId, {
    module: "GROWTH",
    subModule: "INFLUENCER_COMMERCE",
    type: "INFLUENCER_COMMERCE",
    ...payload,
  }).catch(() => null);
}

class InfluencerCommerceVendorService {
  async getVendor(userId) {
    const vendor = await vendorRepo.findByUserId(userId);
    if (!vendor) throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
    return vendor;
  }

  async upsertRelationship(vendorId, influencerId, payload = {}) {
    if (!influencerId) return null;
    const current = await VendorInfluencerRelationship.findOne({ vendorId, influencerId }).lean();
    const nextStatus = payload.status ? normalizeStatus(payload.status) : current?.status || "saved";
    const update = {
      $set: {
        status: nextStatus,
        source: payload.source || current?.source || "manual",
        lastActivityAt: new Date(),
        ...(payload.saved !== undefined ? { saved: Boolean(payload.saved) } : {}),
        ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
        ...(payload.blacklistReason !== undefined ? { blacklistReason: payload.blacklistReason } : {}),
        ...(nextStatus === "paused" ? { pausedAt: new Date() } : {}),
        ...(nextStatus === "blacklisted" ? { blacklistedAt: new Date() } : {}),
      },
      ...(payload.campaignId ? { $addToSet: { activeCampaignIds: payload.campaignId } } : {}),
    };
    return VendorInfluencerRelationship.findOneAndUpdate(
      { vendorId, influencerId },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  async aggregateVendorCommissions(vendorId, query = {}) {
    const { start, end } = parseRange(query);
    const match = { vendorId: objectId(vendorId), createdAt: { $gte: start, $lte: end } };
    if (objectId(query.campaignId)) match.campaignId = objectId(query.campaignId);
    if (objectId(query.influencerId)) match.influencerId = objectId(query.influencerId);

    const [summary, byInfluencer, byCampaign, trendRows] = await Promise.all([
      CommissionRecord.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$gross" },
            commission: { $sum: "$influencerShare" },
            pending: { $sum: { $cond: [{ $eq: ["$state", "HOLD"] }, "$influencerShare", 0] } },
            paid: { $sum: { $cond: [{ $eq: ["$state", "SETTLED"] }, "$influencerShare", 0] } },
            orders: { $sum: 1 },
          },
        },
      ]),
      CommissionRecord.aggregate([
        { $match: match },
        { $group: { _id: "$influencerId", revenue: { $sum: "$gross" }, commission: { $sum: "$influencerShare" }, orders: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
        { $limit: 50 },
      ]),
      CommissionRecord.aggregate([
        { $match: match },
        { $group: { _id: "$campaignId", revenue: { $sum: "$gross" }, commission: { $sum: "$influencerShare" }, orders: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
        { $limit: 50 },
      ]),
      CommissionRecord.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$gross" },
            commission: { $sum: "$influencerShare" },
            conversions: { $sum: 1 },
          },
        },
      ]),
    ]);

    const bucketMap = new Map(buildBuckets(start, end).map((bucket) => [bucket.date, bucket]));
    trendRows.forEach((row) => {
      const bucket = bucketMap.get(row._id);
      if (bucket) {
        bucket.revenue = money(row.revenue);
        bucket.commission = money(row.commission);
        bucket.conversions = Number(row.conversions || 0);
      }
    });

    return {
      summary: summary[0] || { revenue: 0, commission: 0, pending: 0, paid: 0, orders: 0 },
      byInfluencer,
      byCampaign,
      trend: [...bucketMap.values()],
      range: { start, end },
    };
  }

  async dashboard(userId, query = {}) {
    const vendor = await this.getVendor(userId);
    const { summary, byInfluencer, trend } = await this.aggregateVendorCommissions(vendor._id, query);
    const campaignFilter = { vendorId: vendor._id };
    if (objectId(query.campaignId)) campaignFilter._id = objectId(query.campaignId);
    const campaignIds = await campaignIdsForFilter(campaignFilter);

    const [campaigns, relationshipsTotal, activeInfluencers, pendingApplications, pendingContent, campaignSpend, clicksAgg, topProducts] = await Promise.all([
      Campaign.find(campaignFilter).select("title campaignType state fixedFee applications productIds analytics").lean(),
      VendorInfluencerRelationship.countDocuments({ vendorId: vendor._id }),
      VendorInfluencerRelationship.countDocuments({ vendorId: vendor._id, status: { $in: ["approved", "active"] } }),
      Campaign.aggregate([
        { $match: campaignFilter },
        { $unwind: "$applications" },
        { $match: { "applications.status": { $in: ["submitted", "pending_review", "shortlisted"] } } },
        { $count: "total" },
      ]),
      Reel.countDocuments({ campaignId: { $in: campaignIds }, state: { $in: ["uploaded", "pending_review"] } }),
      Campaign.aggregate([{ $match: campaignFilter }, { $group: { _id: null, total: { $sum: "$fixedFee" } } }]),
      TrackingSession.countDocuments({ campaignId: { $in: campaignIds } }),
      CommissionRecord.aggregate([
        { $match: { vendorId: vendor._id } },
        { $group: { _id: "$metadata.productId", revenue: { $sum: "$gross" }, commission: { $sum: "$influencerShare" }, orders: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const influencerIds = byInfluencer.map((row) => row._id).filter(Boolean);
    const influencers = influencerIds.length
      ? await InfluencerProfile.find({ _id: { $in: influencerIds } }).populate("userId", "name email username").lean()
      : [];
    const influencerMap = new Map(influencers.map((profile) => [String(profile._id), profile]));
    const products = topProducts.length
      ? await Product.find({ _id: { $in: topProducts.map((row) => row._id).filter(Boolean) } }).select("name images thumbnail category").lean()
      : [];
    const productMap = new Map(products.map((product) => [String(product._id), product]));

    const revenue = money(summary.revenue);
    const spend = money((campaignSpend[0]?.total || 0) + (summary.commission || 0));
    const roi = spend ? money(((revenue - spend) / spend) * 100) : 0;

    return {
      widgets: {
        totalInfluencers: relationshipsTotal,
        activeInfluencers,
        campaignRevenue: revenue,
        campaignSpend: spend,
        commissionPaid: money(summary.paid),
        pendingCommissions: money(summary.pending),
        campaignConversions: Number(summary.orders || 0),
        roi,
        pendingContentApprovals: pendingContent,
        pendingApplications: pendingApplications[0]?.total || 0,
      },
      charts: {
        campaignRevenueTrend: trend,
        influencerPerformanceTrend: byInfluencer.slice(0, 10).map((row) => {
          const profile = influencerMap.get(String(row._id));
          return { id: row._id, name: profileName(profile), revenue: money(row.revenue), commission: money(row.commission), orders: row.orders };
        }),
        commissionTrend: trend.map((row) => ({ date: row.date, commission: row.commission })),
        conversionTrend: trend.map((row) => ({ date: row.date, conversions: row.conversions })),
      },
      topInfluencers: byInfluencer.slice(0, 5).map((row) => {
        const profile = influencerMap.get(String(row._id));
        return { id: row._id, name: profileName(profile), username: profileUsername(profile), revenue: money(row.revenue), commission: money(row.commission), orders: row.orders };
      }),
      topProducts: topProducts.map((row) => {
        const product = productMap.get(String(row._id));
        return { id: row._id, name: product?.name || "Product", category: product?.category || "", image: productImage(product), revenue: money(row.revenue), commission: money(row.commission), orders: row.orders };
      }),
      campaigns,
    };
  }

  async discover(userId, query = {}) {
    const vendor = await this.getVendor(userId);
    const { page, limit, skip } = pageOptions(query, 24);
    const filter = {
      state: { $in: ["verified", "active"] },
      "privacy.searchVisibility": { $ne: false },
      "privacy.profileVisibility": { $ne: "private" },
    };
    if (query.category) filter.$or = [{ categories: query.category }, { primaryCategory: query.category }, { secondaryCategories: query.category }];
    if (query.country) filter["location.country"] = query.country;
    if (query.language) filter.languages = query.language;
    if (query.minFollowers || query.maxFollowers) {
      filter.followers = {};
      if (query.minFollowers) filter.followers.$gte = Number(query.minFollowers);
      if (query.maxFollowers) filter.followers.$lte = Number(query.maxFollowers);
    }
    if (query.search) {
      const re = new RegExp(escapeRegex(query.search), "i");
      filter.$and = [{ $or: [{ displayName: re }, { influencerCode: re }, { primaryCategory: re }, { categories: re }] }];
    }

    const sortMap = {
      highest_revenue: { "stats.revenue": -1 },
      highest_conversion: { "stats.sales": -1, "stats.clicks": 1 },
      most_followers: { followers: -1 },
      recommended: { verified: -1, rating: -1, followers: -1 },
      trending: { "stats.views": -1, followers: -1 },
    };
    const sort = sortMap[query.sort] || sortMap.trending;
    const [items, total, relationships, socialAccounts] = await Promise.all([
      InfluencerProfile.find(filter).populate("userId", "name email username").sort(sort).skip(skip).limit(limit).lean(),
      InfluencerProfile.countDocuments(filter),
      VendorInfluencerRelationship.find({ vendorId: vendor._id }).lean(),
      InfluencerSocialAccount.find({ verificationStatus: "verified" }).lean(),
    ]);
    const relationshipMap = new Map(relationships.map((row) => [String(row.influencerId), row]));
    const socialMap = socialAccounts.reduce((map, account) => {
      const key = String(account.influencerId || "");
      const list = map.get(key) || [];
      list.push(account);
      map.set(key, list);
      return map;
    }, new Map());

    return {
      items: items.map((profile) => {
        const socials = socialMap.get(String(profile._id)) || [];
        const engagementRate = socials.length
          ? money(socials.reduce((sum, account) => sum + Number(account.engagementRate || 0), 0) / socials.length)
          : 0;
        const clicks = Number(profile.stats?.clicks || 0);
        const sales = Number(profile.stats?.sales || 0);
        return {
          id: profile._id,
          _id: profile._id,
          profilePicture: profile.profilePicture,
          name: profileName(profile),
          username: profileUsername(profile),
          category: profile.primaryCategory || profile.categories?.[0] || "",
          categories: profile.categories || [],
          followers: Number(profile.followers || 0),
          engagementRate,
          conversionRate: clicks ? money((sales / clicks) * 100) : 0,
          averageRevenue: sales ? money(Number(profile.stats?.revenue || 0) / sales) : 0,
          revenueGenerated: Number(profile.stats?.revenue || 0),
          location: profile.location,
          languages: profile.languages || [],
          verified: Boolean(profile.verified),
          status: relationshipMap.get(String(profile._id))?.status || "",
          saved: Boolean(relationshipMap.get(String(profile._id))?.saved),
        };
      }),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async relationships(userId, query = {}) {
    const vendor = await this.getVendor(userId);
    const { page, limit, skip } = pageOptions(query, 20);
    const filter = { vendorId: vendor._id };
    if (query.status) filter.status = query.status;
    const [items, total] = await Promise.all([
      VendorInfluencerRelationship.find(filter)
        .populate({ path: "influencerId", populate: { path: "userId", select: "name email username" } })
        .sort({ lastActivityAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VendorInfluencerRelationship.countDocuments(filter),
    ]);
    return {
      items: items.map((relationship) => ({
        id: relationship._id,
        influencer: relationship.influencerId,
        influencerId: relationship.influencerId?._id,
        name: profileName(relationship.influencerId),
        username: profileUsername(relationship.influencerId),
        status: relationship.status,
        activeCampaigns: relationship.metricsSnapshot?.activeCampaigns || relationship.activeCampaignIds?.length || 0,
        revenueGenerated: money(relationship.metricsSnapshot?.revenue || 0),
        commissionPaid: money(relationship.metricsSnapshot?.commission || 0),
        conversionRate: money(relationship.metricsSnapshot?.conversionRate || 0),
        lastActivity: relationship.lastActivityAt || relationship.updatedAt,
      })),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async saveInfluencer(userId, influencerId, saved = true) {
    const vendor = await this.getVendor(userId);
    const profile = await InfluencerProfile.findById(influencerId).lean();
    if (!profile) throw new AppError("Influencer not found", 404, "NOT_FOUND");
    const relationship = await this.upsertRelationship(vendor._id, influencerId, {
      status: saved ? "saved" : "paused",
      source: "discovery",
      saved,
    });
    await auditService.log({ actor: { _id: userId, role: "vendor" }, action: saved ? "influencer.saved" : "influencer.unsaved", entityType: "VendorInfluencerRelationship", entityId: relationship._id, metadata: { vendorId: String(vendor._id), influencerId } }).catch(() => {});
    return relationship;
  }

  async updateRelationship(userId, influencerId, payload = {}) {
    const vendor = await this.getVendor(userId);
    const relationship = await this.upsertRelationship(vendor._id, influencerId, {
      status: payload.status,
      source: "manual",
      notes: payload.notes,
      blacklistReason: payload.blacklistReason,
    });
    await emitDomainEvent(SYNC_EVENTS.RELATIONSHIP_UPDATED, { vendorId: vendor._id, influencerId, status: relationship.status });
    return relationship;
  }

  async createCampaign(userId, payload = {}) {
    const vendor = await this.getVendor(userId);
    let campaign;
    if (payload.influencerId) {
      campaign = await campaignService.create(userId, payload);
      await this.upsertRelationship(vendor._id, campaign.influencerId, {
        status: "invited",
        source: "campaign_invite",
        campaignId: campaign._id,
      });
      await notifyInfluencer(campaign.influencerId, {
        title: "Campaign invitation",
        message: "A vendor invited you to a campaign.",
        referenceId: campaign._id,
        meta: { campaignId: campaign._id, vendorId: vendor._id },
      });
      await emitDomainEvent(SYNC_EVENTS.CAMPAIGN_INVITED, { campaignId: campaign._id, vendorId: vendor._id, influencerId: campaign.influencerId });
    } else {
      const productIds = Array.isArray(payload.productIds) ? payload.productIds : [];
      const products = await Product.find({ _id: { $in: productIds }, sellerId: vendor._id }).select("_id").lean();
      if (products.length !== productIds.length) {
        throw new AppError("Campaign products must belong to the vendor", 403, "FORBIDDEN");
      }
      campaign = await Campaign.create({
        vendorId: vendor._id,
        title: payload.title || "",
        description: payload.description || "",
        banner: payload.banner || "",
        campaignType: payload.campaignType || "affiliate",
        category: payload.category || "",
        country: payload.country || "",
        language: payload.language || "en",
        marketplace: {
          public: payload.marketplace?.public !== false,
          applicationDeadline: payload.marketplace?.applicationDeadline || payload.deadline,
          availableSlots: payload.marketplace?.availableSlots || 1,
          requiredDeliverables: payload.marketplace?.requiredDeliverables || [],
          requirements: payload.marketplace?.requirements || {},
          assets: payload.marketplace?.assets || [],
        },
        productIds,
        commissionPercent: payload.commissionPercent,
        fixedFee: payload.fixedFee || 0,
        deadline: payload.deadline,
        state: "draft",
        history: [{ state: "draft", actorId: userId, note: "Marketplace campaign created by vendor", changedAt: new Date() }],
      });
    }
    await auditService.log({ actor: { _id: userId, role: "vendor" }, action: payload.influencerId ? "campaign.invite" : "campaign.create", entityType: "Campaign", entityId: campaign._id, metadata: { influencerId: payload.influencerId || null } }).catch(() => {});
    return campaign;
  }

  async campaigns(userId, query = {}) {
    const vendor = await this.getVendor(userId);
    const filter = { vendorId: vendor._id };
    if (query.state) filter.state = query.state;
    if (query.campaignType) filter.campaignType = query.campaignType;
    if (query.search) {
      const re = new RegExp(escapeRegex(query.search), "i");
      filter.$or = [{ title: re }, { description: re }, { category: re }];
    }
    const { page, limit, skip } = pageOptions(query, 20);
    const [items, total] = await Promise.all([
      Campaign.find(filter)
        .populate({ path: "influencerId", populate: { path: "userId", select: "name email username" } })
        .populate("productIds", "name images thumbnail category price discountPrice")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Campaign.countDocuments(filter),
    ]);
    return {
      items: items.map((campaign) => ({
        ...campaign,
        budget: Number(campaign.fixedFee || 0),
        revenue: Number(campaign.analytics?.revenue || 0),
        applicationsCount: campaign.applications?.length || 0,
        approvedCreators: (campaign.applications || []).filter((app) => app.status === "approved").length + (campaign.influencerId ? 1 : 0),
      })),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async reviewApplication(userId, campaignId, influencerId, payload = {}) {
    const vendor = await this.getVendor(userId);
    const campaignObjectId = objectId(campaignId);
    const influencerObjectId = objectId(influencerId);
    if (!campaignObjectId || !influencerObjectId) {
      throw new AppError("Invalid campaign application reference", 400, "INVALID_APPLICATION_REFERENCE");
    }
    const campaign = await Campaign.findOne({ _id: campaignObjectId, vendorId: vendor._id });
    if (!campaign) throw new AppError("Campaign not found", 404, "NOT_FOUND");
    const application = campaign.applications.find((item) => String(item.influencerId?._id || item.influencerId) === String(influencerId));
    if (!application) throw new AppError("Application not found", 404, "NOT_FOUND");
    const decision = payload.decision === "approve" ? "approved" : "rejected";
    if (application.status === decision) {
      return {
        campaignId: campaign._id,
        influencerId: influencerObjectId,
        status: application.status,
        reviewedAt: application.reviewedAt,
        unchanged: true,
      };
    }
    application.status = decision;
    application.reviewedAt = new Date();
    campaign.history.push({ state: decision, actorId: userId, note: payload.note || `Application ${decision}`, changedAt: new Date() });
    if (decision === "approved" && campaign.state === "draft") campaign.state = "active";
    await campaign.save();
    if (decision === "approved") {
      await upsertProductAssignments({ campaign, influencerId: influencerObjectId, status: "approved", source: "campaign_application", actorId: userId });
    }
    await this.upsertRelationship(vendor._id, influencerId, {
      status: decision === "approved" ? "approved" : "paused",
      source: "campaign_application",
      campaignId: campaign._id,
    });
    await notifyInfluencer(influencerId, {
      title: decision === "approved" ? "Campaign approved" : "Campaign application update",
      message: decision === "approved" ? "Your campaign application was approved." : "Your campaign application was not approved.",
      referenceId: campaign._id,
      meta: { campaignId: campaign._id, decision, note: payload.note || "" },
    });
    await emitDomainEvent(decision === "approved" ? SYNC_EVENTS.CAMPAIGN_APPLICATION_APPROVED : SYNC_EVENTS.CAMPAIGN_APPLICATION_REJECTED, {
      campaignId: campaign._id,
      vendorId: vendor._id,
      influencerId,
    });
    await auditService.log({ actor: { _id: userId, role: "vendor" }, action: `campaign.application.${decision}`, entityType: "Campaign", entityId: campaign._id, metadata: { influencerId, note: payload.note || "" } }).catch(() => {});
    return {
      campaignId: campaign._id,
      influencerId: influencerObjectId,
      status: decision,
      reviewedAt: application.reviewedAt,
      campaignState: campaign.state,
    };
  }

  async updateCampaignStatus(userId, campaignId, payload = {}) {
    const vendor = await this.getVendor(userId);
    const action = String(payload.action || "").toLowerCase();
    const state = action === "pause" ? "cancelled" : action === "close" ? "completed" : action === "activate" ? "active" : payload.state;
    if (!["draft", "proposed", "accepted", "active", "completed", "cancelled"].includes(state)) {
      throw new AppError("Invalid campaign state", 400, "INVALID_STATE");
    }
    const campaign = await Campaign.findOneAndUpdate(
      { _id: campaignId, vendorId: vendor._id },
      { $set: { state }, $push: { history: { state, actorId: userId, note: payload.note || `Campaign ${state}`, changedAt: new Date() } } },
      { new: true }
    );
    if (!campaign) throw new AppError("Campaign not found", 404, "NOT_FOUND");
    await auditService.log({ actor: { _id: userId, role: "vendor" }, action: "campaign.status.update", entityType: "Campaign", entityId: campaign._id, metadata: { state } }).catch(() => {});
    return campaign;
  }

  async deleteCampaign(userId, campaignId) {
    const vendor = await this.getVendor(userId);
    const campaign = await Campaign.findOne({ _id: campaignId, vendorId: vendor._id });
    if (!campaign) throw new AppError("Campaign not found", 404, "NOT_FOUND");

    const [commissionCount, contentCount] = await Promise.all([
      CommissionRecord.countDocuments({ campaignId: campaign._id }),
      Reel.countDocuments({ campaignId: campaign._id }),
    ]);
    if ((campaign.applications || []).length || commissionCount || contentCount) {
      throw new AppError(
        "Campaign has applications, content, or commission records. Close the campaign instead of deleting it.",
        409,
        "CAMPAIGN_DELETE_LOCKED"
      );
    }

    await Campaign.deleteOne({ _id: campaign._id, vendorId: vendor._id });
    await VendorInfluencerRelationship.updateMany(
      { vendorId: vendor._id, activeCampaignIds: campaign._id },
      { $pull: { activeCampaignIds: campaign._id } }
    );
    await auditService.log({
      actor: { _id: userId, role: "vendor" },
      action: "campaign.delete",
      entityType: "Campaign",
      entityId: campaign._id,
      metadata: { title: campaign.title, accidentalDelete: true },
    }).catch(() => {});
    return { deleted: true, campaignId: campaign._id };
  }

  async products(userId, query = {}) {
    const vendor = await this.getVendor(userId);
    const { page, limit, skip } = pageOptions(query, 20);
    const filter = { sellerId: vendor._id };
    if (query.category) filter.category = query.category;
    if (query.search) filter.name = new RegExp(escapeRegex(query.search), "i");
    const [products, total, campaignProducts, productStats] = await Promise.all([
      Product.find(filter).select("name images thumbnail category price discountPrice stock status analytics").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
      Campaign.find({ vendorId: vendor._id }).select("productIds state").lean(),
      CommissionRecord.aggregate([
        { $match: { vendorId: vendor._id } },
        { $group: { _id: "$metadata.productId", revenue: { $sum: "$gross" }, commission: { $sum: "$influencerShare" }, orders: { $sum: 1 } } },
      ]),
    ]);
    const campaignProductSet = new Set(campaignProducts.flatMap((campaign) => (campaign.productIds || []).map(String)));
    const statMap = new Map(productStats.map((row) => [String(row._id), row]));
    return {
      items: products.map((product) => {
        const stat = statMap.get(String(product._id)) || {};
        const clicks = Number(product.analytics?.views || 0);
        const orders = Number(stat.orders || 0);
        return {
          id: product._id,
          product,
          name: product.name,
          image: productImage(product),
          category: product.category,
          available: product.status === "APPROVED" && product.stock > 0,
          promoted: campaignProductSet.has(String(product._id)),
          clicks,
          orders,
          revenue: money(stat.revenue || 0),
          commission: money(stat.commission || 0),
          ctr: clicks ? money((orders / clicks) * 100) : 0,
          conversionRate: clicks ? money((orders / clicks) * 100) : 0,
        };
      }),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async affiliateProducts(userId, query = {}) {
    return this.products(userId, query);
  }

  async contentApprovals(userId, query = {}) {
    const vendor = await this.getVendor(userId);
    const campaignIds = await campaignIdsForFilter({ vendorId: vendor._id });
    const { page, limit, skip } = pageOptions(query, 20);
    const filter = { campaignId: { $in: campaignIds } };
    if (query.status) filter.state = query.status;
    if (!query.status && query.queue === "pending") filter.state = { $in: ["uploaded", "pending_review"] };
    const [items, total] = await Promise.all([
      Reel.find(filter)
        .populate({ path: "influencerId", populate: { path: "userId", select: "name email username" } })
        .populate("campaignId", "title campaignType state")
        .populate("productIds", "name images thumbnail")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Reel.countDocuments(filter),
    ]);
    return {
      items: items.map((item) => ({
        id: item._id,
        creator: item.influencerId,
        creatorName: profileName(item.influencerId),
        campaign: item.campaignId,
        contentType: item.contentType,
        submittedDate: item.createdAt,
        status: item.state,
        title: item.title || item.caption || "Untitled content",
        url: item.videoUrl,
        thumbnailUrl: item.thumbnailUrl || item.videoUrl,
        metrics: item.metrics || {},
        moderation: item.moderation || {},
      })),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async reviewContent(userId, reelId, payload = {}) {
    const action = payload.decision === "approve" ? "approve" : payload.decision === "reject" ? "reject" : "reject";
    const updated = await reelService.publish({ sub: userId, role: "vendor" }, reelId, {
      action,
      notes: payload.note || payload.requestedChanges || "",
    });
    if (payload.decision === "changes") {
      updated.state = "pending_review";
      updated.moderation.notes = payload.requestedChanges || payload.note || "";
      await updated.save();
    }
    const eventName = payload.decision === "approve" ? SYNC_EVENTS.CONTENT_APPROVED : payload.decision === "changes" ? SYNC_EVENTS.CONTENT_CHANGES_REQUESTED : SYNC_EVENTS.CONTENT_REJECTED;
    await notifyInfluencer(updated.influencerId, {
      title: payload.decision === "approve" ? "Content approved" : "Content needs updates",
      message: payload.note || payload.requestedChanges || "Your campaign content was reviewed.",
      referenceId: updated._id,
      meta: { reelId: updated._id, campaignId: updated.campaignId, decision: payload.decision },
    });
    await emitDomainEvent(eventName, { reelId: updated._id, campaignId: updated.campaignId, influencerId: updated.influencerId });
    await auditService.log({ actor: { _id: userId, role: "vendor" }, action: `content.${payload.decision || "review"}`, entityType: "Reel", entityId: updated._id, metadata: { note: payload.note || payload.requestedChanges || "" } }).catch(() => {});
    return updated;
  }

  async performance(userId, query = {}) {
    const vendor = await this.getVendor(userId);
    const { byInfluencer } = await this.aggregateVendorCommissions(vendor._id, query);
    const influencerIds = byInfluencer.map((row) => row._id).filter(Boolean);
    const [profiles, reels] = await Promise.all([
      InfluencerProfile.find({ _id: { $in: influencerIds } }).populate("userId", "name email username").lean(),
      Reel.aggregate([
        { $match: { influencerId: { $in: influencerIds } } },
        { $group: { _id: "$influencerId", clicks: { $sum: "$metrics.clicks" }, engagement: { $sum: { $add: ["$metrics.likes", "$metrics.comments", "$metrics.shares"] } } } },
      ]),
    ]);
    const profileMap = new Map(profiles.map((profile) => [String(profile._id), profile]));
    const reelMap = new Map(reels.map((row) => [String(row._id), row]));
    return {
      items: byInfluencer.map((row) => {
        const profile = profileMap.get(String(row._id));
        const reel = reelMap.get(String(row._id)) || {};
        return {
          influencerId: row._id,
          name: profileName(profile),
          username: profileUsername(profile),
          revenueGenerated: money(row.revenue),
          ordersGenerated: Number(row.orders || 0),
          clicks: Number(reel.clicks || 0),
          conversions: Number(row.orders || 0),
          ctr: reel.clicks ? money((row.orders / reel.clicks) * 100) : 0,
          roi: row.commission ? money(((row.revenue - row.commission) / row.commission) * 100) : 0,
          engagement: Number(reel.engagement || 0),
          averageOrderValue: row.orders ? money(row.revenue / row.orders) : 0,
          commissionPaid: money(row.commission),
        };
      }),
    };
  }

  async analytics(userId, query = {}) {
    const vendor = await this.getVendor(userId);
    const [commission, campaigns] = await Promise.all([
      this.aggregateVendorCommissions(vendor._id, query),
      this.campaigns(userId, { ...query, limit: 100 }),
    ]);
    const clicks = await TrackingSession.countDocuments({ campaignId: { $in: campaigns.items.map((item) => item._id) } });
    return {
      kpis: {
        campaignRevenue: money(commission.summary.revenue),
        campaignSpend: money((commission.summary.commission || 0) + campaigns.items.reduce((sum, item) => sum + Number(item.fixedFee || 0), 0)),
        roi: commission.summary.commission ? money(((commission.summary.revenue - commission.summary.commission) / commission.summary.commission) * 100) : 0,
        commissionPaid: money(commission.summary.paid),
        conversions: Number(commission.summary.orders || 0),
        orders: Number(commission.summary.orders || 0),
        clicks,
      },
      charts: {
        revenueTrend: commission.trend,
        creatorPerformance: commission.byInfluencer,
        productPerformance: await this.products(userId, { limit: 10 }),
        conversionFunnel: [
          { label: "Clicks", value: clicks },
          { label: "Orders", value: Number(commission.summary.orders || 0) },
          { label: "Paid Commission", value: money(commission.summary.paid) },
        ],
        campaignComparison: campaigns.items.map((campaign) => ({
          id: campaign._id,
          title: campaign.title,
          revenue: Number(campaign.analytics?.revenue || 0),
          orders: Number(campaign.analytics?.orders || 0),
          clicks: Number(campaign.analytics?.clicks || 0),
        })),
      },
    };
  }

  async leaderboard(userId, query = {}) {
    const performance = await this.performance(userId, query);
    return {
      items: performance.items
        .map((row) => ({
          ...row,
          score: money(Number(row.revenueGenerated || 0) * 0.45 + Number(row.conversions || 0) * 25 + Number(row.engagement || 0) * 0.1),
        }))
        .sort((a, b) => b.score - a.score)
        .map((row, index) => ({ rank: index + 1, creator: row.name, ...row })),
    };
  }

  async reports(userId, query = {}) {
    const [dashboard, performance, content] = await Promise.all([
      this.dashboard(userId, query),
      this.performance(userId, query),
      this.contentApprovals(userId, { limit: 10 }),
    ]);
    return {
      reports: [
        { id: "campaigns", name: "Campaign Reports", rows: dashboard.campaigns?.length || 0, exportFormats: ["csv", "excel", "pdf"] },
        { id: "influencers", name: "Influencer Reports", rows: performance.items.length, exportFormats: ["csv", "excel", "pdf"] },
        { id: "revenue", name: "Revenue Reports", rows: dashboard.charts.campaignRevenueTrend.length, exportFormats: ["csv", "excel", "pdf"] },
        { id: "commissions", name: "Commission Reports", rows: performance.items.length, exportFormats: ["csv", "excel", "pdf"] },
        { id: "content", name: "Content Reports", rows: content.pagination.total, exportFormats: ["csv", "excel", "pdf"] },
        { id: "conversions", name: "Conversion Reports", rows: dashboard.widgets.campaignConversions, exportFormats: ["csv", "excel", "pdf"] },
      ],
      schedules: [
        { frequency: "daily", enabled: false },
        { frequency: "weekly", enabled: false },
        { frequency: "monthly", enabled: false },
      ],
    };
  }
}

module.exports = new InfluencerCommerceVendorService();
