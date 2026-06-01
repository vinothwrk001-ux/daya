const test = require("node:test");
const assert = require("node:assert/strict");
const { DedupEvent, FraudEvent, TrackingEvent, VerifiedEvent, VisitorProfile } = require("../../modules/tracking/security.model");
const { EVENT_LIMITS, buildIdentity } = require("../../modules/tracking/security.service");

test("tracking security models create required high-volume event collections", () => {
  assert.equal(TrackingEvent.collection.collectionName, "tracking_events");
  assert.equal(VerifiedEvent.collection.collectionName, "verified_events");
  assert.equal(FraudEvent.collection.collectionName, "fraud_events");
  assert.equal(DedupEvent.collection.collectionName, "dedup_events");
  assert.equal(VisitorProfile.collection.collectionName, "visitor_profiles");
});

test("tracking security events are indexed for deduplication and quality reporting", () => {
  assert.ok(TrackingEvent.schema.path("dedupKey"));
  assert.ok(TrackingEvent.schema.path("fraudScore"));
  assert.ok(TrackingEvent.schema.path("visitorId"));
  assert.ok(TrackingEvent.schema.path("trackingTokenId"));
  assert.ok(DedupEvent.schema.indexes().some(([fields, options]) => fields.dedupKey === 1 && options.unique === true));
});

test("route-level tracking limits are configurable by event type", () => {
  assert.equal(EVENT_LIMITS.reel_view.maxPerVisitor, Number(process.env.TRACKING_REEL_VIEW_VISITOR_MAX || 5));
  assert.equal(EVENT_LIMITS.product_click.maxPerVisitor, Number(process.env.TRACKING_PRODUCT_CLICK_VISITOR_MAX || 10));
  assert.equal(EVENT_LIMITS.store_visit.maxPerVisitor, Number(process.env.TRACKING_STORE_VISIT_VISITOR_MAX || 3));
  assert.equal(EVENT_LIMITS.reel_like.authOnly, true);
  assert.equal(EVENT_LIMITS.reel_comment.authOnly, true);
});

test("visitor identity combines user, anonymous, device and network signals", () => {
  const identity = buildIdentity({
    user: null,
    body: { anonymousId: "anon-123", timezone: "Asia/Calcutta", screen: "1366x768" },
    query: {},
    cookies: {},
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept-language": "en-IN",
      "sec-ch-ua-platform": "Windows",
    },
    ip: "127.0.0.1",
    socket: {},
  });

  assert.match(identity.visitorId, /^anon:/);
  assert.equal(identity.anonymousId, "anon-123");
  assert.equal(identity.ipHash.length, 64);
  assert.equal(identity.userAgentHash.length, 64);
  assert.equal(identity.deviceFingerprint.length, 64);
  assert.equal(identity.sessionFingerprint.length, 64);
});
