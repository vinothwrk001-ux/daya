const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const {
  CampaignAnalyticsEvent,
  CampaignOrderAttribution,
  FixedCampaign,
  FixedCampaignSetting,
} = require("../../modules/fixedCampaign/model");
const fixedCampaignService = require("../../modules/fixedCampaign/service");

const {
  analyticsRatios,
  eventCounter,
  presentCampaign,
  selectedServicesFrom,
} = fixedCampaignService.__private__;

test("fixed campaign models separate analytics attribution from payouts", () => {
  assert.equal(FixedCampaign.collection.collectionName, "fixed_campaigns");
  assert.equal(CampaignAnalyticsEvent.collection.collectionName, "campaign_analytics_events");
  assert.equal(CampaignOrderAttribution.collection.collectionName, "campaign_order_attributions");
  assert.ok(FixedCampaign.schema.path("pricingSnapshot"));
  assert.ok(FixedCampaign.schema.path("influencerRateSnapshot"));
  assert.equal(CampaignOrderAttribution.schema.path("analyticsOnly").defaultValue, true);
  assert.equal(CampaignOrderAttribution.schema.path("payoutExcluded").defaultValue, true);
  assert.deepEqual(FixedCampaignSetting.schema.path("attributionWindowDays").options.enum, [30, 60, 90]);

  const attributionIndexes = CampaignOrderAttribution.schema.indexes();
  assert.ok(
    attributionIndexes.some(([fields, options]) =>
      fields.orderId === 1 &&
      fields.campaignId === 1 &&
      fields.productId === 1 &&
      options.unique === true
    )
  );
});

test("fixed campaign analytics counters cover full event funnel", () => {
  assert.deepEqual(eventCounter("CONTENT_VIEW"), { "analytics.contentViews": 1 });
  assert.deepEqual(eventCounter("PRODUCT_CLICK"), { "analytics.productClicks": 1 });
  assert.deepEqual(eventCounter("PRODUCT_VIEW"), { "analytics.productViews": 1 });
  assert.deepEqual(eventCounter("ADD_TO_CART"), { "analytics.addToCart": 1 });
  assert.deepEqual(eventCounter("CHECKOUT_STARTED"), { "analytics.checkoutStarted": 1 });
  assert.deepEqual(eventCounter("ORDER_CANCELLED"), { "analytics.cancelledOrders": 1 });
  assert.deepEqual(eventCounter("ORDER_REFUNDED"), { "analytics.refundedOrders": 1 });
  assert.deepEqual(eventCounter("ORDER_COMPLETED", 1234.567), { "analytics.orders": 1, "analytics.revenue": 1234.57 });
});

test("fixed campaign presentation reports fixed payment and analytics-only revenue", () => {
  const campaignId = new mongoose.Types.ObjectId();
  const campaign = {
    _id: campaignId,
    title: "Creator launch",
    budget: 5000,
    spend: 0,
    analytics: {
      contentViews: 200,
      productClicks: 50,
      orders: 10,
      revenue: 12500,
    },
  };

  const presented = presentCampaign(campaign, {
    deliverables: [{ serviceName: "Reel", totalPrice: 5000 }],
    submissions: [{ status: "approved" }],
  });

  assert.equal(presented.id, campaignId);
  assert.equal(presented.influencerPayment, 5000);
  assert.equal(presented.revenueGenerated, 12500);
  assert.equal(presented.revenueDoesAffectPayout, false);
  assert.equal(presented.payoutBasis, "deliverables");
  assert.equal(presented.analytics.roas, 2.5);
  assert.equal(presented.analytics.conversionRate, 20);
  assert.equal(presented.deliverables.length, 1);
  assert.equal(presented.submissions.length, 1);
});

test("fixed campaign helpers read selected services from supported payload shapes", () => {
  const services = [{ serviceId: "svc1", packageId: "pkg1" }];

  assert.equal(selectedServicesFrom({ selectedServices: services }), services);
  assert.equal(selectedServicesFrom({ services }), services);
  assert.equal(selectedServicesFrom({ paymentModel: { selectedServices: services } }), services);
  assert.equal(selectedServicesFrom({ paymentModel: { services } }), services);
  assert.deepEqual(analyticsRatios({ budget: 1000, clicks: 25, orders: 5, revenue: 3000 }), {
    roas: 3,
    roi: 200,
    conversionRate: 20,
    averageOrderValue: 600,
  });
});
