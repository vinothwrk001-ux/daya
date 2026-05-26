const { AppError } = require("../../utils/AppError");
const vendorRepo = require("../../repositories/vendor.repository");
const productRepo = require("../../repositories/product.repository");
const influencerService = require("../influencer/service");
const { emitDomainEvent } = require("../events/event-bus");
const { INFLUENCER_EVENTS } = require("../shared/constants");
const { CommissionRecord } = require("../commission/models");
const { Campaign } = require("./model");

async function ensureVendorOwnsProducts(vendorId, productIds = []) {
  const products = await Promise.all(productIds.map((productId) => productRepo.findById(productId)));
  if (products.some((product) => !product)) {
    throw new AppError("One or more campaign products were not found", 404, "NOT_FOUND");
  }
  const invalid = products.find((product) => String(product.sellerId) !== String(vendorId));
  if (invalid) {
    throw new AppError("Campaign products must belong to the vendor", 403, "FORBIDDEN");
  }
}

function pushHistory(state, actorId, note = "") {
  return {
    state,
    actorId,
    note,
    changedAt: new Date(),
  };
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toPage(value, fallback = 1) {
  return Math.max(1, Math.floor(toNumber(value, fallback)));
}

function toLimit(value, fallback = 12) {
  return Math.min(50, Math.max(1, Math.floor(toNumber(value, fallback))));
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function vendorName(vendor = {}) {
  return vendor?.shopName || vendor?.companyName || vendor?.name || "Brand";
}

function productImage(product = {}) {
  return product?.thumbnail || product?.images?.find((image) => image?.isPrimary)?.url || product?.images?.[0]?.url || "";
}

function getApplication(campaign, profileId) {
  return (campaign.applications || []).find((application) => String(application.influencerId) === String(profileId));
}

function presentCampaign(campaign, profileId) {
  const application = profileId ? getApplication(campaign, profileId) : null;
  const products = (campaign.productIds || []).map((product) => ({
    id: product?._id,
    name: product?.name || "Product",
    image: productImage(product),
    category: product?.category || "",
    price: Number(product?.discountPrice || product?.price || 0),
  }));
  const clicks = Number(campaign.analytics?.clicks || 0);
  const orders = Number(campaign.analytics?.orders || 0);
  return {
    id: campaign._id,
    _id: campaign._id,
    title: campaign.title || `${vendorName(campaign.vendorId)} campaign`,
    description: campaign.description || "",
    banner: campaign.banner || products[0]?.image || "",
    brandName: vendorName(campaign.vendorId),
    vendorId: campaign.vendorId,
    campaignType: campaign.campaignType || "affiliate",
    category: campaign.category || products[0]?.category || "General",
    country: campaign.country || "",
    language: campaign.language || "en",
    budget: Number(campaign.fixedFee || 0),
    fixedFee: Number(campaign.fixedFee || 0),
    commissionType: Number(campaign.fixedFee || 0) > 0 ? "hybrid" : "percentage",
    commissionRate: Number(campaign.commissionPercent || 0),
    commissionPercent: Number(campaign.commissionPercent || 0),
    productIds: products,
    products,
    state: campaign.state,
    status: application?.status || campaign.state,
    applicationStatus: application?.status || (String(campaign.influencerId || "") === String(profileId || "") ? campaign.state : ""),
    applicationDate: application?.submittedAt || null,
    expectedEarnings: Number(application?.expectedEarnings || campaign.fixedFee || 0),
    applicationDeadline: campaign.marketplace?.applicationDeadline || campaign.deadline || null,
    deadline: campaign.deadline || campaign.marketplace?.applicationDeadline || null,
    availableSlots: Number(campaign.marketplace?.availableSlots || 0),
    requiredDeliverables: campaign.marketplace?.requiredDeliverables || [],
    requirements: campaign.marketplace?.requirements || {},
    saved: Boolean((campaign.marketplace?.savedBy || []).some((id) => String(id) === String(profileId))),
    analytics: {
      views: Number(campaign.analytics?.views || 0),
      clicks,
      orders,
      revenue: Number(campaign.analytics?.revenue || 0),
      commission: Number(campaign.analytics?.commission || 0),
      ctr: clicks ? Number(((orders / clicks) * 100).toFixed(2)) : 0,
      conversionRate: clicks ? Number(((orders / clicks) * 100).toFixed(2)) : 0,
      engagement: Number(campaign.analytics?.engagement || 0),
    },
    deliverables: (campaign.deliverables || []).filter((item) => !profileId || String(item.influencerId) === String(profileId)),
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
}

function buildMarketplaceQuery(profileId, query = {}) {
  const tab = String(query.tab || "available").toLowerCase();
  const and = [];
  const scope = {
    $or: [
      { "marketplace.public": true },
      { influencerId: profileId },
      { "applications.influencerId": profileId },
    ],
  };
  and.push(scope);

  if (tab === "available" || tab === "recommended") {
    and.push({ state: { $nin: ["completed", "cancelled"] } });
    and.push({ applications: { $not: { $elemMatch: { influencerId: profileId } } } });
  }
  if (tab === "applied") {
    and.push({ "applications.influencerId": profileId });
  }
  if (tab === "active") {
    and.push({
      $or: [
        { state: "active", influencerId: profileId },
        { state: "active", applications: { $elemMatch: { influencerId: profileId, status: "approved" } } },
      ],
    });
  }
  if (tab === "completed") {
    and.push({
      state: "completed",
      $or: [{ influencerId: profileId }, { "applications.influencerId": profileId }],
    });
  }

  if (query.category) and.push({ category: String(query.category) });
  if (query.campaignType) and.push({ campaignType: String(query.campaignType) });
  if (query.country) and.push({ country: String(query.country) });
  if (query.language) and.push({ language: String(query.language) });
  if (query.minBudget || query.maxBudget) {
    const fixedFee = {};
    if (query.minBudget) fixedFee.$gte = toNumber(query.minBudget);
    if (query.maxBudget) fixedFee.$lte = toNumber(query.maxBudget);
    and.push({ fixedFee });
  }
  if (query.search) {
    const search = new RegExp(escapeRegex(query.search), "i");
    and.push({ $or: [{ title: search }, { description: search }, { category: search }] });
  }

  return and.length ? { $and: and } : {};
}

function marketplaceSort(sort = "") {
  if (sort === "highest_budget") return { fixedFee: -1, createdAt: -1 };
  if (sort === "highest_commission") return { commissionPercent: -1, fixedFee: -1 };
  if (sort === "ending_soon") return { "marketplace.applicationDeadline": 1, deadline: 1 };
  if (sort === "trending" || sort === "recommended") return { "analytics.revenue": -1, "analytics.clicks": -1, createdAt: -1 };
  return { createdAt: -1 };
}

class CampaignService {
  async create(userId, payload = {}) {
    const vendor = await vendorRepo.findByUserId(userId);
    if (!vendor) throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
    const influencer = await influencerService.getProfileById(payload.influencerId);

    await ensureVendorOwnsProducts(vendor._id, payload.productIds);

    return await Campaign.create({
      vendorId: vendor._id,
      influencerId: influencer._id,
      title: payload.title || "",
      description: payload.description || "",
      banner: payload.banner || "",
      campaignType: payload.campaignType || "affiliate",
      category: payload.category || "",
      country: payload.country || "",
      language: payload.language || "en",
      marketplace: {
        public: Boolean(payload.marketplace?.public),
        applicationDeadline: payload.marketplace?.applicationDeadline || payload.deadline,
        availableSlots: payload.marketplace?.availableSlots || 1,
        requiredDeliverables: payload.marketplace?.requiredDeliverables || [],
        requirements: payload.marketplace?.requirements || {},
        assets: payload.marketplace?.assets || [],
      },
      productIds: payload.productIds,
      commissionPercent: payload.commissionPercent,
      fixedFee: payload.fixedFee || 0,
      deadline: payload.deadline,
      state: "proposed",
      history: [pushHistory("proposed", userId, "Campaign proposed by vendor")],
    });
  }

  async accept(userId, campaignId) {
    const profile = await influencerService.getProfile(userId);
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new AppError("Campaign not found", 404, "NOT_FOUND");
    if (String(campaign.influencerId) !== String(profile._id)) {
      throw new AppError("Forbidden", 403, "FORBIDDEN");
    }
    if (!["proposed", "accepted"].includes(campaign.state)) {
      throw new AppError("Campaign cannot be accepted in the current state", 400, "INVALID_STATE");
    }

    const state = "active";
    const updated = await Campaign.findByIdAndUpdate(
      campaignId,
      {
        $set: {
          state,
          termsFrozen: {
            commissionPercent: campaign.commissionPercent,
            fixedFee: campaign.fixedFee,
            productIds: campaign.productIds,
            deadline: campaign.deadline,
            frozenAt: new Date(),
          },
        },
        $push: {
          history: {
            $each: [pushHistory("accepted", userId, "Influencer accepted"), pushHistory(state, userId, "Campaign activated")],
          },
        },
      },
      { new: true }
    );

    await emitDomainEvent(INFLUENCER_EVENTS.CAMPAIGN_ACTIVATED, {
      campaignId: updated._id,
      influencerId: updated.influencerId,
      vendorId: updated.vendorId,
    });

    return updated;
  }

  async reject(userId, campaignId, note = "") {
    const profile = await influencerService.getProfile(userId);
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new AppError("Campaign not found", 404, "NOT_FOUND");
    if (String(campaign.influencerId) !== String(profile._id)) {
      throw new AppError("Forbidden", 403, "FORBIDDEN");
    }
    if (!["proposed"].includes(campaign.state)) {
      throw new AppError("Only proposed campaigns can be declined", 400, "INVALID_STATE");
    }

    return await Campaign.findByIdAndUpdate(
      campaignId,
      {
        $set: { state: "cancelled" },
        $push: {
          history: {
            $each: [pushHistory("cancelled", userId, note || "Influencer declined the proposal")],
          },
        },
      },
      { new: true }
    );
  }

  async listForVendor(userId) {
    const vendor = await vendorRepo.findByUserId(userId);
    if (!vendor) throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
    return await Campaign.find({ vendorId: vendor._id })
      .populate({ path: "influencerId", populate: { path: "userId", select: "name email phone" } })
      .populate("productIds", "name")
      .sort({ createdAt: -1 });
  }

  async listForInfluencer(userId) {
    const profile = await influencerService.getProfile(userId);
    return await Campaign.find({ $or: [{ influencerId: profile._id }, { "applications.influencerId": profile._id }] })
      .populate("productIds", "name")
      .populate("vendorId", "shopName companyName")
      .sort({ createdAt: -1 });
  }

  async listMarketplace(userId, query = {}) {
    const profile = await influencerService.getProfile(userId);
    const page = toPage(query.page);
    const limit = toLimit(query.limit);
    const skip = (page - 1) * limit;
    const tab = String(query.tab || "available").toLowerCase();
    const filter = buildMarketplaceQuery(profile._id, { ...query, tab });

    const [items, total] = await Promise.all([
      Campaign.find(filter)
        .populate("productIds", "name category price discountPrice images thumbnail")
        .populate("vendorId", "shopName companyName logoUrl")
        .sort(marketplaceSort(query.sort || tab))
        .skip(skip)
        .limit(limit)
        .lean(),
      Campaign.countDocuments(filter),
    ]);

    const rows = items.map((item) => {
      const row = presentCampaign(item, profile._id);
      if (tab === "recommended") {
        const categoryMatch = profile.categories?.some((category) => String(category).toLowerCase() === String(row.category).toLowerCase());
        row.recommendationScore = Math.min(98, Math.round(58 + row.commissionRate * 0.8 + (categoryMatch ? 18 : 0) + row.analytics.conversionRate));
        row.matchPercentage = row.recommendationScore;
        row.successProbability = Math.min(95, Math.round(row.recommendationScore * 0.82));
      }
      return row;
    });

    return {
      items: rows,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async apply(userId, campaignId, payload = {}) {
    const profile = await influencerService.getProfile(userId);
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new AppError("Campaign not found", 404, "NOT_FOUND");
    if (["completed", "cancelled"].includes(campaign.state)) {
      throw new AppError("Campaign is not open for applications", 400, "INVALID_STATE");
    }

    const existing = campaign.applications.find((application) => String(application.influencerId) === String(profile._id));
    const application = {
      influencerId: profile._id,
      status: "submitted",
      profileSummary: payload.profileSummary || profile.bio || "",
      audienceStats: payload.audienceStats || {},
      portfolio: payload.portfolio || "",
      attachments: payload.attachments || [],
      expectedEarnings: toNumber(payload.expectedEarnings, campaign.fixedFee || 0),
      submittedAt: new Date(),
    };

    if (existing) {
      Object.assign(existing, application);
    } else {
      campaign.applications.push(application);
    }
    campaign.history.push(pushHistory("submitted", userId, "Influencer applied to campaign"));
    await campaign.save();
    return presentCampaign(await Campaign.findById(campaign._id).populate("productIds", "name category price discountPrice images thumbnail").populate("vendorId", "shopName companyName logoUrl").lean(), profile._id);
  }

  async saveMarketplaceCampaign(userId, campaignId, saved = true) {
    const profile = await influencerService.getProfile(userId);
    const update = saved
      ? { $addToSet: { "marketplace.savedBy": profile._id } }
      : { $pull: { "marketplace.savedBy": profile._id } };
    const campaign = await Campaign.findByIdAndUpdate(campaignId, update, { new: true })
      .populate("productIds", "name category price discountPrice images thumbnail")
      .populate("vendorId", "shopName companyName logoUrl")
      .lean();
    if (!campaign) throw new AppError("Campaign not found", 404, "NOT_FOUND");
    return presentCampaign(campaign, profile._id);
  }

  async submitDeliverable(userId, campaignId, payload = {}) {
    const profile = await influencerService.getProfile(userId);
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new AppError("Campaign not found", 404, "NOT_FOUND");
    const allowed =
      String(campaign.influencerId || "") === String(profile._id) ||
      campaign.applications.some((application) => String(application.influencerId) === String(profile._id) && ["approved", "shortlisted", "submitted"].includes(application.status));
    if (!allowed) throw new AppError("Apply to the campaign before submitting deliverables", 403, "FORBIDDEN");

    campaign.deliverables.push({
      influencerId: profile._id,
      type: payload.type || "video",
      title: payload.title || "",
      dueDate: payload.dueDate || undefined,
      contentId: payload.contentId || undefined,
      status: "submitted",
      notes: payload.notes || "",
      submittedAt: new Date(),
    });
    campaign.history.push(pushHistory("submitted", userId, "Campaign deliverable submitted"));
    await campaign.save();
    return presentCampaign(await Campaign.findById(campaign._id).populate("productIds", "name category price discountPrice images thumbnail").populate("vendorId", "shopName companyName logoUrl").lean(), profile._id);
  }

  async marketplaceAnalytics(userId, query = {}) {
    const profile = await influencerService.getProfile(userId);
    const campaigns = await Campaign.find({
      $or: [{ influencerId: profile._id }, { "applications.influencerId": profile._id }],
    })
      .select("_id title vendorId campaignType category analytics state createdAt")
      .populate("vendorId", "shopName companyName")
      .lean();
    const campaignIds = campaigns.map((campaign) => campaign._id);
    const records = campaignIds.length
      ? await CommissionRecord.find({ influencerId: profile._id, campaignId: { $in: campaignIds } }).lean()
      : [];
    const byCampaign = records.reduce((map, record) => {
      const key = String(record.campaignId);
      const current = map.get(key) || { revenue: 0, commission: 0, orders: 0 };
      current.revenue += Number(record.gross || 0);
      current.commission += Number(record.influencerShare || 0);
      current.orders += 1;
      map.set(key, current);
      return map;
    }, new Map());

    const rows = campaigns.map((campaign) => {
      const earned = byCampaign.get(String(campaign._id)) || {};
      const clicks = Number(campaign.analytics?.clicks || 0);
      const orders = Number(earned.orders || campaign.analytics?.orders || 0);
      return {
        id: campaign._id,
        title: campaign.title || `${vendorName(campaign.vendorId)} campaign`,
        brandName: vendorName(campaign.vendorId),
        campaignType: campaign.campaignType,
        category: campaign.category,
        state: campaign.state,
        clicks,
        orders,
        revenue: Number(earned.revenue || campaign.analytics?.revenue || 0),
        commission: Number(earned.commission || campaign.analytics?.commission || 0),
        conversionRate: clicks ? Number(((orders / clicks) * 100).toFixed(2)) : 0,
        createdAt: campaign.createdAt,
      };
    });

    const totals = rows.reduce(
      (sum, row) => ({
        revenue: sum.revenue + row.revenue,
        commission: sum.commission + row.commission,
        orders: sum.orders + row.orders,
        clicks: sum.clicks + row.clicks,
      }),
      { revenue: 0, commission: 0, orders: 0, clicks: 0 }
    );
    totals.conversionRate = totals.clicks ? Number(((totals.orders / totals.clicks) * 100).toFixed(2)) : 0;

    return {
      totals,
      rows,
      filters: {
        dateRange: query.dateRange || "30d",
      },
    };
  }

  async listAll() {
    return await Campaign.find({})
      .populate("productIds", "name")
      .populate("vendorId", "shopName companyName")
      .populate({ path: "influencerId", populate: { path: "userId", select: "name email" } })
      .sort({ createdAt: -1 });
  }
}

module.exports = new CampaignService();
