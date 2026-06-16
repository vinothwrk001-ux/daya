const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const homepageBannerService = require("../services/homepage-banner.service");

function getMeta(req) {
  return {
    actor: req.user,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

const listPublicBanners = asyncHandler(async (req, res) => {
  const data = await homepageBannerService.listPublicBanners();
  return ok(res, data, "Homepage banners loaded");
});

const trackBannerEvent = asyncHandler(async (req, res) => {
  const data = await homepageBannerService.trackEvent(req.params.id, {
    ...req.body,
    userId: req.user?.sub,
  });
  return ok(res, data, "Event tracked");
});

const listAdminBanners = asyncHandler(async (req, res) => {
  const banners = await homepageBannerService.listAdminBanners();
  return ok(res, banners, "Banners loaded");
});

const getAdminBanner = asyncHandler(async (req, res) => {
  const banner = await homepageBannerService.getAdminBannerById(req.params.id);
  return ok(res, banner, "Banner loaded");
});

const createBanner = asyncHandler(async (req, res) => {
  const banner = await homepageBannerService.createBanner(req.body, getMeta(req));
  return ok(res, banner, "Banner created", 201);
});

const updateBanner = asyncHandler(async (req, res) => {
  const banner = await homepageBannerService.updateBanner(req.params.id, req.body, getMeta(req));
  return ok(res, banner, "Banner updated");
});

const deleteBanner = asyncHandler(async (req, res) => {
  const result = await homepageBannerService.deleteBanner(req.params.id, getMeta(req));
  return ok(res, result, "Banner deleted");
});

const assignCategories = asyncHandler(async (req, res) => {
  const banner = await homepageBannerService.assignCategories(
    req.params.id,
    req.body.categories,
    getMeta(req)
  );
  return ok(res, banner, "Banner categories updated");
});

const removeCategory = asyncHandler(async (req, res) => {
  const banner = await homepageBannerService.removeCategory(
    req.params.id,
    req.params.categoryId,
    getMeta(req)
  );
  return ok(res, banner, "Category removed from banner");
});

const uploadBannerImages = asyncHandler(async (req, res) => {
  const banner = await homepageBannerService.uploadBannerImages(req.params.id, req.files || {}, getMeta(req));
  return ok(res, banner, "Banner images uploaded");
});

const getAnalyticsSummary = asyncHandler(async (req, res) => {
  const data = await homepageBannerService.getAnalyticsSummary();
  return ok(res, data, "Banner analytics loaded");
});

const getSettings = asyncHandler(async (req, res) => {
  const settings = await homepageBannerService.getSettings();
  return ok(res, settings, "Banner settings loaded");
});

const updateSettings = asyncHandler(async (req, res) => {
  const settings = await homepageBannerService.updateSettings(req.body, getMeta(req));
  return ok(res, settings, "Banner settings updated");
});

module.exports = {
  listPublicBanners,
  trackBannerEvent,
  listAdminBanners,
  getAdminBanner,
  createBanner,
  updateBanner,
  deleteBanner,
  assignCategories,
  removeCategory,
  uploadBannerImages,
  getAnalyticsSummary,
  getSettings,
  updateSettings,
};
