const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const reviewService = require("../services/review.service");

function getMeta(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  };
}

function actor(req) {
  return {
    sub: req.user?.sub,
    role: req.user?.role,
  };
}

const createReview = asyncHandler(async (req, res) => {
  const review = await reviewService.submitReview(req.user.sub, req.body, req.files || [], getMeta(req));
  return ok(res, review, "Review submitted for moderation", 201);
});

const listProductReviews = asyncHandler(async (req, res) => {
  const result = await reviewService.listProductReviews(req.params.id, req.query);
  return ok(res, result, "Product reviews loaded");
});

const getReviewSummaries = asyncHandler(async (req, res) => {
  const productIds = String(req.query.productIds || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const result = await reviewService.getSummaries(productIds);
  return ok(res, result, "Review summaries loaded");
});

const listVendorReviews = asyncHandler(async (req, res) => {
  const result = await reviewService.listVendorReviews(req.user.sub, req.query);
  return ok(res, result, "Vendor reviews loaded");
});

const listAdminReviews = asyncHandler(async (req, res) => {
  const result = await reviewService.listAdminReviews(req.query);
  return ok(res, result, "Reviews loaded");
});

const getAdminDashboard = asyncHandler(async (req, res) => {
  const result = await reviewService.getAdminDashboard();
  return ok(res, result, "Review dashboard loaded");
});

const updateReview = asyncHandler(async (req, res) => {
  const result = await reviewService.updateReview(actor(req), req.params.id, req.body, getMeta(req));
  return ok(res, result, "Review updated");
});

const deleteReview = asyncHandler(async (req, res) => {
  const result = await reviewService.deleteReview(actor(req), req.params.id, getMeta(req));
  return ok(res, result, "Review deleted");
});

const replyToReview = asyncHandler(async (req, res) => {
  const result = await reviewService.reply(actor(req), req.params.id, req.body, getMeta(req));
  return ok(res, result, "Vendor reply saved");
});

const voteReview = asyncHandler(async (req, res) => {
  const result = await reviewService.vote(req.user.sub, req.params.id, req.body);
  return ok(res, result, "Review vote saved");
});

const reportReview = asyncHandler(async (req, res) => {
  const result = await reviewService.report(req.user.sub, req.params.id, req.body, getMeta(req));
  return ok(res, result, "Review report submitted", 201);
});

module.exports = {
  createReview,
  listProductReviews,
  getReviewSummaries,
  listVendorReviews,
  listAdminReviews,
  getAdminDashboard,
  updateReview,
  deleteReview,
  replyToReview,
  voteReview,
  reportReview,
};
