const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const categoryService = require("../services/category.service");

function getMeta(req) {
  return {
    actor: req.user,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

const getActiveCategories = asyncHandler(async (req, res) => {
  const categories = await categoryService.listActiveCategories();
  return ok(res, categories, "Categories loaded");
});

const getHomepageCategories = asyncHandler(async (req, res) => {
  const [categories, config] = await Promise.all([
    categoryService.listHomepageCategories(),
    categoryService.getCarouselConfig(),
  ]);
  return ok(res, { categories, config }, "Homepage categories loaded");
});

const getHeroBannerCategories = asyncHandler(async (req, res) => {
  const [categories, config] = await Promise.all([
    categoryService.listHeroBannerCategories(),
    categoryService.getHeroBannerConfig(),
  ]);
  return ok(res, { categories, config }, "Hero banner categories loaded");
});

const getCategoryBySlug = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryBySlug(req.params.slug);
  return ok(res, category, "Category loaded");
});

const trackCategoryEvent = asyncHandler(async (req, res) => {
  const data = await categoryService.trackCategoryEvent(req.params.id, {
    eventType: req.body.eventType,
    userId: req.user?.sub,
    sessionId: req.body.sessionId,
    productId: req.body.productId,
    orderId: req.body.orderId,
    revenue: req.body.revenue,
  });
  return ok(res, data, "Event tracked");
});

const getAdminCategories = asyncHandler(async (req, res) => {
  const categories = await categoryService.listAllCategories();
  return ok(res, categories, "Categories loaded");
});

const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body, getMeta(req));
  return ok(res, category, "Category created");
});

const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(req.params.id, req.body, getMeta(req));
  return ok(res, category, "Category updated");
});

const toggleCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.toggleCategory(req.params.id, req.body.isActive, getMeta(req));
  return ok(res, category, "Category updated");
});

const uploadCategoryMedia = asyncHandler(async (req, res) => {
  const category = await categoryService.uploadCategoryMedia(req.params.id, req.files || {}, getMeta(req));
  return ok(res, category, "Category media uploaded");
});

const getCarouselConfig = asyncHandler(async (req, res) => {
  const config = await categoryService.getCarouselConfig();
  return ok(res, config, "Carousel config loaded");
});

const updateCarouselConfig = asyncHandler(async (req, res) => {
  const config = await categoryService.updateCarouselConfig(req.body, req.user);
  return ok(res, config, "Carousel config updated");
});

const getHeroBannerConfig = asyncHandler(async (req, res) => {
  const config = await categoryService.getHeroBannerConfig();
  return ok(res, config, "Hero banner config loaded");
});

const updateHeroBannerConfig = asyncHandler(async (req, res) => {
  const config = await categoryService.updateHeroBannerConfig(req.body, req.user);
  return ok(res, config, "Hero banner config updated");
});

const getCategoryAnalytics = asyncHandler(async (req, res) => {
  const data = await categoryService.getCategoryAnalyticsSummary();
  return ok(res, data, "Category analytics loaded");
});

module.exports = {
  getActiveCategories,
  getHomepageCategories,
  getHeroBannerCategories,
  getCategoryBySlug,
  trackCategoryEvent,
  getAdminCategories,
  createCategory,
  updateCategory,
  toggleCategory,
  uploadCategoryMedia,
  getCarouselConfig,
  updateCarouselConfig,
  getHeroBannerConfig,
  updateHeroBannerConfig,
  getCategoryAnalytics,
};
