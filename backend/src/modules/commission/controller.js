const { ok } = require("../../utils/apiResponse");
const { asyncHandler } = require("../../utils/asyncHandler");
const commissionService = require("./service");

const wallet = asyncHandler(async (req, res) => ok(res, await commissionService.getInfluencerWallet(req.user.sub), "Influencer wallet loaded"));
const overview = asyncHandler(async (req, res) => ok(res, await commissionService.getOverview(), "Commission overview loaded"));

module.exports = { wallet, overview };
