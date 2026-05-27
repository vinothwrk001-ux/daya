const { ok } = require("../../utils/apiResponse");
const { asyncHandler } = require("../../utils/asyncHandler");
const service = require("./service");

const dashboard = asyncHandler(async (req, res) => ok(res, await service.dashboard(req.query), "Influencer commerce dashboard loaded"));
const influencers = asyncHandler(async (req, res) => ok(res, await service.influencers(req.query), "Influencers loaded"));
const vendors = asyncHandler(async (req, res) => ok(res, await service.vendors(req.query), "Vendors loaded"));
const campaigns = asyncHandler(async (req, res) => ok(res, await service.campaigns(req.query), "Campaigns loaded"));
const applications = asyncHandler(async (req, res) => ok(res, await service.applications(req.query), "Campaign applications loaded"));
const reviewCampaignApplication = asyncHandler(async (req, res) => ok(res, await service.reviewCampaignApplication(req.user, req.params.campaignId, req.params.influencerId, req.body), "Campaign application reviewed"));
const updateCampaign = asyncHandler(async (req, res) => ok(res, await service.updateCampaign(req.user, req.params.campaignId, req.body), "Campaign updated"));
const matching = asyncHandler(async (req, res) => ok(res, await service.matching(req.query), "Influencer-vendor matches loaded"));
const affiliateProducts = asyncHandler(async (req, res) => ok(res, await service.affiliateProducts(req.query), "Affiliate products loaded"));
const tracking = asyncHandler(async (req, res) => ok(res, await service.tracking(req.query), "Affiliate tracking loaded"));
const content = asyncHandler(async (req, res) => ok(res, await service.content(req.query), "Content moderation queue loaded"));
const moderateContent = asyncHandler(async (req, res) => ok(res, await service.moderateContent(req.user, req.params.reelId, req.body), "Content moderated"));
const productPromotions = asyncHandler(async (req, res) => ok(res, await service.productPromotions(req.query), "Product promotions loaded"));
const commissions = asyncHandler(async (req, res) => ok(res, await service.commissions(req.query), "Commissions loaded"));
const updateCommission = asyncHandler(async (req, res) => ok(res, await service.updateCommission(req.user, req.params.commissionId, req.body), "Commission updated"));
const settlements = asyncHandler(async (req, res) => ok(res, await service.settlements(req.query), "Settlements loaded"));
const payouts = asyncHandler(async (req, res) => ok(res, await service.payouts(req.query), "Payouts loaded"));
const withdrawals = asyncHandler(async (req, res) => ok(res, await service.withdrawals(req.query), "Withdrawals loaded"));
const updateWithdrawal = asyncHandler(async (req, res) => ok(res, await service.updateWithdrawal(req.user, req.params.requestId, req.body), "Withdrawal updated"));
const creatorPerformance = asyncHandler(async (req, res) => ok(res, await service.creatorPerformance(req.query), "Creator performance loaded"));
const vendorPerformance = asyncHandler(async (req, res) => ok(res, await service.vendorPerformance(req.query), "Vendor performance loaded"));
const campaignAnalytics = asyncHandler(async (req, res) => ok(res, await service.campaignAnalytics(req.query), "Campaign analytics loaded"));
const revenueAnalytics = asyncHandler(async (req, res) => ok(res, await service.revenueAnalytics(req.query), "Revenue analytics loaded"));
const fraud = asyncHandler(async (req, res) => ok(res, await service.fraud(req.query), "Fraud alerts loaded"));
const updateFraud = asyncHandler(async (req, res) => ok(res, await service.updateFraud(req.user, req.params.alertId, req.body), "Fraud alert updated"));
const communication = asyncHandler(async (req, res) => ok(res, await service.communication(req.query), "Communication center loaded"));
const reports = asyncHandler(async (req, res) => ok(res, await service.reports(req.query), "Reports loaded"));
const saveReportSchedule = asyncHandler(async (req, res) => ok(res, await service.saveReportSchedule(req.user, req.body), "Report schedule saved"));
const settings = asyncHandler(async (req, res) => ok(res, await service.settings(), "Settings loaded"));
const updateSettings = asyncHandler(async (req, res) => ok(res, await service.updateSettings(req.user, req.body), "Settings updated"));
const auditLogs = asyncHandler(async (req, res) => ok(res, await service.auditLogs(req.query), "Audit logs loaded"));

module.exports = {
  dashboard,
  influencers,
  vendors,
  campaigns,
  applications,
  reviewCampaignApplication,
  updateCampaign,
  matching,
  affiliateProducts,
  tracking,
  content,
  moderateContent,
  productPromotions,
  commissions,
  updateCommission,
  settlements,
  payouts,
  withdrawals,
  updateWithdrawal,
  creatorPerformance,
  vendorPerformance,
  campaignAnalytics,
  revenueAnalytics,
  fraud,
  updateFraud,
  communication,
  reports,
  saveReportSchedule,
  settings,
  updateSettings,
  auditLogs,
};
