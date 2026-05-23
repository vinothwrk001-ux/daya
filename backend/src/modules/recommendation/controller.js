const { ok } = require("../../utils/apiResponse");
const { asyncHandler } = require("../../utils/asyncHandler");
const recommendationService = require("./service");
const { enqueueRecommendationJob } = require("./job");

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
  const data = await enqueueRecommendationJob("rebuild", req.user);
  return ok(res, data, "Recommendation Rebuild Started", 202);
});

const clearCache = asyncHandler(async (req, res) => {
  const data = await enqueueRecommendationJob("cache_clear", req.user);
  return ok(res, data, "Cache Cleared Successfully", 202);
});

const getJob = asyncHandler(async (req, res) => {
  const data = await recommendationService.getJob(req.params.id);
  return ok(res, data, "Recommendation job retrieved");
});

const analytics = asyncHandler(async (req, res) => {
  const data = await recommendationService.getAnalyticsSummary({ days: req.query.days || 30 });
  return ok(res, data, "Recommendation analytics retrieved");
});

const getProductRecommendations = asyncHandler(async (req, res) => {
  const data = await recommendationService.getProductPageRecommendations(req.params.productId, req.user?.sub || null, req.query);
  return ok(res, data, "Product recommendations retrieved");
});

const frequentlyBought = asyncHandler(async (req, res) => {
  const productId = req.query.productId || req.params.productId;
  const data = productId
    ? await recommendationService.getFrequentlyBoughtTogether(productId, req.query)
    : { items: [] };
  return ok(res, data, "Frequently bought together recommendations retrieved");
});

const featured = asyncHandler(async (req, res) => {
  const data = await recommendationService.getFeaturedProducts(req.query);
  return ok(res, data, "Featured recommendations retrieved");
});

const trending = asyncHandler(async (req, res) => {
  const data = await recommendationService.getTrendingProducts(req.query);
  return ok(res, data, "Trending recommendations retrieved");
});

const related = asyncHandler(async (req, res) => {
  const productId = req.query.productId || req.params.productId;
  const data = productId
    ? await recommendationService.getRelatedProducts(productId, req.query)
    : { items: [] };
  return ok(res, data, "Related recommendations retrieved");
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
  getJob,
  analytics,
  getProductRecommendations,
  frequentlyBought,
  featured,
  trending,
  related,
  getCartRecommendations,
  getCheckoutRecommendations,
  getHomeRecommendations,
  trackRecentlyViewed,
  getRecentlyViewed,
  trackEvent,
};
