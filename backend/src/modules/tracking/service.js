const crypto = require("crypto");
const { AppError } = require("../../utils/AppError");
const { Product } = require("../../models/Product");
const { InfluencerProfile, InfluencerStorefront, InfluencerCollection, InfluencerPost, InfluencerStorefrontEvent, InfluencerAffiliateSetting } = require("../influencer/model");
const { Reel } = require("../reel/model");
const { signTrackingToken, verifyTrackingToken } = require("./token");
const { TrackingSession } = require("./model");
const { emitDomainEvent } = require("../events/event-bus");
const { INFLUENCER_EVENTS } = require("../shared/constants");
const { nowPlusHours } = require("../shared/helpers");
const { isInfluencerCommerceEnabled } = require("../../services/influencer-commerce-config.service");

const ATTRIBUTION_WINDOW_HOURS = Number(process.env.INFLUENCER_TRACKING_TTL_HOURS || process.env.AFFILIATE_ATTRIBUTION_WINDOW_HOURS || 720);

function buildIdentityQuery({ userId, anonymousId }) {
  if (userId) return { userId, anonymousId: null };
  if (!anonymousId) throw new AppError("anonymousId is required for guest tracking", 400, "VALIDATION_ERROR");
  return { userId: null, anonymousId };
}

async function resolveStorefrontContext({ reelId, storefrontId, collectionId, postId, influencerId, trackingCode }) {
  if (reelId) {
    const reel = await Reel.findById(reelId).populate("campaignId");
    if (!reel || reel.visibility !== "published" || !["approved", "published"].includes(reel.state)) {
      throw new AppError("Reel is not published", 400, "INVALID_REEL");
    }
    return {
      reel,
      campaignId: reel.campaignId?._id || reel.campaignId || undefined,
      influencerId: reel.influencerId,
      surface: "reel",
      assertProduct(productId) {
        const reelProducts = (reel.productIds || []).map(String);
        const campaignProducts = (reel.campaignId?.productIds || []).map(String);
        if (![...reelProducts, ...campaignProducts].some((id) => String(id) === String(productId))) {
          throw new AppError("Product is not linked to this reel", 400, "INVALID_PRODUCT");
        }
      },
    };
  }

  if (storefrontId) {
    const storefront = await InfluencerStorefront.findById(storefrontId).lean();
    if (!storefront || storefront.status !== "active") throw new AppError("Storefront not found", 404, "NOT_FOUND");
    return { storefront, influencerId: storefront.influencerId, surface: "storefront", assertProduct() {} };
  }

  if (collectionId) {
    const collection = await InfluencerCollection.findById(collectionId).lean();
    if (!collection || collection.status !== "active") throw new AppError("Collection not found", 404, "NOT_FOUND");
    return {
      collection,
      influencerId: collection.influencerId,
      surface: "collection",
      assertProduct(productId) {
        if (!collection.productIds.some((id) => String(id) === String(productId))) {
          throw new AppError("Product is not linked to this collection", 400, "INVALID_PRODUCT");
        }
      },
    };
  }

  if (postId) {
    const post = await InfluencerPost.findById(postId).lean();
    if (!post || post.visibility !== "published") throw new AppError("Post not found", 404, "NOT_FOUND");
    return {
      post,
      influencerId: post.influencerId,
      surface: "post",
      assertProduct(productId) {
        if ((post.productIds || []).length && !post.productIds.some((id) => String(id) === String(productId))) {
          throw new AppError("Product is not linked to this post", 400, "INVALID_PRODUCT");
        }
      },
    };
  }

  if (trackingCode) {
    const affiliate = await InfluencerAffiliateSetting.findOne({ trackingCode, status: "active" }).lean();
    if (!affiliate) throw new AppError("Affiliate link not found", 404, "NOT_FOUND");
    return { influencerId: affiliate.influencerId, surface: "affiliate_link", assertProduct() {} };
  }

  if (influencerId) return { influencerId, surface: "storefront", assertProduct() {} };
  throw new AppError("Attribution source is required", 400, "VALIDATION_ERROR");
}

class TrackingService {
  async click({ user, reelId, productId, anonymousId, storefrontId, collectionId, postId, influencerId, trackingCode, surface = "", security = null }) {
    if (security && security.counted === false) {
      return { tracked: true, counted: false, reason: security.reason, fraudScore: security.fraudScore, fraudLevel: security.fraudLevel, anonymousId: security.anonymousId || anonymousId || "" };
    }

    if (!(await isInfluencerCommerceEnabled())) {
      throw new AppError("Influencer commerce is disabled", 403, "INFLUENCER_COMMERCE_DISABLED");
    }

    const product = await Product.findById(productId);
    if (!product) throw new AppError("Product not found", 404, "NOT_FOUND");
    const context = await resolveStorefrontContext({ reelId, storefrontId, collectionId, postId, influencerId, trackingCode });
    context.assertProduct(productId);

    if (user?.role === "influencer") {
      const profile = await InfluencerProfile.findOne({ userId: user.sub }).select("_id").lean();
      if (profile && String(context.influencerId) === String(profile._id)) {
        throw new AppError("Self-attribution is not allowed", 400, "SELF_ATTRIBUTION_BLOCKED");
      }
    }

    const expiresAt = nowPlusHours(ATTRIBUTION_WINDOW_HOURS);
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
      reelId: reelId || null,
      campaignId: context.campaignId || null,
      influencerId: context.influencerId,
      productId,
      storefrontId: storefrontId || null,
      collectionId: collectionId || null,
      postId: postId || null,
      surface: surface || context.surface,
    }, ATTRIBUTION_WINDOW_HOURS);

    const session = await TrackingSession.create({
      ...identity,
      reelId: reelId || undefined,
      campaignId: context.campaignId || undefined,
      influencerId: context.influencerId,
      productId,
      storefrontId: storefrontId || undefined,
      collectionId: collectionId || undefined,
      postId: postId || undefined,
      surface: surface || context.surface,
      trackingTokenId: signed.trackingTokenId,
      expiresAt,
    });

    await Promise.all([
      reelId ? Reel.updateOne({ _id: reelId }, { $inc: { "metrics.clicks": 1 } }) : Promise.resolve(),
      collectionId ? InfluencerCollection.updateOne({ _id: collectionId }, { $inc: { "analytics.clicks": 1 } }) : Promise.resolve(),
      postId ? InfluencerPost.updateOne({ _id: postId }, { $inc: { "metrics.clicks": 1 } }) : Promise.resolve(),
      storefrontId ? InfluencerStorefront.updateOne({ _id: storefrontId }, { $inc: { "analytics.clicks": 1 } }) : Promise.resolve(),
      InfluencerProfile.updateOne({ _id: context.influencerId }, { $inc: { "stats.clicks": 1 } }),
      InfluencerStorefrontEvent.create({
        influencerId: context.influencerId,
        storefrontId: storefrontId || context.storefront?._id,
        userId: user?.sub || null,
        anonymousId: identity.anonymousId || "",
        eventType: "product_click",
        surface: surface || context.surface,
        productId,
        collectionId,
        reelId,
        postId,
      }).catch(() => null),
    ]);

    await emitDomainEvent(INFLUENCER_EVENTS.TRACKING_CREATED, {
      trackingSessionId: session._id,
      reelId,
      campaignId: session.campaignId,
      influencerId: session.influencerId,
      productId,
    });

    return {
      counted: true,
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
    if (session.reelId) {
      const reel = await Reel.findById(session.reelId).select("state visibility").lean();
      if (!reel || reel.visibility !== "published" || !["approved", "published"].includes(reel.state)) return null;
    }
    return {
      payload,
      session,
    };
  }

  async event({ user, trackingToken, anonymousId = "", eventType = "", metadata = {}, security = null }) {
    if (security && security.counted === false) {
      return { tracked: true, counted: false, reason: security.reason, fraudScore: security.fraudScore, fraudLevel: security.fraudLevel };
    }

    const allowed = new Set(["product_view", "add_to_cart", "wishlist", "checkout_started", "order_completed", "order_cancelled", "refund", "commission_approved", "commission_paid"]);
    const cleanEventType = allowed.has(eventType) ? eventType : "";
    if (!cleanEventType) throw new AppError("Invalid tracking event", 400, "VALIDATION_ERROR");
    const trackingContext = await this.validateTrackingToken(trackingToken, user?.sub || null);
    if (!trackingContext?.session) return { tracked: false };
    const session = trackingContext.session;
    await Promise.all([
      cleanEventType === "order_completed" && session.reelId ? Reel.updateOne({ _id: session.reelId }, { $inc: { "metrics.orders": 1, "metrics.revenue": Number(metadata.revenue || 0), "metrics.commission": Number(metadata.commission || 0) } }) : Promise.resolve(),
      cleanEventType === "order_completed" && session.postId ? InfluencerPost.updateOne({ _id: session.postId }, { $inc: { "metrics.orders": 1, "metrics.revenue": Number(metadata.revenue || 0), "metrics.commission": Number(metadata.commission || 0) } }) : Promise.resolve(),
      cleanEventType === "order_completed" && session.collectionId ? InfluencerCollection.updateOne({ _id: session.collectionId }, { $inc: { "analytics.orders": 1, "analytics.revenue": Number(metadata.revenue || 0) } }) : Promise.resolve(),
      cleanEventType === "order_completed" && session.storefrontId ? InfluencerStorefront.updateOne({ _id: session.storefrontId }, { $inc: { "analytics.orders": 1, "analytics.revenue": Number(metadata.revenue || 0) } }) : Promise.resolve(),
      InfluencerStorefrontEvent.create({
        influencerId: session.influencerId,
        storefrontId: session.storefrontId,
        userId: user?.sub || session.userId || null,
        anonymousId: anonymousId || session.anonymousId || "",
        eventType: cleanEventType,
        surface: session.surface || "affiliate",
        productId: session.productId,
        collectionId: session.collectionId,
        reelId: session.reelId,
        postId: session.postId,
        metadata,
      }).catch(() => null),
    ]);
    return { tracked: true, counted: true };
  }

  async cleanupExpiredSessions() {
    const result = await TrackingSession.deleteMany({ expiresAt: { $lte: new Date() } });
    return {
      deletedCount: result.deletedCount || 0,
    };
  }
}

module.exports = new TrackingService();
