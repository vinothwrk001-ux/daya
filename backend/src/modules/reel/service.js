const { AppError } = require("../../utils/AppError");
const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");
const { resolveApiAssetUrl } = { resolveApiAssetUrl: (value) => value };
const influencerService = require("../influencer/service");
const trackingService = require("../tracking/service");
const { InfluencerAffiliateSetting, InfluencerFollower, InfluencerProfile, InfluencerStorefrontEvent } = require("../influencer/model");
const { Campaign } = require("../campaign/model");
const { emitDomainEvent } = require("../events/event-bus");
const { INFLUENCER_EVENTS } = require("../shared/constants");
const { Reel } = require("./model");
const { CommissionRecord } = require("../commission/models");
const {
  ReelLike,
  ReelComment,
  ReelCommentReply,
  ReelShare,
  ReelSave,
  ReelView,
  ReelWatchHistory,
  ReelProductClick,
  ReelStoreVisit,
  CreatorFollow,
  CreatorFollower,
  AffiliateClick,
  AffiliateAttribution,
  CommerceEvent,
  EngagementAnalytics,
  CreatorAnalytics,
  CampaignAnalytics,
  ProductEngagementAnalytics,
} = require("./engagement.model");
const { REEL_UPLOAD_DIR } = require("../../middleware/reelUpload");

function cleanString(value = "") {
  return String(value || "").trim();
}

function normalizeTags(value = []) {
  return Array.from(new Set((Array.isArray(value) ? value : String(value || "").split(","))
    .map((item) => cleanString(item).toLowerCase())
    .filter(Boolean)
    .slice(0, 20)));
}

function buildContentFilter(influencerId, query = {}) {
  const filter = { influencerId };
  if (query.state) filter.state = query.state;
  if (query.contentTypes) {
    filter.contentType = {
      $in: String(query.contentTypes)
        .split(",")
        .map((item) => cleanString(item))
        .filter(Boolean),
    };
  } else if (query.contentType) filter.contentType = query.contentType;
  if (query.visibility) filter.visibility = query.visibility;
  if (query.category) filter.category = cleanString(query.category);
  if (query.campaignId) filter.campaignId = query.campaignId;
  if (query.productId) filter.productIds = query.productId;
  if (query.scheduled === "true") filter.scheduledAt = { $ne: null };
  if (query.search) {
    const re = new RegExp(cleanString(query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ title: re }, { caption: re }, { description: re }, { tags: re }];
  }
  return filter;
}

function contentSummary(row = {}) {
  const metrics = row.metrics || {};
  const views = Number(metrics.views || 0);
  const clicks = Number(metrics.clicks || 0);
  const orders = Number(metrics.orders || 0);
  return {
    ...row,
    title: row.title || row.caption || "Untitled content",
    thumbnailUrl: row.thumbnailUrl || row.videoUrl,
    engagementRate: views ? Number((((Number(metrics.likes || 0) + Number(metrics.comments || 0) + Number(metrics.shares || 0)) / views) * 100).toFixed(2)) : 0,
    ctr: views ? Number(((clicks / views) * 100).toFixed(2)) : 0,
    conversionRate: clicks ? Number(((orders / clicks) * 100).toFixed(2)) : 0,
  };
}

function idOf(value) {
  return String(value?._id || value || "");
}

function campaignAllowsInfluencerContent(campaign, influencerId) {
  const profileId = idOf(influencerId);
  if (idOf(campaign.influencerId) === profileId) return true;

  return (campaign.applications || []).some((application) => (
    idOf(application.influencerId) === profileId &&
    ["approved"].includes(String(application.status || "").toLowerCase())
  ));
}

async function deleteLocalReelAsset(url = "") {
  const value = cleanString(url);
  if (!value.startsWith("/uploads/reels/")) return;
  const filename = path.basename(value);
  const filePath = path.resolve(REEL_UPLOAD_DIR, filename);
  const uploadRoot = path.resolve(REEL_UPLOAD_DIR);
  if (!filePath.startsWith(uploadRoot)) return;
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function toObjectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function publicReelFilter(reelId) {
  return {
    _id: reelId,
    visibility: "published",
    state: { $in: ["approved", "published"] },
  };
}

function extractMentions(text = "") {
  return Array.from(new Set(String(text).match(/@[\w.-]{2,50}/g) || [])).slice(0, 20);
}

function attributionWindowDays(value) {
  const next = Number(value || process.env.AFFILIATE_ATTRIBUTION_WINDOW_DAYS || 30);
  return [7, 30, 60, 90].includes(next) ? next : 30;
}

async function incrementAnalytics({ reel, metric, amount = 1, productId = null, value = 0, metadata = {} }) {
  const key = `metrics.${metric}`;
  const update = { $inc: { [key]: Number(amount || 0) } };
  if (value) update.$inc["metrics.revenue"] = Number(value || 0);
  const base = {
    reelId: reel._id,
    influencerId: reel.influencerId,
    campaignId: reel.campaignId || undefined,
    productId: productId || undefined,
    date: dayKey(),
  };
  const writes = [
    EngagementAnalytics.updateOne(base, update, { upsert: true }),
    CreatorAnalytics.updateOne({ influencerId: reel.influencerId, date: base.date }, update, { upsert: true }),
  ];
  if (reel.campaignId) writes.push(CampaignAnalytics.updateOne({ campaignId: reel.campaignId, date: base.date }, update, { upsert: true }));
  if (productId) writes.push(ProductEngagementAnalytics.updateOne({ productId, date: base.date }, update, { upsert: true }));
  if (metadata.eventType) {
    writes.push(CommerceEvent.create({
      eventType: metadata.eventType,
      reelId: reel._id,
      productId: productId || undefined,
      campaignId: reel.campaignId || undefined,
      influencerId: reel.influencerId,
      userId: metadata.userId || null,
      anonymousId: metadata.anonymousId || "",
      source: metadata.source || "reel",
      value,
      metadata,
    }).catch(() => null));
  }
  await Promise.all(writes);
}

async function getPublishedReel(reelId) {
  const reel = await Reel.findOne(publicReelFilter(reelId)).lean();
  if (!reel) throw new AppError("Reel not found", 404, "NOT_FOUND");
  return reel;
}

class ReelService {
  async buildEngagementState(reelIds = [], userId = "") {
    const objectIds = reelIds.map(toObjectId).filter(Boolean);
    if (!objectIds.length) return new Map();
    const match = { reelId: { $in: objectIds } };
    const [likes, comments, shares, saves, views, productClicks, storeVisits, userLikes, userSaves] = await Promise.all([
      ReelLike.aggregate([{ $match: match }, { $group: { _id: "$reelId", count: { $sum: 1 } } }]),
      ReelComment.aggregate([{ $match: { ...match, status: { $ne: "deleted" } } }, { $group: { _id: "$reelId", count: { $sum: 1 } } }]),
      ReelShare.aggregate([{ $match: match }, { $group: { _id: "$reelId", count: { $sum: 1 } } }]),
      ReelSave.aggregate([{ $match: match }, { $group: { _id: "$reelId", count: { $sum: 1 } } }]),
      ReelView.aggregate([{ $match: match }, { $group: { _id: "$reelId", count: { $sum: 1 }, watchTimeSeconds: { $sum: "$watchTimeSeconds" } } }]),
      ReelProductClick.aggregate([{ $match: match }, { $group: { _id: "$reelId", count: { $sum: 1 } } }]),
      ReelStoreVisit.aggregate([{ $match: match }, { $group: { _id: "$reelId", count: { $sum: 1 } } }]),
      userId ? ReelLike.find({ reelId: { $in: objectIds }, userId }).select("reelId").lean() : [],
      userId ? ReelSave.find({ reelId: { $in: objectIds }, userId }).select("reelId").lean() : [],
    ]);
    const state = new Map(objectIds.map((id) => [String(id), {
      counts: { likes: 0, comments: 0, shares: 0, saves: 0, views: 0, productClicks: 0, storeVisits: 0, watchTimeSeconds: 0 },
      viewer: { liked: false, saved: false },
    }]));
    const apply = (rows, key, extraKey = "") => rows.forEach((row) => {
      const item = state.get(String(row._id));
      if (!item) return;
      item.counts[key] = Number(row.count || 0);
      if (extraKey) item.counts[extraKey] = Number(row[extraKey] || 0);
    });
    apply(likes, "likes");
    apply(comments, "comments");
    apply(shares, "shares");
    apply(saves, "saves");
    apply(views, "views", "watchTimeSeconds");
    apply(productClicks, "productClicks");
    apply(storeVisits, "storeVisits");
    userLikes.forEach((row) => {
      const item = state.get(String(row.reelId));
      if (item) item.viewer.liked = true;
    });
    userSaves.forEach((row) => {
      const item = state.get(String(row.reelId));
      if (item) item.viewer.saved = true;
    });
    return state;
  }

  mergeEngagement(row = {}, state = {}) {
    const counts = state.counts || {};
    const metrics = {
      ...(row.metrics || {}),
      likes: counts.likes ?? Number(row.metrics?.likes || 0),
      comments: counts.comments ?? Number(row.metrics?.comments || 0),
      shares: counts.shares ?? Number(row.metrics?.shares || 0),
      bookmarks: counts.saves ?? Number(row.metrics?.bookmarks || 0),
      saves: counts.saves ?? Number(row.metrics?.saves || row.metrics?.bookmarks || 0),
      views: counts.views || Number(row.metrics?.views || 0),
      clicks: counts.productClicks || Number(row.metrics?.clicks || 0),
      storeVisits: counts.storeVisits || 0,
      watchTimeSeconds: counts.watchTimeSeconds || Number(row.metrics?.watchTimeSeconds || 0),
    };
    return { ...row, metrics, engagement: { counts: metrics, viewer: state.viewer || { liked: false, saved: false } } };
  }

  async upload(userId, payload = {}) {
    const profile = await influencerService.getProfile(userId);
    let campaign = null;
    if (payload.campaignId) {
      campaign = await Campaign.findById(payload.campaignId);
      if (!campaign) throw new AppError("Campaign not found", 404, "NOT_FOUND");
      if (!campaignAllowsInfluencerContent(campaign, profile._id)) {
        throw new AppError("Campaign does not belong to this influencer", 403, "FORBIDDEN");
      }
      if (campaign.state !== "active") {
        throw new AppError("Reels can only be submitted for active campaigns", 400, "CAMPAIGN_NOT_ACTIVE");
      }
      const allowedProducts = new Set((campaign.productIds || []).map(String));
      const requestedProducts = (payload.productIds || []).map(String);
      if (requestedProducts.some((productId) => !allowedProducts.has(productId))) {
        throw new AppError("Reels can only tag products from the assigned campaign", 403, "PRODUCT_NOT_APPROVED_FOR_CAMPAIGN");
      }
    } else if ((payload.productIds || []).length) {
      throw new AppError("Select an active campaign before tagging products", 400, "CAMPAIGN_REQUIRED_FOR_PRODUCT_TAGS");
    }

    return await Reel.create({
      influencerId: profile._id,
      campaignId: campaign?._id || payload.campaignId || undefined,
      productIds: payload.productIds?.length ? payload.productIds : campaign?.productIds || [],
      videoUrl: payload.videoUrl,
      thumbnailUrl: payload.thumbnailUrl || "",
      title: payload.title || payload.caption || "",
      description: payload.description || "",
      contentType: payload.contentType || "reel",
      category: payload.category || "",
      tags: normalizeTags(payload.tags),
      language: payload.language || "en",
      collectionIds: payload.collectionIds || [],
      brand: payload.brand || "",
      caption: payload.caption || "",
      visibility: payload.visibility || (payload.scheduledAt ? "scheduled" : "draft"),
      scheduledAt: payload.scheduledAt || undefined,
      state: payload.visibility === "published" ? "published" : "pending_review",
      publishedAt: payload.visibility === "published" ? new Date() : undefined,
    });
  }

  async listContent(userId, query = {}) {
    const profile = await influencerService.getProfile(userId);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 12));
    const skip = (page - 1) * limit;
    const filter = buildContentFilter(profile._id, query);
    const [items, total] = await Promise.all([
      Reel.find(filter)
        .populate({ path: "productIds", select: "name images thumbnail category price discountPrice" })
        .populate({ path: "collectionIds", select: "title slug" })
        .populate({ path: "campaignId", select: "state commissionPercent deadline", populate: { path: "vendorId", select: "shopName companyName" } })
        .sort(query.sort === "views" ? { "metrics.views": -1 } : query.sort === "revenue" ? { "metrics.revenue": -1 } : { createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Reel.countDocuments(filter),
    ]);
    return { items: items.map(contentSummary), page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
  }

  async updateContent(userId, reelId, payload = {}) {
    const profile = await influencerService.getProfile(userId);
    if (payload.productIds !== undefined || payload.campaignId !== undefined) {
      const campaignId = payload.campaignId || (await Reel.findOne({ _id: reelId, influencerId: profile._id }).select("campaignId").lean())?.campaignId;
      if (!campaignId && (payload.productIds || []).length) {
        throw new AppError("Select an active campaign before tagging products", 400, "CAMPAIGN_REQUIRED_FOR_PRODUCT_TAGS");
      }
      if (campaignId) {
        const campaign = await Campaign.findById(campaignId).lean();
        if (!campaign || !campaignAllowsInfluencerContent(campaign, profile._id) || campaign.state !== "active") {
          throw new AppError("Campaign does not allow product tagging", 403, "FORBIDDEN");
        }
        const allowedProducts = new Set((campaign.productIds || []).map(String));
        const requestedProducts = (payload.productIds || []).map(String);
        if (requestedProducts.some((productId) => !allowedProducts.has(productId))) {
          throw new AppError("Reels can only tag products from the assigned campaign", 403, "PRODUCT_NOT_APPROVED_FOR_CAMPAIGN");
        }
      }
    }
    const update = {
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.caption !== undefined ? { caption: payload.caption } : {}),
      ...(payload.thumbnailUrl !== undefined ? { thumbnailUrl: payload.thumbnailUrl } : {}),
      ...(payload.contentType !== undefined ? { contentType: payload.contentType } : {}),
      ...(payload.category !== undefined ? { category: payload.category } : {}),
      ...(payload.tags !== undefined ? { tags: normalizeTags(payload.tags) } : {}),
      ...(payload.language !== undefined ? { language: payload.language } : {}),
      ...(payload.productIds !== undefined ? { productIds: payload.productIds } : {}),
      ...(payload.collectionIds !== undefined ? { collectionIds: payload.collectionIds } : {}),
      ...(payload.campaignId !== undefined ? { campaignId: payload.campaignId || undefined } : {}),
      ...(payload.visibility !== undefined ? { visibility: payload.visibility } : {}),
      ...(payload.scheduledAt !== undefined ? { scheduledAt: payload.scheduledAt || null } : {}),
      ...(payload.seo !== undefined ? { seo: payload.seo } : {}),
    };
    if (payload.action === "publish") {
      update.visibility = "published";
      update.state = "published";
      update.publishedAt = new Date();
    }
    if (payload.action === "archive") {
      update.visibility = "archived";
      update.state = "rejected";
    }
    const reel = await Reel.findOneAndUpdate({ _id: reelId, influencerId: profile._id }, { $set: update }, { new: true, runValidators: true }).lean();
    if (!reel) throw new AppError("Content not found", 404, "NOT_FOUND");
    return contentSummary(reel);
  }

  async deleteContent(userId, reelId) {
    const profile = await influencerService.getProfile(userId);
    const reel = await Reel.findOneAndDelete({ _id: reelId, influencerId: profile._id }).lean();
    if (!reel) throw new AppError("Content not found", 404, "NOT_FOUND");

    await Promise.all([
      deleteLocalReelAsset(reel.videoUrl),
      deleteLocalReelAsset(reel.thumbnailUrl),
    ]);

    if (reel.campaignId) {
      await Campaign.updateOne(
        { _id: reel.campaignId, "deliverables.contentId": reel._id },
        {
          $set: {
            "deliverables.$.status": "draft",
            "deliverables.$.contentId": null,
            "deliverables.$.notes": "Content deleted by influencer",
          },
        }
      );
    }

    return { id: reel._id, deleted: true };
  }

  async getContentAnalytics(userId, query = {}) {
    const profile = await influencerService.getProfile(userId);
    const filter = buildContentFilter(profile._id, query);
    const items = await Reel.find(filter).lean();
    const totals = items.reduce((acc, row) => {
      const metrics = row.metrics || {};
      acc.views += Number(metrics.views || 0);
      acc.uniqueViews += Number(metrics.uniqueViews || 0);
      acc.clicks += Number(metrics.clicks || 0);
      acc.orders += Number(metrics.orders || 0);
      acc.watchTimeSeconds += Number(metrics.watchTimeSeconds || 0);
      acc.revenue += Number(metrics.revenue || 0);
      acc.commission += Number(metrics.commission || 0);
      acc.likes += Number(metrics.likes || 0);
      acc.comments += Number(metrics.comments || 0);
      acc.shares += Number(metrics.shares || 0);
      return acc;
    }, { views: 0, uniqueViews: 0, clicks: 0, orders: 0, watchTimeSeconds: 0, revenue: 0, commission: 0, likes: 0, comments: 0, shares: 0 });
    const commissionRows = await CommissionRecord.aggregate([
      { $match: { influencerId: profile._id } },
      { $group: { _id: "$reelId", revenue: { $sum: "$gross" }, commission: { $sum: "$influencerShare" }, orders: { $sum: 1 } } },
    ]);
    const moneyByReel = new Map(commissionRows.map((row) => [String(row._id), row]));
    const topVideos = items.map((item) => {
      const money = moneyByReel.get(String(item._id)) || {};
      return contentSummary({
        ...item,
        metrics: {
          ...(item.metrics || {}),
          revenue: Number(item.metrics?.revenue || money.revenue || 0),
          commission: Number(item.metrics?.commission || money.commission || 0),
          orders: Number(item.metrics?.orders || money.orders || 0),
        },
      });
    }).sort((a, b) => Number(b.metrics?.views || 0) - Number(a.metrics?.views || 0)).slice(0, 10);
    totals.engagementRate = totals.views ? Number((((totals.likes + totals.comments + totals.shares) / totals.views) * 100).toFixed(2)) : 0;
    totals.ctr = totals.views ? Number(((totals.clicks / totals.views) * 100).toFixed(2)) : 0;
    totals.conversionRate = totals.clicks ? Number(((totals.orders / totals.clicks) * 100).toFixed(2)) : 0;
    const trend = Array.from({ length: 14 }).map((_, index) => {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - (13 - index));
      return { date: date.toISOString().slice(0, 10), views: 0, revenue: 0, engagement: 0, conversion: 0 };
    });
    return { totals, topVideos, trend };
  }

  async listMediaLibrary(userId, query = {}) {
    const profile = await influencerService.getProfile(userId);
    const filter = buildContentFilter(profile._id, query);
    const items = await Reel.find(filter).select("title caption videoUrl thumbnailUrl contentType createdAt processing metrics").sort({ createdAt: -1 }).limit(100).lean();
    return {
      items: items.map((item) => ({
        id: item._id,
        name: item.title || item.caption || "Video asset",
        type: item.contentType || "video",
        preview: item.thumbnailUrl || item.videoUrl,
        url: item.videoUrl,
        size: 0,
        createdAt: item.createdAt,
        processing: item.processing,
      })),
    };
  }

  async listLiveSessions(userId, query = {}) {
    return await this.listContent(userId, { ...query, contentType: "live" });
  }

  async saveLiveSession(userId, payload = {}) {
    return await this.upload(userId, {
      ...payload,
      contentType: "live",
      videoUrl: payload.videoUrl || payload.replayUrl || "/uploads/reels/live-placeholder.mp4",
      visibility: payload.scheduledAt ? "scheduled" : "draft",
    });
  }

  async publish(actor, reelId, payload = {}) {
    const reel = await Reel.findById(reelId).populate("campaignId");
    if (!reel) throw new AppError("Reel not found", 404, "NOT_FOUND");

    if (actor.role === "influencer") {
      throw new AppError("Influencers cannot self-publish reels", 403, "FORBIDDEN");
    }

    if (actor.role === "vendor") {
      const vendor = await require("../../repositories/vendor.repository").findByUserId(actor.sub);
      if (!vendor || String(reel.campaignId?.vendorId) !== String(vendor._id)) {
        throw new AppError("Forbidden", 403, "FORBIDDEN");
      }
    }

    const action = payload.action || "publish";
    const nextState =
      action === "reject"
        ? "rejected"
        : action === "approve"
          ? "approved"
          : "published";

    const updated = await Reel.findByIdAndUpdate(
      reelId,
      {
        $set: {
          state: nextState,
          publishedAt: nextState === "published" ? new Date() : reel.publishedAt,
          "moderation.reviewerId": actor.sub,
          "moderation.reviewedAt": new Date(),
          "moderation.notes": payload.notes || "",
        },
      },
      { new: true }
    );

    if (nextState === "published") {
      await emitDomainEvent(INFLUENCER_EVENTS.REEL_PUBLISHED, {
        reelId: updated._id,
        campaignId: updated.campaignId,
        influencerId: updated.influencerId,
      });
    }

    return updated;
  }

  async getFeed({ category, tab = "for_you", search = "", page = 1, limit = 12 } = {}, userId = "") {
    const query = { visibility: "published", state: { $in: ["approved", "published"] } };
    if (tab === "live") query.contentType = "live";
    if (tab === "product") query.contentType = { $in: ["product_video", "affiliate", "review", "tutorial", "unboxing"] };
    if (tab === "campaign") query.campaignId = { $ne: null };
    if (search) {
      const re = new RegExp(cleanString(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ title: re }, { caption: re }, { description: re }, { tags: re }, { category: re }];
    }
    const pageNumber = Math.max(1, Number(page) || 1);
    const pageLimit = Math.min(Number(limit || 12), 50);
    const reels = await Reel.find(query)
      .populate({ path: "productIds", select: "name price discountPrice images thumbnail category rating averageRating sellerId" })
      .populate({
        path: "campaignId",
        populate: [
          { path: "productIds", select: "name price discountPrice images thumbnail category rating averageRating sellerId" },
          { path: "vendorId", select: "shopName companyName logoUrl" },
        ],
      })
      .populate({
        path: "influencerId",
        select: "displayName storeSlug storeName profilePicture profileImage avatarUrl categories followers verified stats",
        populate: { path: "userId", select: "name" },
      })
      .sort(tab === "trending" ? { "metrics.views": -1, "metrics.clicks": -1, publishedAt: -1 } : { publishedAt: -1 })
      .skip((pageNumber - 1) * pageLimit)
      .limit(pageLimit)
      .lean();

    const filtered = category
      ? reels.filter((reel) =>
          (reel.campaignId?.productIds || []).some((product) => String(product?.category || "").toLowerCase() === String(category).toLowerCase())
        )
      : reels;

    const influencerIds = Array.from(new Set(filtered.map((reel) => idOf(reel.influencerId)).filter(Boolean)));
    const affiliateRows = influencerIds.length
      ? await InfluencerAffiliateSetting.find({ influencerId: { $in: influencerIds }, status: "active" }).select("influencerId trackingCode").lean()
      : [];
    const affiliateCodeByInfluencer = new Map(affiliateRows.map((row) => [idOf(row.influencerId), row.trackingCode]));
    const followedRows = userId && influencerIds.length
      ? await InfluencerFollower.find({ influencerId: { $in: influencerIds }, customerId: userId }).select("influencerId").lean()
      : [];
    const followedInfluencers = new Set(followedRows.map((row) => idOf(row.influencerId)));
    const engagementByReel = await this.buildEngagementState(filtered.map((reel) => reel._id), userId);

    return {
      items: filtered.map((reel) => {
        const tagged = [...(reel.productIds || []), ...(reel.campaignId?.productIds || [])];
        const seen = new Set();
        const products = tagged.filter((product) => {
          const id = idOf(product);
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        return this.mergeEngagement({
          ...reel,
          influencerId: reel.influencerId ? {
            ...reel.influencerId,
            isFollowing: followedInfluencers.has(idOf(reel.influencerId)),
          } : reel.influencerId,
          products,
          affiliateTrackingCode: affiliateCodeByInfluencer.get(idOf(reel.influencerId)) || "",
          campaignBadge: reel.campaignId ? reel.campaignId.title || "Campaign" : "",
          brandName: reel.campaignId?.vendorId?.shopName || reel.campaignId?.vendorId?.companyName || "",
          sponsored: Boolean(reel.campaignId),
          videoUrl: resolveApiAssetUrl(reel.videoUrl),
        }, engagementByReel.get(idOf(reel)));
      }),
      page: pageNumber,
      limit: pageLimit,
      hasMore: reels.length === pageLimit,
    };
  }

  async getById(reelId, userId = "") {
    const reel = await Reel.findById(reelId)
      .populate({
        path: "campaignId",
        populate: { path: "productIds", select: "name price discountPrice images category sellerId" },
      })
      .populate({
        path: "influencerId",
        select: "displayName storeSlug storeName profilePicture profileImage avatarUrl categories followers verified stats",
        populate: { path: "userId", select: "name" },
      });
    if (!reel) throw new AppError("Reel not found", 404, "NOT_FOUND");
    if (reel.visibility !== "published" || !["approved", "published"].includes(reel.state)) {
      throw new AppError("Reel not found", 404, "NOT_FOUND");
    }
    const influencerId = reel.influencerId?._id || reel.influencerId;
    const [affiliate, followRow] = await Promise.all([
      InfluencerAffiliateSetting.findOne({ influencerId, status: "active" }).select("trackingCode").lean(),
      userId ? InfluencerFollower.exists({ influencerId, customerId: userId }) : null,
    ]);
    const row = reel.toObject ? reel.toObject() : reel;
    const engagementByReel = await this.buildEngagementState([row._id], userId);
    return this.mergeEngagement({
      ...row,
      influencerId: row.influencerId ? {
        ...row.influencerId,
        isFollowing: Boolean(followRow),
      } : row.influencerId,
      affiliateTrackingCode: affiliate?.trackingCode || "",
    }, engagementByReel.get(idOf(row)));
  }

  async getEngagement(reelId, userId = "") {
    await getPublishedReel(reelId);
    const state = await this.buildEngagementState([reelId], userId);
    return state.get(String(reelId)) || { counts: {}, viewer: { liked: false, saved: false } };
  }

  async toggleLike(userId, reelId) {
    const reel = await getPublishedReel(reelId);
    const existing = await ReelLike.findOne({ reelId, userId }).lean();
    const delta = existing ? -1 : 1;
    if (existing) await ReelLike.deleteOne({ _id: existing._id });
    else await ReelLike.create({ reelId, userId, influencerId: reel.influencerId });
    await Promise.all([
      Reel.updateOne({ _id: reelId }, { $inc: { "metrics.likes": delta } }),
      incrementAnalytics({ reel, metric: "likes", amount: delta, metadata: { eventType: "reel_like", userId } }),
      emitDomainEvent("reel.liked", { reelId, influencerId: reel.influencerId, userId, active: !existing }).catch(() => null),
    ]);
    return { liked: !existing, ...(await this.getEngagement(reelId, userId)) };
  }

  async toggleSave(userId, reelId, payload = {}) {
    const reel = await getPublishedReel(reelId);
    const existing = await ReelSave.findOne({ reelId, userId }).lean();
    const delta = existing ? -1 : 1;
    if (existing) await ReelSave.deleteOne({ _id: existing._id });
    else await ReelSave.create({ reelId, userId, influencerId: reel.influencerId, collectionName: cleanString(payload.collectionName) || "Saved reels" });
    await Promise.all([
      Reel.updateOne({ _id: reelId }, { $inc: { "metrics.bookmarks": delta } }),
      incrementAnalytics({ reel, metric: "saves", amount: delta, metadata: { eventType: "reel_save", userId } }),
    ]);
    return { saved: !existing, ...(await this.getEngagement(reelId, userId)) };
  }

  async listComments(reelId, query = {}, userId = "") {
    await getPublishedReel(reelId);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const [items, total] = await Promise.all([
      ReelComment.find({ reelId, status: { $ne: "deleted" } })
        .populate("userId", "name avatar email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ReelComment.countDocuments({ reelId, status: { $ne: "deleted" } }),
    ]);
    const commentIds = items.map((item) => item._id);
    const replies = commentIds.length ? await ReelCommentReply.find({ commentId: { $in: commentIds }, status: { $ne: "deleted" } })
      .populate("userId", "name avatar email")
      .sort({ createdAt: 1 })
      .limit(commentIds.length * 3)
      .lean() : [];
    const repliesByComment = replies.reduce((acc, reply) => {
      const key = idOf(reply.commentId);
      acc.set(key, [...(acc.get(key) || []), { ...reply, liked: (reply.likedBy || []).some((id) => idOf(id) === String(userId)) }]);
      return acc;
    }, new Map());
    return {
      items: items.map((comment) => ({
        ...comment,
        liked: (comment.likedBy || []).some((id) => idOf(id) === String(userId)),
        replies: repliesByComment.get(idOf(comment)) || [],
      })),
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  }

  async createComment(userId, reelId, payload = {}) {
    const reel = await getPublishedReel(reelId);
    const text = cleanString(payload.text);
    if (!text) throw new AppError("Comment text is required", 400, "VALIDATION_ERROR");
    const comment = await ReelComment.create({ reelId, userId, influencerId: reel.influencerId, text, mentions: extractMentions(text) });
    await Promise.all([
      Reel.updateOne({ _id: reelId }, { $inc: { "metrics.comments": 1 } }),
      incrementAnalytics({ reel, metric: "comments", metadata: { eventType: "reel_comment", userId, mentions: comment.mentions } }),
      emitDomainEvent("reel.commented", { reelId, influencerId: reel.influencerId, userId, commentId: comment._id }).catch(() => null),
    ]);
    return { comment: await ReelComment.findById(comment._id).populate("userId", "name avatar email").lean(), engagement: await this.getEngagement(reelId, userId) };
  }

  async createReply(userId, reelId, commentId, payload = {}) {
    const reel = await getPublishedReel(reelId);
    const parent = await ReelComment.findOne({ _id: commentId, reelId, status: { $ne: "deleted" } }).lean();
    if (!parent) throw new AppError("Comment not found", 404, "NOT_FOUND");
    const text = cleanString(payload.text);
    if (!text) throw new AppError("Reply text is required", 400, "VALIDATION_ERROR");
    const reply = await ReelCommentReply.create({ reelId, commentId, parentReplyId: payload.parentReplyId || undefined, userId, influencerId: reel.influencerId, text, mentions: extractMentions(text) });
    await Promise.all([
      ReelComment.updateOne({ _id: commentId }, { $inc: { repliesCount: 1 } }),
      incrementAnalytics({ reel, metric: "replies", metadata: { eventType: "reel_comment_reply", userId, mentions: reply.mentions } }),
      emitDomainEvent("reel.comment.replied", { reelId, influencerId: reel.influencerId, userId, commentId, replyId: reply._id }).catch(() => null),
    ]);
    return { reply: await ReelCommentReply.findById(reply._id).populate("userId", "name avatar email").lean() };
  }

  async toggleCommentLike(userId, reelId, commentId) {
    await getPublishedReel(reelId);
    const comment = await ReelComment.findOne({ _id: commentId, reelId, status: { $ne: "deleted" } });
    if (!comment) throw new AppError("Comment not found", 404, "NOT_FOUND");
    const liked = (comment.likedBy || []).some((id) => idOf(id) === String(userId));
    if (liked) comment.likedBy.pull(userId);
    else comment.likedBy.addToSet(userId);
    comment.likesCount = Math.max(0, Number(comment.likesCount || 0) + (liked ? -1 : 1));
    await comment.save();
    return { liked: !liked, likesCount: comment.likesCount };
  }

  async reportComment(userId, reelId, commentId, payload = {}) {
    await getPublishedReel(reelId);
    const comment = await ReelComment.findOne({ _id: commentId, reelId, status: { $ne: "deleted" } });
    if (!comment) throw new AppError("Comment not found", 404, "NOT_FOUND");
    if (!(comment.reportedBy || []).some((id) => idOf(id) === String(userId))) {
      comment.reportedBy.addToSet(userId);
      comment.reportsCount = Number(comment.reportsCount || 0) + 1;
    }
    if (comment.reportsCount >= 3) comment.status = "reported";
    await comment.save();
    await emitDomainEvent("reel.comment.reported", { reelId, commentId, userId, reason: payload.reason || "" }).catch(() => null);
    return { reported: true, reportsCount: comment.reportsCount };
  }

  async shareReel(user, reelId, payload = {}) {
    const reel = await getPublishedReel(reelId);
    const destination = cleanString(payload.destination || "copy_link").toLowerCase();
    const userId = user?.sub || null;
    const anonymousId = cleanString(payload.anonymousId);
    await Promise.all([
      ReelShare.create({ reelId, userId, anonymousId, influencerId: reel.influencerId, source: cleanString(payload.source) || "reel", destination, metadata: payload.metadata || {} }),
      Reel.updateOne({ _id: reelId }, { $inc: { "metrics.shares": 1 } }),
      incrementAnalytics({ reel, metric: "shares", metadata: { eventType: "reel_share", userId, anonymousId, destination, source: payload.source || "reel" } }),
    ]);
    return { shared: true, destination, ...(await this.getEngagement(reelId, userId || "")) };
  }

  async recordView(user, reelId, payload = {}) {
    const reel = await getPublishedReel(reelId);
    const userId = user?.sub || null;
    const anonymousId = cleanString(payload.anonymousId);
    const watchTimeSeconds = Math.max(0, Number(payload.watchTimeSeconds || 0));
    await Promise.all([
      ReelView.create({ reelId, userId, anonymousId, influencerId: reel.influencerId, source: payload.source || "feed", watchTimeSeconds, completed: Boolean(payload.completed), metadata: payload.metadata || {} }),
      ReelWatchHistory.updateOne(
        userId ? { reelId, userId } : { reelId, anonymousId },
        { $set: { influencerId: reel.influencerId, lastWatchedAt: new Date(), progressPercent: Math.max(0, Math.min(100, Number(payload.progressPercent || 0))), metadata: payload.metadata || {} }, $inc: { watchTimeSeconds } },
        { upsert: true }
      ),
      Reel.updateOne({ _id: reelId }, { $inc: { "metrics.views": 1, "metrics.watchTimeSeconds": watchTimeSeconds } }),
      InfluencerProfile.updateOne({ _id: reel.influencerId }, { $inc: { "stats.views": 1 } }),
      incrementAnalytics({ reel, metric: "views", metadata: { eventType: "reel_view", userId, anonymousId, source: payload.source || "feed" } }),
      watchTimeSeconds ? incrementAnalytics({ reel, metric: "watchTimeSeconds", amount: watchTimeSeconds, metadata: {} }) : Promise.resolve(),
    ]);
    return { tracked: true };
  }

  async recordStoreVisit(user, reelId, payload = {}) {
    const reel = await getPublishedReel(reelId);
    const userId = user?.sub || null;
    const anonymousId = cleanString(payload.anonymousId);
    await Promise.all([
      ReelStoreVisit.create({ reelId, influencerId: reel.influencerId, userId, anonymousId, source: payload.source || "reel_creator_panel", metadata: payload.metadata || {} }),
      InfluencerStorefrontEvent.create({ influencerId: reel.influencerId, userId, anonymousId, eventType: "storefront_view", surface: "reel", reelId, metadata: payload.metadata || {} }).catch(() => null),
      incrementAnalytics({ reel, metric: "storeVisits", metadata: { eventType: "reel_store_visit", userId, anonymousId, source: payload.source || "reel_creator_panel" } }),
    ]);
    return { tracked: true };
  }

  async recordProductClick(user, reelId, payload = {}) {
    const reel = await getPublishedReel(reelId);
    const productId = payload.productId;
    if (!productId) throw new AppError("productId is required", 400, "VALIDATION_ERROR");
    const windowDays = attributionWindowDays(payload.attributionWindowDays);
    const tracking = await trackingService.click({
      user,
      reelId,
      productId,
      anonymousId: payload.anonymousId || "",
      surface: payload.source || "reel",
    });
    const expiresAt = new Date(Date.now() + windowDays * 24 * 60 * 60 * 1000);
    const click = await AffiliateClick.create({
      reelId,
      productId,
      campaignId: reel.campaignId || undefined,
      influencerId: reel.influencerId,
      userId: user?.sub || null,
      anonymousId: tracking.anonymousId || payload.anonymousId || "",
      trackingTokenId: tracking.session?.trackingTokenId || "",
      sourceType: "reel",
      source: payload.source || "product_click",
      attributionWindowDays: windowDays,
      metadata: payload.metadata || {},
    });
    await Promise.all([
      ReelProductClick.create({
        reelId,
        productId,
        campaignId: reel.campaignId || undefined,
        influencerId: reel.influencerId,
        userId: user?.sub || null,
        anonymousId: tracking.anonymousId || payload.anonymousId || "",
        source: payload.source || "reel_product_card",
        trackingTokenId: tracking.session?.trackingTokenId || "",
        attributionWindowDays: windowDays,
        metadata: payload.metadata || {},
      }),
      AffiliateAttribution.create({
        affiliateClickId: click._id,
        influencerId: reel.influencerId,
        productId,
        campaignId: reel.campaignId || undefined,
        userId: user?.sub || null,
        anonymousId: tracking.anonymousId || payload.anonymousId || "",
        expiresAt,
        metadata: { reelId, source: payload.source || "reel_product_card" },
      }),
      incrementAnalytics({ reel, metric: "productClicks", productId, metadata: { eventType: "reel_product_click", userId: user?.sub || null, anonymousId: tracking.anonymousId || payload.anonymousId || "", source: payload.source || "reel_product_card" } }),
    ]);
    return { ...tracking, attributionWindowDays: windowDays, affiliateClickId: click._id };
  }

  async followCreator(userId, reelId, payload = {}) {
    const reel = await getPublishedReel(reelId);
    const influencerId = reel.influencerId;
    const existing = await CreatorFollower.findOne({ influencerId, customerId: userId }).lean();
    const shouldFollow = payload.following !== undefined ? Boolean(payload.following) : !existing;
    if (shouldFollow && !existing) {
      await Promise.all([
        CreatorFollower.create({ influencerId, customerId: userId, source: payload.source || "reel" }),
        CreatorFollow.updateOne({ influencerId, customerId: userId }, { $set: { source: payload.source || "reel", status: "active", followedAt: new Date() }, $unset: { unfollowedAt: "" } }, { upsert: true }),
        InfluencerFollower.updateOne({ influencerId, customerId: userId }, { $set: { source: payload.source || "reel", notificationEnabled: true, followedAt: new Date() } }, { upsert: true }),
        InfluencerProfile.updateOne({ _id: influencerId }, { $inc: { followers: 1 } }),
        incrementAnalytics({ reel, metric: "follows", metadata: { eventType: "creator_follow", userId, source: payload.source || "reel" } }),
        emitDomainEvent("creator.followed", { influencerId, userId, reelId }).catch(() => null),
      ]);
    }
    if (!shouldFollow && existing) {
      await Promise.all([
        CreatorFollower.deleteOne({ influencerId, customerId: userId }),
        CreatorFollow.updateOne({ influencerId, customerId: userId }, { $set: { status: "unfollowed", unfollowedAt: new Date() } }),
        InfluencerFollower.deleteOne({ influencerId, customerId: userId }),
        InfluencerProfile.updateOne({ _id: influencerId }, { $inc: { followers: -1 } }),
        emitDomainEvent("creator.unfollowed", { influencerId, userId, reelId }).catch(() => null),
      ]);
    }
    const profile = await InfluencerProfile.findById(influencerId).select("followers").lean();
    return { following: shouldFollow, followers: Math.max(0, Number(profile?.followers || 0)) };
  }

  async getAdjacent(reelId) {
    const current = await Reel.findOne({
      _id: reelId,
      visibility: "published",
      state: { $in: ["approved", "published"] },
    }).select("_id publishedAt createdAt").lean();
    if (!current) throw new AppError("Reel not found", 404, "NOT_FOUND");

    const orderField = current.publishedAt ? "publishedAt" : "createdAt";
    const anchor = current[orderField] || current.createdAt;
    const publicFilter = {
      visibility: "published",
      state: { $in: ["approved", "published"] },
    };
    const previous = await Reel.findOne({
      ...publicFilter,
      _id: { $ne: current._id },
      [orderField]: { $gt: anchor },
    }).select("_id").sort({ [orderField]: 1 }).lean();
    const next = await Reel.findOne({
      ...publicFilter,
      _id: { $ne: current._id },
      [orderField]: { $lt: anchor },
    }).select("_id").sort({ [orderField]: -1 }).lean();

    return {
      previous: previous ? { _id: previous._id } : null,
      next: next ? { _id: next._id } : null,
    };
  }

  async listForInfluencer(userId) {
    const profile = await influencerService.getProfile(userId);
    return await Reel.find({ influencerId: profile._id }).populate("campaignId", "state").sort({ createdAt: -1 });
  }

  async listForInfluencerPaginated(userId, query = {}) {
    const profile = await influencerService.getProfile(userId);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 12));
    const skip = (page - 1) * limit;

    const filter = { influencerId: profile._id };
    if (query.state) {
      filter.state = query.state;
    }

    const [items, total] = await Promise.all([
      Reel.find(filter)
        .populate({
          path: "campaignId",
          select: "state commissionPercent",
          populate: { path: "vendorId", select: "shopName companyName" },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Reel.countDocuments(filter),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async listAll() {
    return await Reel.find({})
      .populate("campaignId", "state")
      .populate({ path: "influencerId", populate: { path: "userId", select: "name email" } })
      .sort({ createdAt: -1 });
  }
}

module.exports = new ReelService();
