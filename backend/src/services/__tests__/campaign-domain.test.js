const test = require("node:test");
const assert = require("node:assert/strict");
const { Campaign } = require("../../modules/campaign/model");
const campaignRuleEngine = require("../campaign-rule-engine.service");

test("campaign model supports influencer applications and deliverables", () => {
  assert.equal(Campaign.collection.collectionName, "campaigns");
  assert.ok(Campaign.schema.path("applications"));
  assert.ok(Campaign.schema.path("deliverables"));
  assert.ok(Campaign.schema.path("productIds"));
});

test("campaign rule engine blocks invalid campaign payment combinations", () => {
  assert.throws(
    () => campaignRuleEngine.evaluateCampaignRules({
      campaignType: "affiliate",
      paymentType: "fixed",
      productIds: ["product-1"],
      fixedFee: 1000,
    }),
    /does not allow fixed payment/
  );
  assert.throws(
    () => campaignRuleEngine.evaluateCampaignRules({
      campaignType: "ugc",
      paymentType: "hybrid",
      productIds: ["product-1"],
      fixedFee: 1000,
      commissionPercent: 10,
      attributionDays: 30,
    }),
    /does not allow hybrid payment/
  );
});

test("campaign rule engine enables affiliate infrastructure only for commission-bearing models", () => {
  const commission = campaignRuleEngine.evaluateCampaignRules({
    campaignType: "affiliate",
    paymentType: "commission",
    productIds: ["product-1"],
    commissionPercent: 12,
    attributionDays: 60,
  });
  assert.equal(commission.affiliateInfrastructure.enabled, true);
  assert.equal(commission.attributionDays, 60);

  const freeProduct = campaignRuleEngine.evaluateCampaignRules({
    campaignType: "video",
    paymentType: "free_product",
    productIds: ["product-1"],
  });
  assert.equal(freeProduct.affiliateInfrastructure.enabled, false);
  assert.equal(freeProduct.attributionDays, 0);
});

test("campaign rule engine rejects vendor-defined custom attribution windows", () => {
  assert.throws(
    () => campaignRuleEngine.evaluateCampaignRules({
      campaignType: "live_commerce",
      paymentType: "commission",
      productIds: ["product-1"],
      commissionPercent: 8,
      attributionDays: 45,
    }),
    /Selected attribution window is not allowed/
  );
});
