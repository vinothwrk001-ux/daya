const { ok } = require("../../utils/apiResponse");
const { asyncHandler } = require("../../utils/asyncHandler");
const reelService = require("./service");

function getMeta(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

const listPublic = asyncHandler(async (req, res) => {
  const data = await reelService.listPublic({
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 12),
    sort: req.query.sort || "latest",
    category: req.query.category,
    tag: req.query.tag,
    userId: req.user?.sub,
  });
  return ok(res, data, "Reels retrieved");
});

const getPublic = asyncHandler(async (req, res) => {
  const data = await reelService.getPublicReel(req.params.reelId, req.user?.sub);
  return ok(res, data, "Reel retrieved");
});

const trackView = asyncHandler(async (req, res) => {
  const data = await reelService.trackView(req.params.reelId, {
    userId: req.user?.sub,
    sessionId: req.body.sessionId,
    viewDuration: req.body.viewDuration,
    videoDuration: req.body.videoDuration,
    ipAddress: req.ip,
  });
  return ok(res, data, "View tracked");
});

const like = asyncHandler(async (req, res) => {
  const data = await reelService.likeReel(req.params.reelId, req.user?.sub);
  return ok(res, data, "Reel liked");
});

const unlike = asyncHandler(async (req, res) => {
  const data = await reelService.unlikeReel(req.params.reelId, req.user?.sub);
  return ok(res, data, "Reel unliked");
});

const addComment = asyncHandler(async (req, res) => {
  const data = await reelService.addComment(req.params.reelId, req.user?.sub, req.body || {});
  return ok(res, data, "Comment added");
});

const listComments = asyncHandler(async (req, res) => {
  const data = await reelService.listComments(req.params.reelId, {
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 20),
  });
  return ok(res, data, "Comments retrieved");
});

const share = asyncHandler(async (req, res) => {
  const data = await reelService.shareReel(req.params.reelId, {
    userId: req.user?.sub,
    platform: req.body.platform,
    sessionId: req.body.sessionId,
  });
  return ok(res, data, "Share tracked");
});

const save = asyncHandler(async (req, res) => {
  const data = await reelService.saveReel(req.params.reelId, req.user?.sub);
  return ok(res, data, "Reel saved");
});

const unsave = asyncHandler(async (req, res) => {
  const data = await reelService.unsaveReel(req.params.reelId, req.user?.sub);
  return ok(res, data, "Reel unsaved");
});

const listSaved = asyncHandler(async (req, res) => {
  const data = await reelService.listSavedReels(req.user?.sub, {
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 12),
  });
  return ok(res, data, "Saved reels retrieved");
});

const trackProductClick = asyncHandler(async (req, res) => {
  const data = await reelService.trackProductClick(req.params.reelId, req.body.productId, {
    userId: req.user?.sub,
    sessionId: req.body.sessionId,
  });
  return ok(res, data, "Product click tracked");
});

const trackProductView = asyncHandler(async (req, res) => {
  const data = await reelService.trackProductView(req.params.reelId, req.body.productId, {
    userId: req.user?.sub,
    sessionId: req.body.sessionId,
  });
  return ok(res, data, "Product view tracked");
});

const deleteOwnComment = asyncHandler(async (req, res) => {
  const data = await reelService.deleteOwnComment(req.user?.sub, req.params.reelId, req.params.commentId);
  return ok(res, data, "Comment deleted");
});

const trackAddToCart = asyncHandler(async (req, res) => {
  const data = await reelService.trackAddToCart({
    reelId: req.body.reelId,
    productId: req.body.productId,
    sessionId: req.body.sessionId,
    userId: req.user?.sub,
  });
  return ok(res, data, "Add to cart tracked");
});

const listAdmin = asyncHandler(async (req, res) => {
  const data = await reelService.listAdmin({
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 20),
    status: req.query.status,
    search: req.query.search,
  });
  return ok(res, data, "Admin reels retrieved");
});

const getAdmin = asyncHandler(async (req, res) => {
  const data = await reelService.getAdminReel(req.params.reelId);
  return ok(res, data, "Admin reel retrieved");
});

const create = asyncHandler(async (req, res) => {
  const body = { ...(req.body || {}) };
  if (typeof body.associatedProducts === "string") {
    try {
      body.associatedProducts = JSON.parse(body.associatedProducts);
    } catch {
      body.associatedProducts = body.associatedProducts.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  if (typeof body.linkedProducts === "string") {
    try {
      body.linkedProducts = JSON.parse(body.linkedProducts);
    } catch {
      body.linkedProducts = [];
    }
  }
  if (typeof body.tags === "string" && body.tags.includes(",")) {
    body.tags = body.tags.split(",").map((item) => item.trim()).filter(Boolean);
  }
  const data = await reelService.createReel(req.user, body, req.files || {}, getMeta(req));
  return ok(res, data, "Reel created", 201);
});

const update = asyncHandler(async (req, res) => {
  const body = { ...(req.body || {}) };
  if (typeof body.associatedProducts === "string") {
    try {
      body.associatedProducts = JSON.parse(body.associatedProducts);
    } catch {
      body.associatedProducts = body.associatedProducts.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  if (typeof body.linkedProducts === "string") {
    try {
      body.linkedProducts = JSON.parse(body.linkedProducts);
    } catch {
      body.linkedProducts = [];
    }
  }
  if (typeof body.tags === "string" && body.tags.includes(",")) {
    body.tags = body.tags.split(",").map((item) => item.trim()).filter(Boolean);
  }
  const data = await reelService.updateReel(req.user, req.params.reelId, body, req.files || {}, getMeta(req));
  return ok(res, data, "Reel updated");
});

const remove = asyncHandler(async (req, res) => {
  const data = await reelService.deleteReel(req.user, req.params.reelId, getMeta(req));
  return ok(res, data, "Reel deleted");
});

const publish = asyncHandler(async (req, res) => {
  const data = await reelService.publishReel(req.user, req.params.reelId, getMeta(req));
  return ok(res, data, "Reel published");
});

const deleteComment = asyncHandler(async (req, res) => {
  const data = await reelService.deleteComment(req.user, req.params.reelId, req.params.commentId, getMeta(req));
  return ok(res, data, "Comment deleted");
});

const analytics = asyncHandler(async (req, res) => {
  const data = await reelService.getAnalyticsDashboard();
  return ok(res, data, "Reels analytics retrieved");
});

const attribution = asyncHandler(async (req, res) => {
  const data = await reelService.getAttributionDashboard({
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 20),
  });
  return ok(res, data, "Reels attribution retrieved");
});

const getReelProducts = asyncHandler(async (req, res) => {
  const data = await reelService.getReelProducts(req.params.reelId);
  return ok(res, data, "Reel products retrieved");
});

const getAdminReelProducts = asyncHandler(async (req, res) => {
  const data = await reelService.getReelProducts(req.params.reelId, { admin: true });
  return ok(res, data, "Reel products retrieved");
});

const setReelProducts = asyncHandler(async (req, res) => {
  const data = await reelService.setReelProducts(req.user, req.params.reelId, req.body || {}, getMeta(req));
  return ok(res, data, "Reel products updated");
});

const addReelProducts = asyncHandler(async (req, res) => {
  const data = await reelService.addReelProducts(req.user, req.params.reelId, req.body || {}, getMeta(req));
  return ok(res, data, "Reel products added", 201);
});

const removeReelProduct = asyncHandler(async (req, res) => {
  const data = await reelService.removeReelProduct(
    req.user,
    req.params.reelId,
    req.params.productId,
    getMeta(req)
  );
  return ok(res, data, "Reel product removed");
});

const trackProductWidgetOpen = asyncHandler(async (req, res) => {
  const data = await reelService.trackProductWidgetOpen(req.params.reelId, {
    userId: req.user?.sub,
    sessionId: req.body.sessionId,
  });
  return ok(res, data, "Product widget open tracked");
});

const reelPerformance = asyncHandler(async (req, res) => {
  const data = await reelService.getReelPerformanceDashboard({
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 20),
  });
  return ok(res, data, "Reel performance retrieved");
});

module.exports = {
  listPublic,
  getPublic,
  trackView,
  like,
  unlike,
  addComment,
  listComments,
  share,
  save,
  unsave,
  listSaved,
  trackProductClick,
  trackProductView,
  trackAddToCart,
  deleteOwnComment,
  listAdmin,
  getAdmin,
  create,
  update,
  remove,
  publish,
  deleteComment,
  analytics,
  attribution,
  reelPerformance,
  getReelProducts,
  getAdminReelProducts,
  setReelProducts,
  addReelProducts,
  removeReelProduct,
  trackProductWidgetOpen,
};
