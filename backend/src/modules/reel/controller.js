const { ok } = require("../../utils/apiResponse");
const { asyncHandler } = require("../../utils/asyncHandler");
const reelService = require("./service");

const upload = asyncHandler(async (req, res) => ok(res, await reelService.upload(req.user.sub, req.body), "Reel uploaded"));
const uploadMedia = asyncHandler(async (req, res) => {
  const video = req.files?.video?.[0];
  const thumbnail = req.files?.thumbnail?.[0];
  return ok(res, {
    videoUrl: video ? `/uploads/reels/${video.filename}` : "",
    thumbnailUrl: thumbnail ? `/uploads/reels/${thumbnail.filename}` : "",
  }, "Content media uploaded", 201);
});
const publish = asyncHandler(async (req, res) => ok(res, await reelService.publish(req.user, req.body.reelId, req.body), "Reel updated"));
const feed = asyncHandler(async (req, res) => ok(res, await reelService.getFeed(req.query, req.user?.sub), "Reel feed loaded"));
const getById = asyncHandler(async (req, res) => ok(res, await reelService.getById(req.params.id, req.user?.sub), "Reel loaded"));
const engagement = asyncHandler(async (req, res) => ok(res, await reelService.getEngagement(req.params.id, req.user?.sub), "Reel engagement loaded"));
const like = asyncHandler(async (req, res) => ok(res, await reelService.toggleLike(req.user.sub, req.params.id), "Reel like updated"));
const save = asyncHandler(async (req, res) => ok(res, await reelService.toggleSave(req.user.sub, req.params.id, req.body), "Reel save updated"));
const comments = asyncHandler(async (req, res) => ok(res, await reelService.listComments(req.params.id, req.query, req.user?.sub), "Reel comments loaded"));
const comment = asyncHandler(async (req, res) => ok(res, await reelService.createComment(req.user.sub, req.params.id, req.body), "Comment added", 201));
const reply = asyncHandler(async (req, res) => ok(res, await reelService.createReply(req.user.sub, req.params.id, req.params.commentId, req.body), "Reply added", 201));
const commentLike = asyncHandler(async (req, res) => ok(res, await reelService.toggleCommentLike(req.user.sub, req.params.id, req.params.commentId), "Comment like updated"));
const commentReport = asyncHandler(async (req, res) => ok(res, await reelService.reportComment(req.user.sub, req.params.id, req.params.commentId, req.body), "Comment reported"));
const share = asyncHandler(async (req, res) => ok(res, await reelService.shareReel(req.user, req.params.id, req.body), "Reel share tracked"));
const view = asyncHandler(async (req, res) => ok(res, await reelService.recordView(req.user, req.params.id, req.body), "Reel view tracked"));
const storeVisit = asyncHandler(async (req, res) => ok(res, await reelService.recordStoreVisit(req.user, req.params.id, req.body), "Store visit tracked"));
const productClick = asyncHandler(async (req, res) => ok(res, await reelService.recordProductClick(req.user, req.params.id, req.body), "Product click tracked"));
const follow = asyncHandler(async (req, res) => ok(res, await reelService.followCreator(req.user.sub, req.params.id, req.body), "Creator follow updated"));
const adjacent = asyncHandler(async (req, res) => ok(res, await reelService.getAdjacent(req.params.id), "Adjacent reels loaded"));
const influencerList = asyncHandler(async (req, res) => ok(res, await reelService.listForInfluencer(req.user.sub), "Influencer reels loaded"));
const influencerPaginated = asyncHandler(async (req, res) =>
  ok(res, await reelService.listForInfluencerPaginated(req.user.sub, req.query), "Influencer reels loaded")
);
const contentList = asyncHandler(async (req, res) => ok(res, await reelService.listContent(req.user.sub, req.query), "Influencer content loaded"));
const contentUpdate = asyncHandler(async (req, res) => ok(res, await reelService.updateContent(req.user.sub, req.params.id, req.body), "Influencer content updated"));
const contentDelete = asyncHandler(async (req, res) => ok(res, await reelService.deleteContent(req.user.sub, req.params.id), "Influencer content deleted"));
const contentAnalytics = asyncHandler(async (req, res) => ok(res, await reelService.getContentAnalytics(req.user.sub, req.query), "Content analytics loaded"));
const mediaLibrary = asyncHandler(async (req, res) => ok(res, await reelService.listMediaLibrary(req.user.sub, req.query), "Media library loaded"));
const liveSessions = asyncHandler(async (req, res) => ok(res, await reelService.listLiveSessions(req.user.sub, req.query), "Live sessions loaded"));
const createLiveSession = asyncHandler(async (req, res) => ok(res, await reelService.saveLiveSession(req.user.sub, req.body), "Live session saved", 201));
const adminList = asyncHandler(async (req, res) => ok(res, await reelService.listAll(), "Reels loaded"));

module.exports = { upload, uploadMedia, publish, feed, getById, engagement, like, save, comments, comment, reply, commentLike, commentReport, share, view, storeVisit, productClick, follow, adjacent, influencerList, influencerPaginated, contentList, contentUpdate, contentDelete, contentAnalytics, mediaLibrary, liveSessions, createLiveSession, adminList };
