const crypto = require("crypto");
const mongoose = require("mongoose");
const { AppError } = require("../../utils/AppError");
const auditService = require("../../services/audit.service");
const vendorRepo = require("../../repositories/vendor.repository");
const productRepo = require("../../repositories/product.repository");
const influencerService = require("../influencer/service");
const influencerRateCardService = require("../../services/influencer-rate-card.service");
const influencerCommerceEngine = require("../../services/influencer-commerce-engine.service");
const { signTrackingToken, verifyTrackingToken } = require("../tracking/token");
const { Campaign } = require("../campaign/model");
const { Product } = require("../../models/Product");
const {
  FixedCampaign,
  FixedCampaignDeliverable,
  CampaignContentSubmission,
  CampaignAnalyticsEvent,
  CampaignOrderAttribution,
  FixedCampaignSetting,
  FixedCampaignAuditLog,
  FIXED_CAMPAIGN_EVENT_TYPES,
  CONTENT_TYPES,
} = require("./model");

const SETTINGS_KEY = "default";
const FIXED_ACTIVE_STATUSES = ["proposed", "accepted", "content_submitted", "changes_requested", "approved", "payment_released"];
const ORDER_EVENT_TYPES = new Set(["ORDER_COMPLETED", "ORDER_CANCELLED", "ORDER_REFUNDED"]);

function objectId(value, fieldName = "id") {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${fieldName}`, 400, "VALIDATION_ERROR");
  }
  return new mongoose.Types.ObjectId(value);
}

function maybeObjectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function money(value) {
  const number = Number(value || 0);
  return Number(number.toFixed(2));
}

function stringValue(value = "") {
  return String(value || "").trim();
}

function pageOptions(query = {}, fallback = 20) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || fallback));
  return { page, limit, skip: (page - 1) * limit };
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + Number(days || 0));
  return next;
}

function parseRange(query = {}) {
  const now = new Date();
  const start = query.startDate ? new Date(query.startDate) : addDays(now, -29);
  const end = query.endDate ? new Date(query.endDate) : now;
  return {
    start: Number.isNaN(start.getTime()) ? addDays(now, -29) : start,
    end: Number.isNaN(end.getTime()) ? now : end,
  };
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeEventType(value = "") {
  const key = String(value || "").trim().toUpperCase();
  const aliases = {
    PRODUCT_CLICKED: "PRODUCT_CLICK",
    PRODUCT_VIEWED: "PRODUCT_VIEW",
    CART_ADD: "ADD_TO_CART",
    REFUND: "ORDER_REFUNDED",
    ORDER_REFUND: "ORDER_REFUNDED",
    ORDER_CANCEL: "ORDER_CANCELLED",
  };
  const eventType = aliases[key] || key;
  if (!FIXED_CAMPAIGN_EVENT_TYPES.includes(eventType)) {
    throw new AppError("Invalid fixed campaign analytics event", 400, "INVALID_EVENT_TYPE");
  }
  return eventType;
}

function normalizeContentType(value = "") {
  const key = String(value || "campaign").trim().toLowerCase();
  const aliases = {
    reels: "reel",
    posts: "post",
    stories: "story",
    livestream: "live",
    live_stream: "live",
    campaign_product: "campaign",
  };
  const next = aliases[key] || key;
  return CONTENT_TYPES.includes(next) ? next : "other";
}

function actorFrom(userId, role) {
  return { _id: userId, role };
}

function profileName(profile = {}) {
  return profile?.displayName || profile?.userId?.name || profile?.userId?.email || "Creator";
}

function profileUsername(profile = {}) {
  return profile?.userId?.username || profile?.storeSlug || profile?.influencerCode || String(profile?._id || "").slice(-8);
}

function vendorName(vendor = {}) {
  return vendor?.shopName || vendor?.companyName || vendor?.userId?.name || "Brand";
}

function productImage(product = {}) {
  return product?.thumbnail || product?.images?.find((image) => image?.isPrimary)?.url || product?.images?.[0]?.url || "";
}

function campaignHistory(status, actorId, note = "") {
  return { status, actorId, note, changedAt: new Date() };
}

function analyticsRatios({ budget = 0, clicks = 0, orders = 0, revenue = 0 }) {
  const roas = budget ? money(revenue / budget) : 0;
  const roi = budget ? money(((revenue - budget) / budget) * 100) : 0;
  const conversionRate = clicks ? money((orders / clicks) * 100) : 0;
  const averageOrderValue = orders ? money(revenue / orders) : 0;
  return { roas, roi, conversionRate, averageOrderValue };
}

function eventCounter(eventType, saleAmount = 0) {
  const map = {
    CONTENT_VIEW: { "analytics.contentViews": 1 },
    PRODUCT_CLICK: { "analytics.productClicks": 1 },
    PRODUCT_VIEW: { "analytics.productViews": 1 },
    ADD_TO_CART: { "analytics.addToCart": 1 },
    CHECKOUT_STARTED: { "analytics.checkoutStarted": 1 },
    ORDER_COMPLETED: { "analytics.orders": 1, "analytics.revenue": money(saleAmount) },
    ORDER_CANCELLED: { "analytics.cancelledOrders": 1 },
    ORDER_REFUNDED: { "analytics.refundedOrders": 1 },
  };
  return map[eventType] || {};
}

function dedupHash(parts = []) {
  return crypto
    .createHash("sha256")
    .update(parts.map((part) => String(part || "")).join("|"))
    .digest("hex");
}

function buildEventDedupKey({ campaignId, productId, contentId, eventType, visitorId, sessionId, dedupeMinutes = 10, orderId }) {
  if (orderId) return dedupHash(["fixed_campaign_order_event", campaignId, productId, eventType, orderId]);
  const bucketMs = Math.max(1, Number(dedupeMinutes || 10)) * 60 * 1000;
  const bucket = Math.floor(Date.now() / bucketMs);
  return dedupHash(["fixed_campaign_event", campaignId, productId, contentId, eventType, visitorId, sessionId, bucket]);
}

function buildFilter(query = {}, base = {}) {
  const filter = { ...base };
  if (query.status) filter.status = query.status;
  if (query.influencerId && maybeObjectId(query.influencerId)) filter.influencerId = maybeObjectId(query.influencerId);
  if (query.productId && maybeObjectId(query.productId)) filter.productIds = maybeObjectId(query.productId);
  if (query.category) filter.category = String(query.category);
  if (query.startDate || query.endDate) {
    const { start, end } = parseRange(query);
    filter.createdAt = { $gte: start, $lte: end };
  }
  if (query.search) {
    const re = new RegExp(escapeRegex(query.search), "i");
    filter.$or = [{ title: re }, { description: re }, { category: re }];
  }
  return filter;
}

function selectedServicesFrom(payload = {}) {
  const paymentModel = payload.paymentModel || {};
  return paymentModel.selectedServices || paymentModel.services || payload.selectedServices || payload.services || [];
}

function serializeDeliverable(row = {}, campaign, status = "proposed") {
  return {
    campaignId: campaign._id,
    influencerId: campaign.influencerId,
    serviceId: row.serviceId || undefined,
    packageId: row.packageId || undefined,
    serviceType: row.serviceTypeKey || row.serviceType || "custom_service",
    serviceName: row.serviceName || row.serviceTypeKey || "Creator service",
    packageName: row.packageName || "",
    quantity: Math.max(1, Number(row.quantity || 1)),
    unitPrice: money(row.rate || row.unitPrice || 0),
    totalPrice: money(row.total || 0),
    currency: row.currency || campaign.currency || "INR",
    status,
    snapshot: row.snapshot || row,
  };
}

function presentCampaign(campaign, { deliverables = [], submissions = [] } = {}) {
  const analytics = campaign.analytics || {};
  const productClicks = Number(analytics.productClicks || 0);
  const orders = Number(analytics.orders || 0);
  const revenue = money(analytics.revenue || 0);
  const budget = money(campaign.budget || 0);
  return {
    ...campaign,
    id: campaign._id,
    budget,
    spend: money(campaign.spend || 0),
    campaignBudget: budget,
    influencerPayment: budget,
    revenueGenerated: revenue,
    revenueDoesAffectPayout: false,
    payoutBasis: "deliverables",
    analytics: {
      contentViews: Number(analytics.contentViews || 0),
      productClicks,
      productViews: Number(analytics.productViews || 0),
      addToCart: Number(analytics.addToCart || 0),
      checkoutStarted: Number(analytics.checkoutStarted || 0),
      orders,
      revenue,
      cancelledOrders: Number(analytics.cancelledOrders || 0),
      refundedOrders: Number(analytics.refundedOrders || 0),
      ...analyticsRatios({ budget, clicks: productClicks, orders, revenue }),
    },
    deliverables,
    submissions,
  };
}

class FixedCampaignService {
  async settings() {
    return FixedCampaignSetting.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $setOnInsert: { key: SETTINGS_KEY } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ).lean();
  }

  async updateSettings(actor, payload = {}) {
    const oldValue = await this.settings();
    const allowedWindow = Number(payload.attributionWindowDays || oldValue.attributionWindowDays || 30);
    if (![30, 60, 90].includes(allowedWindow)) {
      throw new AppError("Attribution window must be 30, 60, or 90 days", 400, "INVALID_ATTRIBUTION_WINDOW");
    }
    const update = {
      attributionWindowDays: allowedWindow,
      contentApprovalRules: { ...(oldValue.contentApprovalRules || {}), ...(payload.contentApprovalRules || {}) },
      deliverableTemplates: Array.isArray(payload.deliverableTemplates) ? payload.deliverableTemplates : oldValue.deliverableTemplates || [],
      analyticsSettings: { ...(oldValue.analyticsSettings || {}), ...(payload.analyticsSettings || {}) },
      campaignStatusRules: { ...(oldValue.campaignStatusRules || {}), ...(payload.campaignStatusRules || {}) },
      paymentReleaseRules: { ...(oldValue.paymentReleaseRules || {}), ...(payload.paymentReleaseRules || {}) },
      updatedBy: actor?.sub || actor?._id,
    };
    const next = await FixedCampaignSetting.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $set: update },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ).lean();
    await this.writeAudit({
      actor,
      action: "fixed_campaign.settings.update",
      oldValue,
      newValue: next,
    });
    return next;
  }

  async writeAudit({ actor, campaignId = null, action, oldValue = null, newValue = null, metadata = {} }) {
    const userId = actor?.sub || actor?._id || actor?.id || null;
    await FixedCampaignAuditLog.create({
      campaignId,
      userId,
      role: actor?.role || "",
      action,
      oldValue,
      newValue,
      metadata,
    }).catch(() => null);
    await auditService.log({
      actor,
      action,
      entityType: "FixedCampaign",
      entityId: campaignId,
      metadata: { ...metadata, oldValue, newValue },
    }).catch(() => null);
  }

  async enforceCampaignLimit(vendorId) {
    const subscription = await influencerCommerceEngine.getVendorSubscription(vendorId);
    const plan = subscription?.planId;
    if (!subscription || !plan) {
      throw new AppError("An active subscription is required to create influencer campaigns.", 403, "SUBSCRIPTION_REQUIRED");
    }
    const limit = Number(subscription?.campaignLimit ?? plan?.campaignLimit ?? -1);
    if (limit < 0) return;
    const [classicCount, fixedCount] = await Promise.all([
      Campaign.countDocuments({ vendorId, state: { $in: ["draft", "proposed", "accepted", "active"] } }),
      FixedCampaign.countDocuments({ vendorId, status: { $in: FIXED_ACTIVE_STATUSES } }),
    ]);
    if (classicCount + fixedCount >= limit) {
      throw new AppError(`Campaign limit reached for ${plan.planName}. Upgrade your plan to create more campaigns.`, 403, "CAMPAIGN_LIMIT_EXCEEDED", {
        activeCount: classicCount + fixedCount,
        limit,
        planName: plan.planName,
      });
    }
  }

  async ensureVendorProducts(vendorId, productIds = []) {
    const ids = productIds.map((id) => objectId(id, "productId"));
    if (!ids.length) throw new AppError("Fixed campaigns require at least one product", 400, "PRODUCT_REQUIRED");
    const products = await Product.find({ _id: { $in: ids } }).select("_id sellerId name category price discountPrice images thumbnail").lean();
    if (products.length !== ids.length) throw new AppError("One or more campaign products were not found", 404, "NOT_FOUND");
    const invalid = products.find((product) => String(product.sellerId) !== String(vendorId));
    if (invalid) throw new AppError("Campaign products must belong to the vendor", 403, "FORBIDDEN");
    return products;
  }

  async calculatePricing({ influencerId, payload = {}, settings = null }) {
    const selectedServices = selectedServicesFrom(payload);
    if (!Array.isArray(selectedServices) || !selectedServices.length) {
      throw new AppError("Fixed payment campaigns require selected influencer services", 400, "DELIVERABLES_REQUIRED");
    }
    const snapshot = await influencerRateCardService.buildInfluencerSnapshot(influencerId, selectedServices);
    const deliverables = snapshot.selectedServices || [];
    if (!deliverables.length) throw new AppError("No valid influencer services were selected", 400, "DELIVERABLES_REQUIRED");
    const budget = money(deliverables.reduce((sum, row) => sum + Number(row.total || 0), 0));
    if (budget <= 0) throw new AppError("Fixed campaign budget must be greater than zero", 400, "INVALID_CAMPAIGN_BUDGET");
    return {
      budget,
      currency: deliverables[0]?.currency || payload.currency || "INR",
      influencerRateSnapshot: snapshot,
      deliverables,
      settingsSnapshot: settings || await this.settings(),
    };
  }

  async preview(userId, payload = {}) {
    const vendor = await vendorRepo.findByUserId(userId);
    if (!vendor) throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
    const influencer = await influencerService.getProfileById(payload.influencerId);
    const [settings] = await Promise.all([
      this.settings(),
      this.ensureVendorProducts(vendor._id, payload.productIds || []),
    ]);
    const pricing = await this.calculatePricing({ influencerId: influencer._id, payload, settings });
    return {
      campaignBudget: pricing.budget,
      influencerEarnings: pricing.budget,
      currency: pricing.currency,
      attributionWindowDays: Number(payload.attributionWindowDays || settings.attributionWindowDays || 30),
      deliverables: pricing.deliverables,
      revenueAffectsPayout: false,
      commissionTrackingEnabled: false,
    };
  }

  async create(userId, payload = {}) {
    const vendor = await vendorRepo.findByUserId(userId);
    if (!vendor) throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
    await this.enforceCampaignLimit(vendor._id);
    const influencer = await influencerService.getProfileById(payload.influencerId);
    const settings = await this.settings();
    const attributionWindowDays = Number(payload.attributionWindowDays || settings.attributionWindowDays || 30);
    if (![30, 60, 90].includes(attributionWindowDays)) {
      throw new AppError("Attribution window must be 30, 60, or 90 days", 400, "INVALID_ATTRIBUTION_WINDOW");
    }
    const products = await this.ensureVendorProducts(vendor._id, payload.productIds || []);
    const pricing = await this.calculatePricing({ influencerId: influencer._id, payload, settings });

    const campaign = await FixedCampaign.create({
      vendorId: vendor._id,
      influencerId: influencer._id,
      productIds: products.map((product) => product._id),
      title: payload.title || "",
      description: payload.description || "",
      banner: payload.banner || "",
      category: payload.category || products[0]?.category || "",
      country: payload.country || "",
      language: payload.language || "en",
      budget: pricing.budget,
      currency: pricing.currency,
      attributionWindowDays,
      startDate: payload.startDate || undefined,
      endDate: payload.endDate || payload.deadline || undefined,
      status: "proposed",
      pricingSnapshot: {
        budget: pricing.budget,
        currency: pricing.currency,
        fixedPaymentOnly: true,
        commissionPercent: 0,
        commissionTrackingEnabled: false,
        selectedServices: pricing.deliverables,
      },
      influencerRateSnapshot: pricing.influencerRateSnapshot,
      settingsSnapshot: settings,
      history: [campaignHistory("proposed", userId, "Fixed payment campaign proposed by vendor")],
    });
    await FixedCampaignDeliverable.insertMany(pricing.deliverables.map((row) => serializeDeliverable(row, campaign)));
    await this.writeAudit({
      actor: actorFrom(userId, "vendor"),
      campaignId: campaign._id,
      action: "fixed_campaign.created",
      newValue: campaign.toObject(),
    });
    return this.getByIdForVendor(userId, campaign._id);
  }

  async getByIdForVendor(userId, campaignId) {
    const vendor = await vendorRepo.findByUserId(userId);
    if (!vendor) throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
    const campaign = await FixedCampaign.findOne({ _id: objectId(campaignId, "campaignId"), vendorId: vendor._id })
      .populate({ path: "influencerId", populate: { path: "userId", select: "name email username" } })
      .populate("productIds", "name category price discountPrice images thumbnail")
      .lean();
    if (!campaign) throw new AppError("Fixed campaign not found", 404, "NOT_FOUND");
    const [deliverables, submissions] = await Promise.all([
      FixedCampaignDeliverable.find({ campaignId: campaign._id }).sort({ createdAt: 1 }).lean(),
      CampaignContentSubmission.find({ campaignId: campaign._id }).sort({ submittedAt: -1 }).lean(),
    ]);
    return presentCampaign(campaign, { deliverables, submissions });
  }

  async listForVendor(userId, query = {}) {
    const vendor = await vendorRepo.findByUserId(userId);
    if (!vendor) throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
    const { page, limit, skip } = pageOptions(query);
    const filter = buildFilter(query, { vendorId: vendor._id });
    const [items, total] = await Promise.all([
      FixedCampaign.find(filter)
        .populate({ path: "influencerId", populate: { path: "userId", select: "name email username" } })
        .populate("productIds", "name category price discountPrice images thumbnail")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FixedCampaign.countDocuments(filter),
    ]);
    const campaignIds = items.map((campaign) => campaign._id).filter(Boolean);
    const submissions = campaignIds.length
      ? await CampaignContentSubmission.find({ campaignId: { $in: campaignIds } }).sort({ submittedAt: -1 }).lean()
      : [];
    const submissionsByCampaign = submissions.reduce((map, submission) => {
      const key = String(submission.campaignId);
      const rows = map.get(key) || [];
      rows.push(submission);
      map.set(key, rows);
      return map;
    }, new Map());
    return {
      items: items.map((campaign) => ({
        ...presentCampaign(campaign, { submissions: submissionsByCampaign.get(String(campaign._id)) || [] }),
        influencerName: profileName(campaign.influencerId),
        influencerUsername: profileUsername(campaign.influencerId),
        brandName: vendorName(vendor),
      })),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async listForInfluencer(userId, query = {}) {
    const profile = await influencerService.getProfile(userId);
    const { page, limit, skip } = pageOptions(query);
    const filter = buildFilter(query, { influencerId: profile._id });
    const [items, total] = await Promise.all([
      FixedCampaign.find(filter)
        .populate("vendorId", "shopName companyName logoUrl")
        .populate("productIds", "name category price discountPrice images thumbnail")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FixedCampaign.countDocuments(filter),
    ]);
    const campaignIds = items.map((campaign) => campaign._id).filter(Boolean);
    const submissions = campaignIds.length
      ? await CampaignContentSubmission.find({ campaignId: { $in: campaignIds }, influencerId: profile._id }).sort({ submittedAt: -1 }).lean()
      : [];
    const submissionsByCampaign = submissions.reduce((map, submission) => {
      const key = String(submission.campaignId);
      const rows = map.get(key) || [];
      rows.push(submission);
      map.set(key, rows);
      return map;
    }, new Map());
    return {
      items: items.map((campaign) => ({
        ...presentCampaign(campaign, { submissions: submissionsByCampaign.get(String(campaign._id)) || [] }),
        brandName: vendorName(campaign.vendorId),
      })),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async accept(userId, campaignId) {
    const profile = await influencerService.getProfile(userId);
    const campaign = await FixedCampaign.findOne({ _id: objectId(campaignId, "campaignId"), influencerId: profile._id });
    if (!campaign) throw new AppError("Fixed campaign not found", 404, "NOT_FOUND");
    if (campaign.status !== "proposed") {
      throw new AppError("Only proposed fixed campaigns can be accepted", 400, "INVALID_STATE");
    }
    const oldValue = campaign.toObject();
    campaign.status = "accepted";
    campaign.acceptedAt = new Date();
    campaign.history.push(campaignHistory("accepted", userId, "Influencer accepted fixed payment campaign"));
    await campaign.save();
    await FixedCampaignDeliverable.updateMany({ campaignId: campaign._id }, { $set: { status: "accepted" } });
    await this.writeAudit({
      actor: actorFrom(userId, "influencer"),
      campaignId: campaign._id,
      action: "fixed_campaign.accepted",
      oldValue,
      newValue: campaign.toObject(),
    });
    return campaign;
  }

  async reject(userId, campaignId, note = "") {
    const profile = await influencerService.getProfile(userId);
    const campaign = await FixedCampaign.findOne({ _id: objectId(campaignId, "campaignId"), influencerId: profile._id });
    if (!campaign) throw new AppError("Fixed campaign not found", 404, "NOT_FOUND");
    if (!["proposed", "accepted"].includes(campaign.status)) {
      throw new AppError("Fixed campaign cannot be rejected in the current state", 400, "INVALID_STATE");
    }
    const oldValue = campaign.toObject();
    campaign.status = "rejected";
    campaign.history.push(campaignHistory("rejected", userId, note || "Influencer rejected fixed payment campaign"));
    await campaign.save();
    await this.writeAudit({
      actor: actorFrom(userId, "influencer"),
      campaignId: campaign._id,
      action: "fixed_campaign.rejected",
      oldValue,
      newValue: campaign.toObject(),
      metadata: { note },
    });
    return campaign;
  }

  async submitContent(userId, campaignId, payload = {}) {
    const profile = await influencerService.getProfile(userId);
    const campaign = await FixedCampaign.findOne({ _id: objectId(campaignId, "campaignId"), influencerId: profile._id });
    if (!campaign) throw new AppError("Fixed campaign not found", 404, "NOT_FOUND");
    if (!["accepted", "content_submitted", "changes_requested", "approved"].includes(campaign.status)) {
      throw new AppError("Content can be submitted only after campaign acceptance", 400, "INVALID_STATE");
    }
    const productIds = Array.isArray(payload.productIds) && payload.productIds.length ? payload.productIds : campaign.productIds;
    const invalidProduct = productIds.find((id) => !campaign.productIds.some((productId) => String(productId) === String(id)));
    if (invalidProduct) throw new AppError("Submitted content references a product outside the campaign", 400, "INVALID_PRODUCT");
    const submission = await CampaignContentSubmission.create({
      campaignId: campaign._id,
      influencerId: profile._id,
      contentUrl: payload.contentUrl,
      contentType: normalizeContentType(payload.contentType),
      contentId: maybeObjectId(payload.contentId) || undefined,
      productIds: productIds.map((id) => maybeObjectId(id)).filter(Boolean),
      notes: payload.notes || "",
      status: "submitted",
      metadata: payload.metadata || {},
    });
    const oldValue = campaign.toObject();
    campaign.status = "content_submitted";
    campaign.history.push(campaignHistory("content_submitted", userId, "Influencer submitted fixed campaign content"));
    await campaign.save();
    await FixedCampaignDeliverable.updateMany({ campaignId: campaign._id, status: { $in: ["accepted", "proposed"] } }, { $set: { status: "submitted" } });
    await this.writeAudit({
      actor: actorFrom(userId, "influencer"),
      campaignId: campaign._id,
      action: "fixed_campaign.content_submitted",
      oldValue,
      newValue: campaign.toObject(),
      metadata: { submissionId: submission._id },
    });
    return submission;
  }

  async reviewContent(userId, submissionId, payload = {}) {
    const vendor = await vendorRepo.findByUserId(userId);
    if (!vendor) throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
    const submission = await CampaignContentSubmission.findById(objectId(submissionId, "submissionId"));
    if (!submission) throw new AppError("Content submission not found", 404, "NOT_FOUND");
    const campaign = await FixedCampaign.findOne({ _id: submission.campaignId, vendorId: vendor._id });
    if (!campaign) throw new AppError("Fixed campaign not found", 404, "NOT_FOUND");

    const oldValue = { campaign: campaign.toObject(), submission: submission.toObject() };
    const decision = String(payload.decision || "changes").toLowerCase();
    if (decision === "approve") {
      submission.status = "approved";
      submission.approvedAt = new Date();
      submission.requestedChanges = "";
      campaign.status = "approved";
      await FixedCampaignDeliverable.updateMany({ campaignId: campaign._id }, { $set: { status: "approved" } });
    } else if (decision === "reject") {
      submission.status = "rejected";
      campaign.status = "changes_requested";
      submission.requestedChanges = payload.note || "";
    } else {
      submission.status = "changes_requested";
      campaign.status = "changes_requested";
      submission.requestedChanges = payload.requestedChanges || payload.note || "";
    }
    submission.notes = payload.note || submission.notes || "";
    submission.reviewedAt = new Date();
    submission.reviewedBy = userId;
    campaign.history.push(campaignHistory(campaign.status, userId, `Vendor reviewed fixed campaign content: ${decision}`));
    await Promise.all([submission.save(), campaign.save()]);
    await this.writeAudit({
      actor: actorFrom(userId, "vendor"),
      campaignId: campaign._id,
      action: `fixed_campaign.content_${decision}`,
      oldValue,
      newValue: { campaign: campaign.toObject(), submission: submission.toObject() },
    });

    const settings = await this.settings();
    if (decision === "approve" && settings.paymentReleaseRules?.autoReleaseOnApproval) {
      await this.releasePayment(userId, campaign._id, { notes: "Auto-released after final content approval" });
    }
    return submission;
  }

  async releasePayment(userId, campaignId, payload = {}) {
    const vendor = await vendorRepo.findByUserId(userId);
    if (!vendor) throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
    const campaign = await FixedCampaign.findOne({ _id: objectId(campaignId, "campaignId"), vendorId: vendor._id });
    if (!campaign) throw new AppError("Fixed campaign not found", 404, "NOT_FOUND");
    if (["completed", "payment_released"].includes(campaign.status)) return campaign;
    const settings = await this.settings();
    if (settings.paymentReleaseRules?.requireAcceptedCampaign && !campaign.acceptedAt) {
      throw new AppError("Campaign must be accepted before payment release", 400, "CAMPAIGN_NOT_ACCEPTED");
    }
    const approvedContent = await CampaignContentSubmission.countDocuments({ campaignId: campaign._id, status: "approved" });
    if (settings.paymentReleaseRules?.requireApprovedContent && approvedContent <= 0) {
      throw new AppError("Approved content is required before payment release", 400, "CONTENT_NOT_APPROVED");
    }
    const oldValue = campaign.toObject();
    campaign.status = "completed";
    campaign.spend = money(campaign.budget);
    campaign.paymentReleasedAt = new Date();
    campaign.completedAt = new Date();
    campaign.paymentReference = payload.reference || payload.paymentReference || "";
    campaign.paymentRelease = {
      releasedBy: userId,
      releasedAt: campaign.paymentReleasedAt,
      reference: campaign.paymentReference,
      notes: payload.notes || "",
    };
    campaign.history.push(campaignHistory("payment_released", userId, "Fixed campaign payment released"));
    campaign.history.push(campaignHistory("completed", userId, "Fixed campaign completed"));
    await campaign.save();
    await this.writeAudit({
      actor: actorFrom(userId, "vendor"),
      campaignId: campaign._id,
      action: "fixed_campaign.payment_released",
      oldValue,
      newValue: campaign.toObject(),
      metadata: { paymentReference: campaign.paymentReference },
    });
    return campaign;
  }

  async cancel(userId, campaignId, payload = {}) {
    const vendor = await vendorRepo.findByUserId(userId);
    if (!vendor) throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
    const campaign = await FixedCampaign.findOne({ _id: objectId(campaignId, "campaignId"), vendorId: vendor._id });
    if (!campaign) throw new AppError("Fixed campaign not found", 404, "NOT_FOUND");
    if (["completed", "payment_released"].includes(campaign.status)) {
      throw new AppError("Completed fixed campaigns cannot be cancelled", 409, "CAMPAIGN_LOCKED");
    }
    const oldValue = campaign.toObject();
    campaign.status = "cancelled";
    campaign.history.push(campaignHistory("cancelled", userId, payload.note || "Fixed campaign cancelled by vendor"));
    await campaign.save();
    await this.writeAudit({
      actor: actorFrom(userId, "vendor"),
      campaignId: campaign._id,
      action: "fixed_campaign.cancelled",
      oldValue,
      newValue: campaign.toObject(),
      metadata: { note: payload.note || "" },
    });
    return campaign;
  }

  async assertTrackableCampaign(campaignId, productId) {
    const campaign = await FixedCampaign.findById(objectId(campaignId, "campaignId")).lean();
    if (!campaign) throw new AppError("Fixed campaign not found", 404, "NOT_FOUND");
    if (["draft", "cancelled", "rejected"].includes(campaign.status)) {
      throw new AppError("Fixed campaign is not open for analytics tracking", 400, "INVALID_CAMPAIGN_STATE");
    }
    if (productId && !campaign.productIds.some((id) => String(id) === String(productId))) {
      throw new AppError("Product is not linked to this fixed campaign", 400, "INVALID_PRODUCT");
    }
    return campaign;
  }

  async trackEvent({ user, payload = {}, security = null }) {
    if (security && security.counted === false) {
      return { tracked: true, counted: false, reason: security.reason, fraudScore: security.fraudScore, fraudLevel: security.fraudLevel };
    }
    const eventType = normalizeEventType(payload.eventType);
    if (ORDER_EVENT_TYPES.has(eventType)) {
      throw new AppError("Order attribution is generated server-side", 403, "MANUAL_ATTRIBUTION_BLOCKED");
    }
    const settings = await this.settings();
    const productId = maybeObjectId(payload.productId);
    const campaign = await this.assertTrackableCampaign(payload.campaignId, productId);
    const contentType = normalizeContentType(payload.contentType || payload.sourceType);
    const visitorId = stringValue(payload.visitorId || payload.anonymousId || user?.sub || "");
    const sessionId = stringValue(payload.sessionId || payload.anonymousId || visitorId);
    if (!visitorId || !sessionId) {
      throw new AppError("visitorId and sessionId are required for fixed campaign analytics", 400, "VISITOR_ID_REQUIRED");
    }

    const shouldIssueToken = eventType === "PRODUCT_CLICK" && productId;
    const signed = shouldIssueToken
      ? signTrackingToken({
        fcp: true,
        campaignId: campaign._id,
        influencerId: campaign.influencerId,
        vendorId: campaign.vendorId,
        productId,
        visitorId,
        sessionId,
        contentType,
        contentId: payload.contentId || null,
        sourceType: contentType,
      }, Number(campaign.attributionWindowDays || settings.attributionWindowDays || 30) * 24)
      : null;
    const dedupKey = buildEventDedupKey({
      campaignId: campaign._id,
      productId,
      contentId: payload.contentId,
      eventType,
      visitorId,
      sessionId,
      dedupeMinutes: settings.analyticsSettings?.dedupeMinutes,
    });
    const eventPayload = {
      campaignId: campaign._id,
      influencerId: campaign.influencerId,
      productId: productId || undefined,
      contentType,
      contentId: maybeObjectId(payload.contentId) || undefined,
      visitorId,
      sessionId,
      eventType,
      sourceType: contentType,
      trackingTokenId: signed?.trackingTokenId || "",
      dedupKey,
      metadata: payload.metadata || {},
    };

    let counted = true;
    let event = null;
    try {
      event = await CampaignAnalyticsEvent.create(eventPayload);
      await FixedCampaign.updateOne(
        { _id: campaign._id },
        { $inc: eventCounter(eventType), $set: { "analytics.lastEventAt": new Date() } }
      );
    } catch (error) {
      if (error?.code !== 11000) throw error;
      counted = false;
      event = await CampaignAnalyticsEvent.findOne({ dedupKey }).lean();
    }

    return {
      tracked: true,
      counted,
      eventId: event?._id,
      trackingToken: signed?.token || "",
      expiresAt: signed ? addDays(new Date(), campaign.attributionWindowDays || settings.attributionWindowDays || 30) : null,
      analyticsOnly: true,
      commissionCreated: false,
      payoutAffected: false,
    };
  }

  async validateOrderTrackingToken(token) {
    if (!token) return null;
    let payload;
    try {
      payload = verifyTrackingToken(token);
    } catch {
      return null;
    }
    if (!payload?.fcp) return null;
    const campaign = await FixedCampaign.findById(payload.campaignId).lean();
    if (!campaign || ["draft", "cancelled", "rejected"].includes(campaign.status)) return null;
    if (!campaign.productIds.some((id) => String(id) === String(payload.productId))) return null;
    const windowStart = addDays(new Date(), -Number(campaign.attributionWindowDays || 30));
    const click = await CampaignAnalyticsEvent.findOne({
      campaignId: campaign._id,
      productId: maybeObjectId(payload.productId),
      eventType: "PRODUCT_CLICK",
      createdAt: { $gte: windowStart },
      $or: [
        { trackingTokenId: payload.ttid || "" },
        { visitorId: payload.visitorId || "", sessionId: payload.sessionId || "" },
      ],
    }).sort({ createdAt: -1 }).lean();
    if (!click) return null;
    return { payload, campaign, click };
  }

  matchingOrderItem(order, productId) {
    return (order.items || []).find((item) => String(item.productId?._id || item.productId) === String(productId));
  }

  async attributeOrder({ order, trackingToken, fixedTrackingContext = null, userId = null }) {
    const context = fixedTrackingContext || await this.validateOrderTrackingToken(trackingToken);
    if (!context?.campaign || !order?._id) return { attributed: false, reason: "NO_FIXED_CAMPAIGN_CONTEXT" };
    const { campaign, payload, click } = context;
    if (String(order.sellerId?._id || order.sellerId) !== String(campaign.vendorId)) {
      return { attributed: false, reason: "ORDER_VENDOR_MISMATCH" };
    }
    const item = this.matchingOrderItem(order, payload.productId);
    if (!item) return { attributed: false, reason: "ORDER_PRODUCT_MISMATCH" };
    const saleAmount = money(Number(item.price || 0) * Number(item.quantity || 0));
    const orderEventPayload = {
      campaignId: campaign._id,
      influencerId: campaign.influencerId,
      productId: maybeObjectId(payload.productId),
      contentType: normalizeContentType(payload.contentType),
      contentId: maybeObjectId(payload.contentId) || undefined,
      visitorId: payload.visitorId || String(userId || order.userId || ""),
      sessionId: payload.sessionId || payload.visitorId || String(userId || order.userId || ""),
      eventType: "ORDER_COMPLETED",
      sourceType: normalizeContentType(payload.sourceType || payload.contentType),
      orderId: order._id,
      saleAmount,
      trackingTokenId: payload.ttid || "",
      dedupKey: buildEventDedupKey({
        campaignId: campaign._id,
        productId: payload.productId,
        eventType: "ORDER_COMPLETED",
        orderId: order._id,
      }),
      metadata: {
        orderNumber: order.orderNumber,
        analyticsOnly: true,
        payoutExcluded: true,
      },
    };
    let event = null;
    let created = true;
    try {
      event = await CampaignAnalyticsEvent.create(orderEventPayload);
    } catch (error) {
      if (error?.code !== 11000) throw error;
      created = false;
      event = await CampaignAnalyticsEvent.findOne({ dedupKey: orderEventPayload.dedupKey }).lean();
    }

    let attribution = null;
    let attributionCreated = true;
    try {
      attribution = await CampaignOrderAttribution.create({
        campaignId: campaign._id,
        vendorId: campaign.vendorId,
        orderId: order._id,
        productId: maybeObjectId(payload.productId),
        influencerId: campaign.influencerId,
        saleAmount,
        sourceType: normalizeContentType(payload.sourceType || payload.contentType),
        attributedAt: new Date(),
        analyticsEventId: event?._id,
        trackingTokenId: payload.ttid || "",
        analyticsOnly: true,
        payoutExcluded: true,
        metadata: {
          clickEventId: click?._id,
          orderNumber: order.orderNumber,
        },
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      attributionCreated = false;
      attribution = await CampaignOrderAttribution.findOne({
        orderId: order._id,
        campaignId: campaign._id,
        productId: maybeObjectId(payload.productId),
      }).lean();
    }

    if (created && attributionCreated) {
      await FixedCampaign.updateOne(
        { _id: campaign._id },
        { $inc: eventCounter("ORDER_COMPLETED", saleAmount), $set: { "analytics.lastEventAt": new Date() } }
      );
    }

    return {
      attributed: Boolean(attribution),
      attribution,
      analyticsOnly: true,
      commissionCreated: false,
      payoutAffected: false,
    };
  }

  async vendorAnalytics(userId, query = {}) {
    const vendor = await vendorRepo.findByUserId(userId);
    if (!vendor) throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
    const filter = buildFilter(query, { vendorId: vendor._id });
    const campaignIds = (await FixedCampaign.find(filter).select("_id").lean()).map((campaign) => campaign._id);
    return this.analyticsForCampaigns(campaignIds, query, { vendorId: vendor._id });
  }

  async influencerAnalytics(userId, query = {}) {
    const profile = await influencerService.getProfile(userId);
    const filter = buildFilter(query, { influencerId: profile._id });
    const campaigns = await FixedCampaign.find(filter).select("_id budget status analytics").lean();
    const data = await this.analyticsForCampaigns(campaigns.map((campaign) => campaign._id), query, { influencerId: profile._id });
    const completed = campaigns.filter((campaign) => campaign.status === "completed").length;
    const totalFixedEarnings = money(campaigns.filter((campaign) => ["completed", "payment_released"].includes(campaign.status)).reduce((sum, campaign) => sum + Number(campaign.budget || 0), 0));
    return {
      ...data,
      influencer: {
        completedCampaigns: completed,
        revenueInfluenced: data.kpis.revenueGenerated,
        ordersInfluenced: data.kpis.orders,
        viewsGenerated: data.kpis.contentViews,
        clicksGenerated: data.kpis.productClicks,
        averageROAS: data.kpis.roas,
        campaignSuccessRate: campaigns.length ? money((completed / campaigns.length) * 100) : 0,
        totalFixedEarnings,
      },
    };
  }

  async productAnalytics(userId, productId, query = {}) {
    const vendor = await vendorRepo.findByUserId(userId);
    if (!vendor) throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
    const product = await productRepo.findById(productId);
    if (!product || String(product.sellerId) !== String(vendor._id)) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }
    const filter = buildFilter(query, { vendorId: vendor._id, productIds: objectId(productId, "productId") });
    const campaignIds = (await FixedCampaign.find(filter).select("_id").lean()).map((campaign) => campaign._id);
    const data = await this.analyticsForCampaigns(campaignIds, query, { vendorId: vendor._id, productId: objectId(productId, "productId") });
    return {
      product: {
        id: product._id,
        name: product.name,
        category: product.category || "",
        image: productImage(product),
      },
      ...data,
    };
  }

  async analyticsForCampaigns(campaignIds = [], query = {}, scope = {}) {
    const ids = campaignIds.filter(Boolean);
    const { start, end } = parseRange(query);
    const eventMatch = { campaignId: { $in: ids }, createdAt: { $gte: start, $lte: end } };
    const attributionMatch = { campaignId: { $in: ids }, attributedAt: { $gte: start, $lte: end } };
    if (scope.productId) {
      eventMatch.productId = scope.productId;
      attributionMatch.productId = scope.productId;
    }
    if (scope.influencerId) {
      eventMatch.influencerId = scope.influencerId;
      attributionMatch.influencerId = scope.influencerId;
    }
    if (!ids.length) {
      return {
        kpis: {
          campaignBudget: 0,
          campaignSpend: 0,
          contentViews: 0,
          productClicks: 0,
          productViews: 0,
          addToCart: 0,
          orders: 0,
          revenueGenerated: 0,
          roas: 0,
          roi: 0,
          conversionRate: 0,
          averageOrderValue: 0,
          influencerPayment: 0,
        },
        charts: { eventTrend: [], revenueTrend: [], campaignComparison: [], topProducts: [], topInfluencers: [] },
      };
    }

    const [
      campaigns,
      eventCounts,
      attributionSummary,
      eventTrend,
      revenueTrend,
      productRows,
      influencerRows,
    ] = await Promise.all([
      FixedCampaign.find({ _id: { $in: ids } }).populate("productIds", "name category images thumbnail").lean(),
      CampaignAnalyticsEvent.aggregate([
        { $match: eventMatch },
        { $group: { _id: "$eventType", count: { $sum: 1 } } },
      ]),
      CampaignOrderAttribution.aggregate([
        { $match: attributionMatch },
        { $group: { _id: null, revenue: { $sum: "$saleAmount" }, orders: { $sum: 1 } } },
      ]),
      CampaignAnalyticsEvent.aggregate([
        { $match: eventMatch },
        { $group: { _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, eventType: "$eventType" }, count: { $sum: 1 } } },
        { $sort: { "_id.date": 1 } },
      ]),
      CampaignOrderAttribution.aggregate([
        { $match: attributionMatch },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$attributedAt" } }, revenue: { $sum: "$saleAmount" }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      CampaignOrderAttribution.aggregate([
        { $match: attributionMatch },
        { $group: { _id: "$productId", revenue: { $sum: "$saleAmount" }, orders: { $sum: 1 }, influencers: { $addToSet: "$influencerId" }, campaigns: { $addToSet: "$campaignId" } } },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]),
      CampaignOrderAttribution.aggregate([
        { $match: attributionMatch },
        { $group: { _id: "$influencerId", revenue: { $sum: "$saleAmount" }, orders: { $sum: 1 }, campaigns: { $addToSet: "$campaignId" } } },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]),
    ]);

    const eventMap = new Map(eventCounts.map((row) => [row._id, Number(row.count || 0)]));
    const revenue = money(attributionSummary[0]?.revenue || 0);
    const orders = Number(attributionSummary[0]?.orders || 0);
    const campaignBudget = money(campaigns.reduce((sum, campaign) => sum + Number(campaign.budget || 0), 0));
    const campaignSpend = money(campaigns.reduce((sum, campaign) => sum + Number(campaign.spend || 0), 0));
    const productClicks = eventMap.get("PRODUCT_CLICK") || 0;
    const contentViews = eventMap.get("CONTENT_VIEW") || 0;
    const productViews = eventMap.get("PRODUCT_VIEW") || 0;
    const addToCart = eventMap.get("ADD_TO_CART") || 0;
    const checkoutStarted = eventMap.get("CHECKOUT_STARTED") || 0;

    const products = productRows.length
      ? await Product.find({ _id: { $in: productRows.map((row) => row._id).filter(Boolean) } }).select("name category images thumbnail").lean()
      : [];
    const productMap = new Map(products.map((product) => [String(product._id), product]));
    const influencers = influencerRows.length
      ? await require("../influencer/model").InfluencerProfile.find({ _id: { $in: influencerRows.map((row) => row._id).filter(Boolean) } }).populate("userId", "name email username").lean()
      : [];
    const influencerMap = new Map(influencers.map((profile) => [String(profile._id), profile]));

    return {
      kpis: {
        campaignBudget,
        campaignSpend,
        contentViews,
        productClicks,
        productViews,
        addToCart,
        checkoutStarted,
        orders,
        revenueGenerated: revenue,
        influencerPayment: campaignBudget,
        ...analyticsRatios({ budget: campaignBudget, clicks: productClicks, orders, revenue }),
      },
      charts: {
        eventTrend: eventTrend.map((row) => ({ date: row._id.date, eventType: row._id.eventType, count: Number(row.count || 0) })),
        revenueTrend: revenueTrend.map((row) => ({ date: row._id, revenue: money(row.revenue), orders: Number(row.orders || 0) })),
        campaignComparison: campaigns.map((campaign) => {
          const analytics = campaign.analytics || {};
          const campaignRevenue = Number(analytics.revenue || 0);
          const clicks = Number(analytics.productClicks || 0);
          const campaignOrders = Number(analytics.orders || 0);
          return {
            id: campaign._id,
            title: campaign.title || "Fixed campaign",
            status: campaign.status,
            budget: money(campaign.budget),
            spend: money(campaign.spend),
            contentViews: Number(analytics.contentViews || 0),
            productClicks: clicks,
            orders: campaignOrders,
            revenue: money(campaignRevenue),
            influencerPayment: money(campaign.budget),
            ...analyticsRatios({ budget: campaign.budget, clicks, orders: campaignOrders, revenue: campaignRevenue }),
          };
        }),
        topProducts: productRows.map((row) => {
          const product = productMap.get(String(row._id)) || {};
          return {
            id: row._id,
            name: product.name || "Product",
            category: product.category || "",
            image: productImage(product),
            revenue: money(row.revenue),
            orders: Number(row.orders || 0),
            influencers: (row.influencers || []).length,
            campaigns: (row.campaigns || []).length,
          };
        }),
        topInfluencers: influencerRows.map((row) => {
          const profile = influencerMap.get(String(row._id)) || {};
          return {
            influencerId: row._id,
            name: profileName(profile),
            username: profileUsername(profile),
            revenueInfluenced: money(row.revenue),
            ordersInfluenced: Number(row.orders || 0),
            campaigns: (row.campaigns || []).length,
          };
        }),
      },
    };
  }

  async adminList(query = {}) {
    const { page, limit, skip } = pageOptions(query);
    const filter = buildFilter(query);
    const [items, total] = await Promise.all([
      FixedCampaign.find(filter)
        .populate("vendorId", "shopName companyName")
        .populate({ path: "influencerId", populate: { path: "userId", select: "name email username" } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FixedCampaign.countDocuments(filter),
    ]);
    return { items: items.map((campaign) => presentCampaign(campaign)), pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } };
  }
}

module.exports = new FixedCampaignService();
module.exports.__private__ = {
  normalizeEventType,
  normalizeContentType,
  analyticsRatios,
  eventCounter,
  buildEventDedupKey,
  selectedServicesFrom,
  presentCampaign,
};
