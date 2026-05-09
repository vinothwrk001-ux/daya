const crypto = require("crypto");
const { AppError } = require("../../utils/AppError");
const { Product } = require("../../models/Product");
const { InfluencerProfile } = require("../influencer/model");
const { Reel } = require("../reel/model");
const { signTrackingToken, verifyTrackingToken } = require("./token");
const { TrackingSession } = require("./model");
const { emitDomainEvent } = require("../events/event-bus");
const { INFLUENCER_EVENTS } = require("../shared/constants");
const { nowPlusHours } = require("../shared/helpers");
const { isInfluencerCommerceEnabled } = require("../../services/influencer-commerce-config.service");

function buildIdentityQuery({ userId, anonymousId }) {
  if (userId) return { userId, anonymousId: null };
  if (!anonymousId) throw new AppError("anonymousId is required for guest tracking", 400, "VALIDATION_ERROR");
  return { userId: null, anonymousId };
}

class TrackingService {
  async click({ user, reelId, productId, anonymousId }) {
    if (!(await isInfluencerCommerceEnabled())) {
      throw new AppError("Influencer commerce is disabled", 403, "INFLUENCER_COMMERCE_DISABLED");
    }

    const reel = await Reel.findById(reelId).populate("campaignId");
    if (!reel || reel.state !== "published") {
      throw new AppError("Reel is not published", 400, "INVALID_REEL");
    }

    const product = await Product.findById(productId);
    if (!product) throw new AppError("Product not found", 404, "NOT_FOUND");
    if (!reel.productIds.some((id) => String(id) === String(productId))) {
      throw new AppError("Product is not linked to this reel", 400, "INVALID_PRODUCT");
    }

    if (user?.role === "influencer") {
      const profile = await InfluencerProfile.findOne({ userId: user.sub }).select("_id").lean();
      if (profile && String(reel.influencerId) === String(profile._id)) {
        throw new AppError("Self-attribution is not allowed", 400, "SELF_ATTRIBUTION_BLOCKED");
      }
    }

    const expiresAt = nowPlusHours(24);
    const identity = buildIdentityQuery({
      userId: user?.sub || null,
      anonymousId: anonymousId || `anon_${crypto.randomBytes(8).toString("hex")}`,
    });

    await TrackingSession.deleteMany({
      ...identity,
      productId,
    });

    const signed = signTrackingToken({
      sub: user?.sub || null,
      anon: identity.anonymousId,
      reelId,
      campaignId: reel.campaignId?._id || reel.campaignId,
      influencerId: reel.influencerId,
      productId,
    });

    const session = await TrackingSession.create({
      ...identity,
      reelId,
      campaignId: reel.campaignId?._id || reel.campaignId,
      influencerId: reel.influencerId,
      productId,
      trackingTokenId: signed.trackingTokenId,
      expiresAt,
    });

    await Reel.updateOne({ _id: reelId }, { $inc: { "metrics.clicks": 1 } });

    await emitDomainEvent(INFLUENCER_EVENTS.TRACKING_CREATED, {
      trackingSessionId: session._id,
      reelId,
      campaignId: session.campaignId,
      influencerId: session.influencerId,
      productId,
    });

    return {
      trackingToken: signed.token,
      expiresAt,
      session,
      anonymousId: identity.anonymousId,
    };
  }

  async validateTrackingToken(token, userId = null) {
    if (!(await isInfluencerCommerceEnabled())) {
      return null;
    }

    if (!token) return null;
    const payload = verifyTrackingToken(token);
    const session = await TrackingSession.findOne({ trackingTokenId: payload.ttid });
    if (!session || session.expiresAt < new Date()) return null;
    if (userId && session.userId && String(session.userId) !== String(userId)) return null;
    const reel = await Reel.findById(session.reelId).select("state").lean();
    if (!reel || reel.state !== "published") return null;
    return {
      payload,
      session,
    };
  }

  async cleanupExpiredSessions() {
    const result = await TrackingSession.deleteMany({ expiresAt: { $lte: new Date() } });
    return {
      deletedCount: result.deletedCount || 0,
    };
  }
}

module.exports = new TrackingService();
