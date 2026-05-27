const { AppError } = require("../../utils/AppError");
const fs = require("fs/promises");
const path = require("path");
const { resolveApiAssetUrl } = { resolveApiAssetUrl: (value) => value };
const influencerService = require("../influencer/service");
const { InfluencerAffiliateSetting } = require("../influencer/model");
const { Campaign } = require("../campaign/model");
const { emitDomainEvent } = require("../events/event-bus");
const { INFLUENCER_EVENTS } = require("../shared/constants");
const { Reel } = require("./model");
const { CommissionRecord } = require("../commission/models");
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

class ReelService {
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

  async getFeed({ category, tab = "for_you", search = "", page = 1, limit = 12 } = {}) {
    const query = { state: "published" };
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
        select: "username profileImage avatarUrl categories followers verified stats",
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
        return {
          ...reel,
          products,
          affiliateTrackingCode: affiliateCodeByInfluencer.get(idOf(reel.influencerId)) || "",
          campaignBadge: reel.campaignId ? reel.campaignId.title || "Campaign" : "",
          brandName: reel.campaignId?.vendorId?.shopName || reel.campaignId?.vendorId?.companyName || "",
          sponsored: Boolean(reel.campaignId),
          videoUrl: resolveApiAssetUrl(reel.videoUrl),
        };
      }),
      page: pageNumber,
      limit: pageLimit,
      hasMore: reels.length === pageLimit,
    };
  }

  async getById(reelId) {
    const reel = await Reel.findById(reelId)
      .populate({
        path: "campaignId",
        populate: { path: "productIds", select: "name price discountPrice images category sellerId" },
      })
      .populate({
        path: "influencerId",
        select: "username profileImage avatarUrl categories followers verified stats",
        populate: { path: "userId", select: "name" },
      });
    if (!reel) throw new AppError("Reel not found", 404, "NOT_FOUND");
    const affiliate = await InfluencerAffiliateSetting.findOne({ influencerId: reel.influencerId?._id || reel.influencerId, status: "active" }).select("trackingCode").lean();
    const row = reel.toObject ? reel.toObject() : reel;
    return {
      ...row,
      affiliateTrackingCode: affiliate?.trackingCode || "",
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
