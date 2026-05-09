const { AppError } = require("../../utils/AppError");
const { resolveApiAssetUrl } = { resolveApiAssetUrl: (value) => value };
const influencerService = require("../influencer/service");
const { Campaign } = require("../campaign/model");
const { emitDomainEvent } = require("../events/event-bus");
const { INFLUENCER_EVENTS } = require("../shared/constants");
const { Reel } = require("./model");

class ReelService {
  async upload(userId, payload = {}) {
    const profile = await influencerService.getProfile(userId);
    const campaign = await Campaign.findById(payload.campaignId);
    if (!campaign) throw new AppError("Campaign not found", 404, "NOT_FOUND");
    if (String(campaign.influencerId) !== String(profile._id)) {
      throw new AppError("Campaign does not belong to this influencer", 403, "FORBIDDEN");
    }
    if (campaign.state !== "active") {
      throw new AppError("Reels can only be submitted for active campaigns", 400, "CAMPAIGN_NOT_ACTIVE");
    }

    return await Reel.create({
      influencerId: profile._id,
      campaignId: campaign._id,
      productIds: payload.productIds || campaign.productIds,
      videoUrl: payload.videoUrl,
      caption: payload.caption || "",
      state: "pending_review",
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

  async getFeed({ category, limit = 20 } = {}) {
    const query = { state: "published" };
    const reels = await Reel.find(query)
      .populate({
        path: "campaignId",
        populate: { path: "productIds", select: "name price discountPrice images category sellerId" },
      })
      .populate({
        path: "influencerId",
        populate: { path: "userId", select: "name" },
      })
      .sort({ publishedAt: -1 })
      .limit(Math.min(Number(limit || 20), 50))
      .lean();

    const filtered = category
      ? reels.filter((reel) =>
          (reel.campaignId?.productIds || []).some((product) => String(product?.category || "").toLowerCase() === String(category).toLowerCase())
        )
      : reels;

    return filtered.map((reel) => ({
      ...reel,
      videoUrl: resolveApiAssetUrl(reel.videoUrl),
    }));
  }

  async getById(reelId) {
    const reel = await Reel.findById(reelId)
      .populate({
        path: "campaignId",
        populate: { path: "productIds", select: "name price discountPrice images category sellerId" },
      })
      .populate({
        path: "influencerId",
        populate: { path: "userId", select: "name" },
      });
    if (!reel) throw new AppError("Reel not found", 404, "NOT_FOUND");
    return reel;
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
