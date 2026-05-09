const { ok } = require("../../utils/apiResponse");
const { asyncHandler } = require("../../utils/asyncHandler");
const campaignService = require("./service");

const create = asyncHandler(async (req, res) => ok(res, await campaignService.create(req.user.sub, req.body), "Campaign created"));
const accept = asyncHandler(async (req, res) => ok(res, await campaignService.accept(req.user.sub, req.body.campaignId), "Campaign accepted"));
const reject = asyncHandler(async (req, res) =>
  ok(res, await campaignService.reject(req.user.sub, req.body.campaignId, req.body.note || ""), "Campaign declined")
);
const vendor = asyncHandler(async (req, res) => ok(res, await campaignService.listForVendor(req.user.sub), "Vendor campaigns loaded"));
const influencer = asyncHandler(async (req, res) => ok(res, await campaignService.listForInfluencer(req.user.sub), "Influencer campaigns loaded"));
const admin = asyncHandler(async (req, res) => ok(res, await campaignService.listAll(), "Campaigns loaded"));

module.exports = { create, accept, reject, vendor, influencer, admin };
