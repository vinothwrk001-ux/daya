const { AppError } = require("../../utils/AppError");
const vendorRepo = require("../../repositories/vendor.repository");
const productRepo = require("../../repositories/product.repository");
const influencerService = require("../influencer/service");
const { emitDomainEvent } = require("../events/event-bus");
const { INFLUENCER_EVENTS } = require("../shared/constants");
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

class CampaignService {
  async create(userId, payload = {}) {
    const vendor = await vendorRepo.findByUserId(userId);
    if (!vendor) throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
    const influencer = await influencerService.getProfileById(payload.influencerId);

    await ensureVendorOwnsProducts(vendor._id, payload.productIds);

    return await Campaign.create({
      vendorId: vendor._id,
      influencerId: influencer._id,
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
    return await Campaign.find({ influencerId: profile._id })
      .populate("productIds", "name")
      .populate("vendorId", "shopName companyName")
      .sort({ createdAt: -1 });
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
