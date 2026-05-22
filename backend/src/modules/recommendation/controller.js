const { ok } = require("../../utils/apiResponse");
const { asyncHandler } = require("../../utils/asyncHandler");
const recommendationService = require("./service");

const getSettings = asyncHandler(async (req, res) => {
  const settings = await recommendationService.getSettings();
  return ok(res, settings, "Recommendation settings retrieved");
});

const updateSettings = asyncHandler(async (req, res) => {
  const settings = await recommendationService.updateSettings(req.body, req.user);
  return ok(res, settings, "Recommendation settings updated");
});

const preview = asyncHandler(async (req, res) => {
  const data = await recommendationService.preview(req.params.productId, req.user?.sub || null);
  return ok(res, data, "Recommendation preview generated");
});

const rebuild = asyncHandler(async (req, res) => {
  const data = await recommendationService.rebuildAll(req.user);
  return ok(res, data, "Recommendation rebuild completed");
});

const clearCache = asyncHandler(async (req, res) => {
  const data = await recommendationService.clearCache(req.user);
  return ok(res, data, "Recommendation cache cleared");
});

const analytics = asyncHandler(async (req, res) => {
  const data = await recommendationService.getAnalyticsSummary({ days: req.query.days || 30 });
  return ok(res, data, "Recommendation analytics retrieved");
});

const getProductRecommendations = asyncHandler(async (req, res) => {
  const data = await recommendationService.getProductPageRecommendations(req.params.productId, req.user?.sub || null, req.query);
  return ok(res, data, "Product recommendations retrieved");
});

const getCartRecommendations = asyncHandler(async (req, res) => {
  const productIds = String(req.query.productIds || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const [crossSell, personalized] = await Promise.all([
    recommendationService.getCrossSellProducts({ productIds }, req.query),
    req.user?.sub ? recommendationService.getPersonalizedRecommendations(req.user.sub, { limit: 6 }) : { items: [] },
  ]);
  return ok(
    res,
    {
      crossSell: crossSell.items || [],
      personalized: personalized.items || [],
    },
    "Cart recommendations retrieved"
  );
});

const getCheckoutRecommendations = asyncHandler(async (req, res) => {
  const productIds = String(req.query.productIds || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const [crossSell, recentlyViewed] = await Promise.all([
    recommendationService.getCrossSellProducts({ productIds }, { limit: 4 }),
    req.user?.sub ? recommendationService.getRecentlyViewed(req.user.sub, { limit: 6 }) : { items: [] },
  ]);
  return ok(
    res,
    {
      addOns: crossSell.items || [],
      recentlyViewed: recentlyViewed.items || [],
    },
    "Checkout recommendations retrieved"
  );
});

const getHomeRecommendations = asyncHandler(async (req, res) => {
  const data = await recommendationService.getHomeRecommendations(req.user?.sub || null, req.query);
  return ok(res, data, "Homepage recommendations retrieved");
});

const trackRecentlyViewed = asyncHandler(async (req, res) => {
  await recommendationService.recordRecentlyViewed(req.user?.sub || null, req.body.productId);
  return ok(res, { tracked: true }, "Recently viewed tracked");
});

const getRecentlyViewed = asyncHandler(async (req, res) => {
  const data = await recommendationService.getRecentlyViewed(req.user?.sub || null, req.query);
  return ok(res, data, "Recently viewed retrieved");
});

const trackEvent = asyncHandler(async (req, res) => {
  const data = await recommendationService.logEvent({
    ...req.body,
    userId: req.user?.sub || null,
  });
  return ok(res, data, "Recommendation event tracked");
});

module.exports = {
  getSettings,
  updateSettings,
  preview,
  rebuild,
  clearCache,
  analytics,
  getProductRecommendations,
  getCartRecommendations,
  getCheckoutRecommendations,
  getHomeRecommendations,
  trackRecentlyViewed,
  getRecentlyViewed,
  trackEvent,
};
