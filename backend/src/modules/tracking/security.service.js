const crypto = require("crypto");
const mongoose = require("mongoose");
const { AppError } = require("../../utils/AppError");
const { DedupEvent, FraudEvent, TrackingEvent, VerifiedEvent, VisitorProfile } = require("./security.model");
const { verifyTrackingToken } = require("./token");

const DEFAULT_RETENTION_DAYS = Number(process.env.TRACKING_SECURITY_RETENTION_DAYS || 30);

const EVENT_LIMITS = {
  reel_view: {
    windowMs: Number(process.env.TRACKING_REEL_VIEW_WINDOW_MS || 24 * 60 * 60 * 1000),
    maxPerVisitor: Number(process.env.TRACKING_REEL_VIEW_VISITOR_MAX || 5),
    dedupMs: Number(process.env.TRACKING_REEL_VIEW_DEDUP_MS || 30 * 60 * 1000),
  },
  product_click: {
    windowMs: Number(process.env.TRACKING_PRODUCT_CLICK_WINDOW_MS || 60 * 60 * 1000),
    maxPerVisitor: Number(process.env.TRACKING_PRODUCT_CLICK_VISITOR_MAX || 10),
    dedupMs: Number(process.env.TRACKING_PRODUCT_CLICK_DEDUP_MS || 5 * 60 * 1000),
  },
  store_visit: {
    windowMs: Number(process.env.TRACKING_STORE_VISIT_WINDOW_MS || 30 * 60 * 1000),
    maxPerVisitor: Number(process.env.TRACKING_STORE_VISIT_VISITOR_MAX || 3),
    dedupMs: Number(process.env.TRACKING_STORE_VISIT_DEDUP_MS || 10 * 60 * 1000),
  },
  reel_share: {
    windowMs: Number(process.env.TRACKING_SHARE_WINDOW_MS || 60 * 60 * 1000),
    maxPerVisitor: Number(process.env.TRACKING_SHARE_VISITOR_MAX || 20),
    dedupMs: Number(process.env.TRACKING_SHARE_DEDUP_MS || 60 * 1000),
  },
  reel_like: {
    windowMs: Number(process.env.TRACKING_LIKE_WINDOW_MS || 60 * 60 * 1000),
    maxPerVisitor: Number(process.env.TRACKING_LIKE_VISITOR_MAX || 100),
    dedupMs: Number(process.env.TRACKING_LIKE_DEDUP_MS || 5 * 1000),
    authOnly: true,
  },
  reel_comment: {
    windowMs: Number(process.env.TRACKING_COMMENT_WINDOW_MS || 60 * 60 * 1000),
    maxPerVisitor: Number(process.env.TRACKING_COMMENT_VISITOR_MAX || 50),
    dedupMs: Number(process.env.TRACKING_COMMENT_DEDUP_MS || 10 * 1000),
    authOnly: true,
  },
  tracking_event: {
    windowMs: Number(process.env.TRACKING_EVENT_WINDOW_MS || 60 * 60 * 1000),
    maxPerVisitor: Number(process.env.TRACKING_EVENT_VISITOR_MAX || 120),
    dedupMs: Number(process.env.TRACKING_EVENT_DEDUP_MS || 5 * 60 * 1000),
  },
};

function hash(value = "") {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function getClientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.ip || req.socket?.remoteAddress || "")
    .split(",")[0]
    .trim();
}

function retentionDate(ms = DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000) {
  return new Date(Date.now() + ms);
}

function getTokenId(token = "") {
  if (!token) return "";
  try {
    return verifyTrackingToken(token).ttid || "";
  } catch {
    return "";
  }
}

function buildIdentity(req) {
  const userId = req.user?.sub || null;
  const anonymousId = String(req.body?.anonymousId || req.query?.anonymousId || req.cookies?.anonVisitorId || "").trim();
  const ip = getClientIp(req);
  const userAgent = String(req.headers["user-agent"] || "");
  const language = String(req.headers["accept-language"] || "");
  const clientHints = [
    req.headers["sec-ch-ua"],
    req.headers["sec-ch-ua-platform"],
    req.headers["sec-ch-ua-mobile"],
    req.body?.deviceFingerprint,
    req.body?.sessionId,
    req.body?.timezone,
    req.body?.screen,
  ].filter(Boolean).join("|");

  const ipHash = hash(ip);
  const userAgentHash = hash(userAgent);
  const deviceFingerprint = hash(`${userAgent}|${language}|${clientHints}`);
  const sessionFingerprint = hash(`${anonymousId || userId || ipHash}|${userAgent}|${req.body?.sessionId || ""}`);
  const visitorId = userId
    ? `user:${userId}`
    : anonymousId
      ? `anon:${hash(anonymousId)}`
      : `fp:${hash(`${ip}|${userAgent}|${language}|${clientHints}`)}`;

  return {
    userId,
    anonymousId,
    ipHash,
    userAgentHash,
    deviceFingerprint,
    sessionFingerprint,
    visitorId,
  };
}

function resourceId(req, eventType) {
  if (eventType === "reel_view" || eventType === "reel_share" || eventType === "reel_like" || eventType === "reel_comment" || eventType === "store_visit") {
    return req.params?.id || req.body?.reelId || "";
  }
  if (eventType === "product_click") {
    return [req.body?.productId || "", req.params?.id || req.body?.reelId || "", req.body?.storefrontId || "", req.body?.collectionId || "", req.body?.postId || "", req.body?.trackingCode || ""].join(":");
  }
  if (eventType === "tracking_event") {
    return [req.body?.trackingToken || "", req.body?.eventType || ""].join(":");
  }
  return req.originalUrl || req.path;
}

function buildDedupKey(req, eventType, identity) {
  return hash([
    eventType,
    identity.visitorId,
    resourceId(req, eventType),
    req.body?.productId || "",
    req.body?.storefrontId || "",
    req.body?.collectionId || "",
    req.body?.postId || "",
    getTokenId(req.body?.trackingToken || ""),
  ].join("|"));
}

async function scoreFraud({ req, eventType, identity, recentCount, ipRecentCount, duplicate }) {
  let score = 0;
  const userAgent = String(req.headers["user-agent"] || "").toLowerCase();
  if (!userAgent || /(bot|crawler|spider|headless|selenium|phantom)/i.test(userAgent)) score += 35;
  if (!identity.anonymousId && !identity.userId) score += 15;
  if (recentCount > 0) score += Math.min(25, recentCount * 3);
  if (ipRecentCount > Math.max(20, recentCount * 4)) score += 25;
  if (duplicate) score += 20;
  if (eventType === "product_click" && req.user?.role === "influencer") score += 20;

  const clamped = Math.min(100, score);
  const level = clamped >= 85 ? "critical" : clamped >= 65 ? "high" : clamped >= 35 ? "medium" : "low";
  return { score: clamped, level };
}

function buildEventPayload({ req, eventType, identity, status, fraud, dedupKey, reason }) {
  const optionalObjectId = (value) => value && mongoose.Types.ObjectId.isValid(value) ? value : undefined;
  return {
    eventType,
    status,
    visitorId: identity.visitorId,
    userId: identity.userId,
    anonymousId: identity.anonymousId,
    ipHash: identity.ipHash,
    userAgentHash: identity.userAgentHash,
    deviceFingerprint: identity.deviceFingerprint,
    sessionFingerprint: identity.sessionFingerprint,
    trackingTokenId: getTokenId(req.body?.trackingToken || ""),
    dedupKey,
    reelId: optionalObjectId(req.params?.id || req.body?.reelId),
    productId: optionalObjectId(req.body?.productId),
    storefrontId: optionalObjectId(req.body?.storefrontId),
    collectionId: optionalObjectId(req.body?.collectionId),
    postId: optionalObjectId(req.body?.postId),
    influencerId: optionalObjectId(req.body?.influencerId),
    fraudScore: fraud.score,
    fraudLevel: fraud.level,
    reason,
    source: req.body?.source || req.body?.surface || "",
    metadata: {
      path: req.originalUrl,
      method: req.method,
      bodyEventType: req.body?.eventType || "",
      destination: req.body?.destination || "",
    },
    expiresAt: retentionDate(),
  };
}

async function evaluateEvent(req, eventType) {
  const limit = EVENT_LIMITS[eventType] || EVENT_LIMITS.tracking_event;
  if (limit.authOnly && !req.user?.sub) {
    throw new AppError("Login required for this engagement action", 401, "AUTH_REQUIRED");
  }

  const identity = buildIdentity(req);
  const dedupKey = buildDedupKey(req, eventType, identity);
  const since = new Date(Date.now() - limit.windowMs);
  const recentQuery = { eventType, visitorId: identity.visitorId, createdAt: { $gte: since } };
  const ipQuery = { eventType, ipHash: identity.ipHash, createdAt: { $gte: since } };
  const [recentCount, ipRecentCount, existingDedup] = await Promise.all([
    TrackingEvent.countDocuments(recentQuery),
    TrackingEvent.countDocuments(ipQuery),
    DedupEvent.findOne({ dedupKey, expiresAt: { $gt: new Date() } }).lean(),
  ]);

  const rateLimited = recentCount >= limit.maxPerVisitor || ipRecentCount >= limit.maxPerVisitor * 20;
  const fraud = await scoreFraud({ req, eventType, identity, recentCount, ipRecentCount, duplicate: Boolean(existingDedup) });
  const fraudBlocked = fraud.level === "critical" || fraud.score >= Number(process.env.TRACKING_FRAUD_BLOCK_SCORE || 85);
  const status = rateLimited ? "rate_limited" : fraudBlocked ? "fraud" : existingDedup ? "duplicate" : "verified";
  const reason = rateLimited ? "RATE_LIMITED" : fraudBlocked ? "FRAUD_SCORE_BLOCKED" : existingDedup ? "DUPLICATE_EVENT" : "VERIFIED";
  const payload = buildEventPayload({ req, eventType, identity, status, fraud, dedupKey, reason });

  await Promise.all([
    TrackingEvent.create(payload),
    VisitorProfile.findOneAndUpdate(
      { visitorId: identity.visitorId },
      { $set: { ...identity, fraudScore: fraud.score, lastSeenAt: new Date() }, $inc: { eventCount: 1 } },
      { upsert: true, returnDocument: "after" }
    ),
    status === "verified" ? VerifiedEvent.create(payload) : Promise.resolve(),
    status === "fraud" || status === "rate_limited" ? FraudEvent.create(payload) : Promise.resolve(),
    existingDedup
      ? DedupEvent.updateOne({ dedupKey }, { $set: { lastSeenAt: new Date() }, $inc: { duplicateCount: 1 } })
      : DedupEvent.create({ dedupKey, eventType, visitorId: identity.visitorId, expiresAt: retentionDate(limit.dedupMs) }),
  ]);

  return {
    counted: status === "verified",
    status,
    reason,
    fraudScore: fraud.score,
    fraudLevel: fraud.level,
    visitorId: identity.visitorId,
    anonymousId: identity.anonymousId,
    dedupKey,
  };
}

module.exports = {
  EVENT_LIMITS,
  buildIdentity,
  evaluateEvent,
};
