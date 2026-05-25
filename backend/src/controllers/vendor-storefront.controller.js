const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const vendorStorefrontService = require("../services/vendor-storefront.service");

function customerId(req) {
  return req.user?.role === "user" ? req.user.sub : null;
}

const getStorefront = asyncHandler(async (req, res) => {
  const result = await vendorStorefrontService.getStorefront(req.params.slug, customerId(req));
  return ok(res, result, "Vendor storefront loaded");
});

const getProducts = asyncHandler(async (req, res) => {
  const result = await vendorStorefrontService.getVendorProducts(req.params.slug, req.query, customerId(req));
  return ok(res, result, "Vendor products loaded");
});

const getReviews = asyncHandler(async (req, res) => {
  const result = await vendorStorefrontService.getVendorReviews(req.params.slug, req.query, customerId(req));
  return ok(res, result, "Vendor reviews loaded");
});

const getFollowers = asyncHandler(async (req, res) => {
  const result = await vendorStorefrontService.listFollowers(req.params.slug, req.query);
  return ok(res, result, "Vendor followers loaded");
});

const follow = asyncHandler(async (req, res) => {
  const result = await vendorStorefrontService.followVendor(req.params.slug, req.user.sub);
  return ok(res, result, "Store followed");
});

const unfollow = asyncHandler(async (req, res) => {
  const result = await vendorStorefrontService.unfollowVendor(req.params.slug, req.user.sub);
  return ok(res, result, "Store unfollowed");
});

const track = asyncHandler(async (req, res) => {
  const result = await vendorStorefrontService.recordStoreEvent(req.params.slug, req.body || {}, req);
  return ok(res, result, "Store event tracked", 201);
});

const myFollowedStores = asyncHandler(async (req, res) => {
  const result = await vendorStorefrontService.listCustomerFollowedStores(req.user.sub, req.query);
  return ok(res, result, "Followed stores loaded");
});

const vendorAnalytics = asyncHandler(async (req, res) => {
  const result = await vendorStorefrontService.getVendorAnalytics(req.user.sub, req.query);
  return ok(res, result, "Vendor storefront analytics loaded");
});

const updateVendorStoreSettings = asyncHandler(async (req, res) => {
  const result = await vendorStorefrontService.updateVendorStoreSettings(req.user.sub, req.body || {});
  return ok(res, result, "Vendor store settings updated");
});

const adminModerateStore = asyncHandler(async (req, res) => {
  const result = await vendorStorefrontService.adminUpdateStoreVisibility(req.params.id, req.body || {});
  return ok(res, result, "Vendor store moderation updated");
});

const adminStoreAnalytics = asyncHandler(async (req, res) => {
  const result = await vendorStorefrontService.getAnalyticsForVendorId(req.params.id, req.query);
  return ok(res, result, "Vendor store analytics loaded");
});

module.exports = {
  getStorefront,
  getProducts,
  getReviews,
  getFollowers,
  follow,
  unfollow,
  track,
  myFollowedStores,
  vendorAnalytics,
  updateVendorStoreSettings,
  adminModerateStore,
  adminStoreAnalytics,
};
