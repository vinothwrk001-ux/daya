const { ok } = require("../../utils/apiResponse");
const { asyncHandler } = require("../../utils/asyncHandler");
const fixedCampaignService = require("./service");

const preview = asyncHandler(async (req, res) =>
  ok(res, await fixedCampaignService.preview(req.user.sub, req.body), "Fixed campaign pricing preview generated")
);

const create = asyncHandler(async (req, res) =>
  ok(res, await fixedCampaignService.create(req.user.sub, req.body), "Fixed campaign created")
);

const listVendor = asyncHandler(async (req, res) =>
  ok(res, await fixedCampaignService.listForVendor(req.user.sub, req.query), "Fixed campaigns loaded")
);

const listInfluencer = asyncHandler(async (req, res) =>
  ok(res, await fixedCampaignService.listForInfluencer(req.user.sub, req.query), "Fixed campaigns loaded")
);

const accept = asyncHandler(async (req, res) =>
  ok(res, await fixedCampaignService.accept(req.user.sub, req.params.campaignId), "Fixed campaign accepted")
);

const reject = asyncHandler(async (req, res) =>
  ok(res, await fixedCampaignService.reject(req.user.sub, req.params.campaignId, req.body.note || ""), "Fixed campaign rejected")
);

const submitContent = asyncHandler(async (req, res) =>
  ok(res, await fixedCampaignService.submitContent(req.user.sub, req.params.campaignId, req.body), "Fixed campaign content submitted")
);

const reviewContent = asyncHandler(async (req, res) =>
  ok(res, await fixedCampaignService.reviewContent(req.user.sub, req.params.submissionId, req.body), "Fixed campaign content reviewed")
);

const releasePayment = asyncHandler(async (req, res) =>
  ok(res, await fixedCampaignService.releasePayment(req.user.sub, req.params.campaignId, req.body), "Fixed campaign payment released")
);

const cancel = asyncHandler(async (req, res) =>
  ok(res, await fixedCampaignService.cancel(req.user.sub, req.params.campaignId, req.body), "Fixed campaign cancelled")
);

const track = asyncHandler(async (req, res) =>
  ok(res, await fixedCampaignService.trackEvent({ user: req.user, payload: req.body, security: req.trackingSecurity }), "Fixed campaign analytics event tracked")
);

const vendorAnalytics = asyncHandler(async (req, res) =>
  ok(res, await fixedCampaignService.vendorAnalytics(req.user.sub, req.query), "Fixed campaign analytics loaded")
);

const influencerAnalytics = asyncHandler(async (req, res) =>
  ok(res, await fixedCampaignService.influencerAnalytics(req.user.sub, req.query), "Fixed campaign analytics loaded")
);

const productAnalytics = asyncHandler(async (req, res) =>
  ok(res, await fixedCampaignService.productAnalytics(req.user.sub, req.params.productId, req.query), "Fixed campaign product analytics loaded")
);

const getSettings = asyncHandler(async (_req, res) =>
  ok(res, await fixedCampaignService.settings(), "Fixed campaign settings loaded")
);

const updateSettings = asyncHandler(async (req, res) =>
  ok(res, await fixedCampaignService.updateSettings(req.user, req.body), "Fixed campaign settings updated")
);

const adminList = asyncHandler(async (req, res) =>
  ok(res, await fixedCampaignService.adminList(req.query), "Fixed campaigns loaded")
);

module.exports = {
  preview,
  create,
  listVendor,
  listInfluencer,
  accept,
  reject,
  submitContent,
  reviewContent,
  releasePayment,
  cancel,
  track,
  vendorAnalytics,
  influencerAnalytics,
  productAnalytics,
  getSettings,
  updateSettings,
  adminList,
};
