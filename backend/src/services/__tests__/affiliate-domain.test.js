const test = require("node:test");
const assert = require("node:assert/strict");
const { AffiliateClick, AffiliateAttribution } = require("../../modules/reel/engagement.model");
const { TrackingSession } = require("../../modules/tracking/model");

test("affiliate click and attribution models support reel commerce attribution", () => {
  assert.equal(AffiliateClick.collection.collectionName, "affiliate_clicks");
  assert.equal(AffiliateAttribution.collection.collectionName, "affiliate_attributions");
  assert.ok(AffiliateClick.schema.path("attributionWindowDays"));
  assert.ok(AffiliateAttribution.schema.path("expiresAt"));
});

test("tracking sessions keep attribution expiry and source fields", () => {
  assert.ok(TrackingSession.schema.path("expiresAt"));
  assert.ok(TrackingSession.schema.path("surface"));
  assert.ok(TrackingSession.schema.path("trackingTokenId"));
});
