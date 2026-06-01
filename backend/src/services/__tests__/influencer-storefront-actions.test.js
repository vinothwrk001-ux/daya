const test = require("node:test");
const assert = require("node:assert/strict");
const { InfluencerPost, InfluencerStorefrontEvent } = require("../../modules/influencer/model");

test("public storefront event schema supports profile moderation actions", () => {
  const enumValues = InfluencerStorefrontEvent.schema.path("eventType").enumValues;
  assert.ok(enumValues.includes("profile_report"));
  assert.ok(enumValues.includes("profile_block"));
});

test("influencer posts expose engagement metric counters for public actions", () => {
  assert.ok(InfluencerPost.schema.path("metrics.likes"));
  assert.ok(InfluencerPost.schema.path("metrics.shares"));
  assert.ok(InfluencerPost.schema.path("metrics.saves"));
  assert.ok(InfluencerPost.schema.path("metrics.comments"));
});
