const { ok } = require("../../utils/apiResponse");
const { asyncHandler } = require("../../utils/asyncHandler");
const service = require("./service");

const dashboard = asyncHandler(async (req, res) => ok(res, await service.dashboard(req.user.sub, req.query), "Influencer commerce dashboard loaded"));
const subscriptionPlans = asyncHandler(async (req, res) => ok(res, await service.subscriptionPlans(req.user.sub), "Subscription plans loaded"));
const subscribe = asyncHandler(async (req, res) => ok(res, await service.subscribe(req.user.sub, req.body), "Subscription activated"));
const createSubscriptionOrder = asyncHandler(async (req, res) => ok(res, await service.createSubscriptionOrder(req.user.sub, req.body), "Subscription order created"));
const verifySubscriptionPayment = asyncHandler(async (req, res) => ok(res, await service.verifySubscriptionPayment(req.user.sub, req.body), "Subscription payment verified"));
const prorationPreview = asyncHandler(async (req, res) => ok(res, await service.prorationPreview(req.user.sub, req.query), "Subscription proration preview loaded"));
const createPlanChangeOrder = asyncHandler(async (req, res) => ok(res, await service.createPlanChangeOrder(req.user.sub, req.body), "Subscription change order created"));
const confirmPlanChange = asyncHandler(async (req, res) => ok(res, await service.confirmPlanChange(req.user.sub, req.body), "Subscription change confirmed"));
const cancelSubscription = asyncHandler(async (req, res) => ok(res, await service.cancelSubscription(req.user.sub), "Subscription cancelled"));
const discover = asyncHandler(async (req, res) => ok(res, await service.discover(req.user.sub, req.query), "Influencers loaded"));
const relationships = asyncHandler(async (req, res) => ok(res, await service.relationships(req.user.sub, req.query), "Influencer relationships loaded"));
const saveInfluencer = asyncHandler(async (req, res) => ok(res, await service.saveInfluencer(req.user.sub, req.params.influencerId, req.body.saved !== false), "Influencer saved"));
const visitInfluencer = asyncHandler(async (req, res) => ok(res, await service.visitInfluencer(req.user.sub, req.params.influencerId), "Influencer visit recorded"));
const updateRelationship = asyncHandler(async (req, res) => ok(res, await service.updateRelationship(req.user.sub, req.params.influencerId, req.body), "Influencer relationship updated"));
const createCampaign = asyncHandler(async (req, res) => ok(res, await service.createCampaign(req.user.sub, req.body), "Campaign created"));
const campaigns = asyncHandler(async (req, res) => ok(res, await service.campaigns(req.user.sub, req.query), "Campaigns loaded"));
const reviewApplication = asyncHandler(async (req, res) => ok(res, await service.reviewApplication(req.user.sub, req.params.campaignId, req.params.influencerId, req.body), "Campaign application reviewed"));
const updateCampaignStatus = asyncHandler(async (req, res) => ok(res, await service.updateCampaignStatus(req.user.sub, req.params.campaignId, req.body), "Campaign status updated"));
const deleteCampaign = asyncHandler(async (req, res) => ok(res, await service.deleteCampaign(req.user.sub, req.params.campaignId), "Campaign deleted"));
const products = asyncHandler(async (req, res) => ok(res, await service.products(req.user.sub, req.query), "Promotion products loaded"));
const affiliateProducts = asyncHandler(async (req, res) => ok(res, await service.affiliateProducts(req.user.sub, req.query), "Affiliate products loaded"));
const contentApprovals = asyncHandler(async (req, res) => ok(res, await service.contentApprovals(req.user.sub, req.query), "Content approvals loaded"));
const reviewContent = asyncHandler(async (req, res) => ok(res, await service.reviewContent(req.user.sub, req.params.reelId, req.body), "Content reviewed"));
const performance = asyncHandler(async (req, res) => ok(res, await service.performance(req.user.sub, req.query), "Influencer performance loaded"));
const analytics = asyncHandler(async (req, res) => ok(res, await service.analytics(req.user.sub, req.query), "Campaign analytics loaded"));
const leaderboard = asyncHandler(async (req, res) => ok(res, await service.leaderboard(req.user.sub, req.query), "Creator leaderboard loaded"));
const reports = asyncHandler(async (req, res) => ok(res, await service.reports(req.user.sub, req.query), "Influencer commerce reports loaded"));

module.exports = {
  dashboard,
  subscriptionPlans,
  subscribe,
  createSubscriptionOrder,
  verifySubscriptionPayment,
  prorationPreview,
  createPlanChangeOrder,
  confirmPlanChange,
  cancelSubscription,
  discover,
  relationships,
  saveInfluencer,
  visitInfluencer,
  updateRelationship,
  createCampaign,
  campaigns,
  reviewApplication,
  updateCampaignStatus,
  deleteCampaign,
  products,
  affiliateProducts,
  contentApprovals,
  reviewContent,
  performance,
  analytics,
  leaderboard,
  reports,
};
