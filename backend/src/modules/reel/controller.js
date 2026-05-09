const { ok } = require("../../utils/apiResponse");
const { asyncHandler } = require("../../utils/asyncHandler");
const reelService = require("./service");

const upload = asyncHandler(async (req, res) => ok(res, await reelService.upload(req.user.sub, req.body), "Reel uploaded"));
const publish = asyncHandler(async (req, res) => ok(res, await reelService.publish(req.user, req.body.reelId, req.body), "Reel updated"));
const feed = asyncHandler(async (req, res) => ok(res, await reelService.getFeed(req.query), "Reel feed loaded"));
const getById = asyncHandler(async (req, res) => ok(res, await reelService.getById(req.params.id), "Reel loaded"));
const influencerList = asyncHandler(async (req, res) => ok(res, await reelService.listForInfluencer(req.user.sub), "Influencer reels loaded"));
const influencerPaginated = asyncHandler(async (req, res) =>
  ok(res, await reelService.listForInfluencerPaginated(req.user.sub, req.query), "Influencer reels loaded")
);
const adminList = asyncHandler(async (req, res) => ok(res, await reelService.listAll(), "Reels loaded"));

module.exports = { upload, publish, feed, getById, influencerList, influencerPaginated, adminList };
