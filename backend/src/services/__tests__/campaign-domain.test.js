const test = require("node:test");
const assert = require("node:assert/strict");
const { Campaign } = require("../../modules/campaign/model");

test("campaign model supports influencer applications and deliverables", () => {
  assert.equal(Campaign.collection.collectionName, "campaigns");
  assert.ok(Campaign.schema.path("applications"));
  assert.ok(Campaign.schema.path("deliverables"));
  assert.ok(Campaign.schema.path("productIds"));
});
