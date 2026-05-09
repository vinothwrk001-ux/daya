const { ok } = require("../../utils/apiResponse");
const { asyncHandler } = require("../../utils/asyncHandler");
const influencerService = require("./service");
const commissionService = require("../commission/service");

const register = asyncHandler(async (req, res) => ok(res, await influencerService.register(req.user.sub, req.body), "Influencer profile saved"));
const profile = asyncHandler(async (req, res) => ok(res, await influencerService.getProfile(req.user.sub), "Influencer profile loaded"));
const update = asyncHandler(async (req, res) => ok(res, await influencerService.updateProfile(req.user.sub, req.body), "Influencer profile updated"));
const list = asyncHandler(async (req, res) => ok(res, await influencerService.list(req.query), "Influencers loaded"));
const moderate = asyncHandler(async (req, res) => ok(res, await influencerService.moderate(req.params.id, req.body), "Influencer status updated"));
const dashboard = asyncHandler(async (req, res) =>
  ok(res, await commissionService.getInfluencerDashboard(req.user.sub), "Influencer dashboard loaded")
);
const earnings = asyncHandler(async (req, res) =>
  ok(res, await commissionService.getInfluencerEarnings(req.user.sub, req.query), "Influencer earnings loaded")
);

module.exports = { register, profile, update, list, moderate, dashboard, earnings };
