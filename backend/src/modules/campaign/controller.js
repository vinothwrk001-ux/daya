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
const marketplace = asyncHandler(async (req, res) => ok(res, await campaignService.listMarketplace(req.user.sub, req.query), "Campaign marketplace loaded"));
const apply = asyncHandler(async (req, res) => ok(res, await campaignService.apply(req.user.sub, req.params.campaignId, req.body), "Campaign application submitted"));
const save = asyncHandler(async (req, res) => ok(res, await campaignService.saveMarketplaceCampaign(req.user.sub, req.params.campaignId, req.body.saved !== false), "Campaign saved"));
const deliverable = asyncHandler(async (req, res) => ok(res, await campaignService.submitDeliverable(req.user.sub, req.params.campaignId, req.body), "Campaign deliverable submitted"));
const analytics = asyncHandler(async (req, res) => ok(res, await campaignService.marketplaceAnalytics(req.user.sub, req.query), "Campaign analytics loaded"));

module.exports = { create, accept, reject, vendor, influencer, admin, marketplace, apply, save, deliverable, analytics };
