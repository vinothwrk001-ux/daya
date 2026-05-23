const mongoose = require("mongoose");
const { Product } = require("../../models/Product");
const { Order } = require("../../models/Order");
const { Cart } = require("../../models/Cart");
const { Wishlist } = require("../../models/Wishlist");
const { Review } = require("../../models/Review");
const { AppError } = require("../../utils/AppError");
const auditService = require("../../services/audit.service");
const {
  RecommendationSettings,
  RelatedProductCache,
  BundleRelationship,
  CrossSellRule,
  UpsellRule,
  RecentlyViewed,
  RecommendationAnalytics,
  RecommendationLog,
  RecommendationJob,
} = require("./models");
const cache = require("./cache");

const DEFAULT_SETTINGS_KEY = "default";
const PUBLIC_PRODUCT_QUERY = { status: "APPROVED", isActive: true };
const CACHE_PREFIXES = ["related:product:", "bundle:product:", "crosssell:product:", "upsell:product:", "trending", "featured", "personalized:user:"];

function normalizeObjectId(value) {
  if (!value) return null;
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

function getBrandValue(product = {}) {
  return String(
    product?.attributes?.brand ||
      product?.extraDetails?.brand ||
      product?.modulesData?.brand ||
      product?.sellerId?._id ||
      product?.sellerId ||
      ""
  )
    .trim()
    .toLowerCase();
}

function getNormalizedAttributes(product = {}) {
  const source = product?.attributes && typeof product.attributes.toObject === "function"
    ? product.attributes.toObject()
    : product?.attributes || {};
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [String(key).toLowerCase(), String(value || "").trim().toLowerCase()])
  );
}

function normalizeWeightMap(map = {}) {
  const entries = Object.entries(map || {}).map(([key, value]) => [key, Math.max(0, Number(value || 0))]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (!total) return Object.fromEntries(entries);
  return Object.fromEntries(entries.map(([key, value]) => [key, value / total]));
}

function getProductPrice(product = {}) {
  return Number(product.discountPrice || product.price || 0);
}

function getPriceSimilarity(baseProduct, candidateProduct, settings) {
  const basePrice = getProductPrice(baseProduct);
  const candidatePrice = getProductPrice(candidateProduct);
  if (!basePrice || !candidatePrice) return 0;

  const mode = settings?.priceSimilarity?.mode || "PERCENT";
  const rangeValue = Number(settings?.priceSimilarity?.rangeValue || 20);
  const delta = Math.abs(basePrice - candidatePrice);
  const allowedDelta = mode === "ABSOLUTE" ? rangeValue : basePrice * (rangeValue / 100);
  if (!allowedDelta) return 0;
  return Math.max(0, 1 - delta / allowedDelta);
}

function calculatePopularityScore(product, weights) {
  const normalizedWeights = normalizeWeightMap(weights);
  const views = Number(product?.analytics?.views || 0);
  const sales = Number(product?.analytics?.salesCount || 0);
  const wishlist = Number(product?.recommendationSignals?.wishlistCount || 0);
  const cartAdds = Number(product?.recommendationSignals?.cartCount || 0);
  const reviewCount = Number(product?.ratings?.totalReviews || 0);
  const rating = Math.min(5, Number(product?.ratings?.averageRating || 0)) / 5;
  const conversionRate = Math.min(1, Number(product?.recommendationSignals?.conversionRate || 0));

  return (
    Math.log10(views + 1) * (normalizedWeights.views || 0) +
    Math.log10(sales + 1) * (normalizedWeights.sales || 0) +
    Math.log10(wishlist + 1) * (normalizedWeights.wishlist || 0) +
    Math.log10(cartAdds + 1) * (normalizedWeights.cartAdds || 0) +
    Math.log10(reviewCount + 1) * (normalizedWeights.reviewCount || 0) +
    rating * (normalizedWeights.rating || 0) +
    conversionRate * (normalizedWeights.conversionRate || 0)
  );
}

function applyRuleConditions(product, rules = []) {
  return rules.every((rule) => {
    const candidateValue = rule.field.includes(".")
      ? rule.field.split(".").reduce((acc, key) => acc?.[key], product)
      : product?.[rule.field] ?? product?.attributes?.[rule.field];

    switch (rule.operator) {
      case "eq":
        return String(candidateValue || "").toLowerCase() === String(rule.value || "").toLowerCase();
      case "gt":
        return Number(candidateValue || 0) > Number(rule.value || 0);
      case "gte":
        return Number(candidateValue || 0) >= Number(rule.value || 0);
      case "lt":
        return Number(candidateValue || 0) < Number(rule.value || 0);
      case "lte":
        return Number(candidateValue || 0) <= Number(rule.value || 0);
      case "in":
        return Array.isArray(rule.value) && rule.value.map(String).includes(String(candidateValue));
      default:
        return true;
    }
  });
}

class RecommendationService {
  async getSettings() {
    let settings = await RecommendationSettings.findOne({ singletonKey: DEFAULT_SETTINGS_KEY });
    if (!settings) {
      settings = await RecommendationSettings.create({ singletonKey: DEFAULT_SETTINGS_KEY });
    }
    return settings;
  }

  async updateSettings(payload = {}, actor) {
    const settings = await this.getSettings();
    Object.assign(settings, payload || {});
    const totalWeight =
      Number(settings.weights.category || 0) +
      Number(settings.weights.brand || 0) +
      Number(settings.weights.attribute || 0) +
      Number(settings.weights.price || 0) +
      Number(settings.weights.sales || 0) +
      Number(settings.weights.rating || 0);

    if (totalWeight !== 100) {
      throw new AppError("Recommendation weights must total 100", 400, "INVALID_RECOMMENDATION_WEIGHTS");
    }

    await settings.save();
    await auditService.log({
      actor,
      action: "recommendation.settings.update",
      entityType: "RecommendationSettings",
      entityId: settings._id,
      metadata: { payload },
    });
    return settings;
  }

  async enrichProductsWithSignals(products = []) {
    if (!products.length) return [];
    const productIds = products.map((product) => product._id);
    const [wishlistCounts, cartCounts, paidOrderCounts] = await Promise.all([
      Wishlist.aggregate([{ $match: { productId: { $in: productIds } } }, { $group: { _id: "$productId", count: { $sum: 1 } } }]),
      Cart.aggregate([
        { $unwind: "$items" },
        { $match: { "items.productId": { $in: productIds } } },
        { $group: { _id: "$items.productId", count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { paymentStatus: "Paid", isActive: true } },
        { $unwind: "$items" },
        { $match: { "items.productId": { $in: productIds } } },
        { $group: { _id: "$items.productId", count: { $sum: 1 } } },
      ]),
    ]);

    const wishlistMap = new Map(wishlistCounts.map((item) => [String(item._id), Number(item.count || 0)]));
    const cartMap = new Map(cartCounts.map((item) => [String(item._id), Number(item.count || 0)]));
    const orderMap = new Map(paidOrderCounts.map((item) => [String(item._id), Number(item.count || 0)]));

    return products.map((product) => {
      const views = Number(product?.analytics?.views || 0);
      const sales = Number(product?.analytics?.salesCount || 0);
      const paidOrders = orderMap.get(String(product._id)) || 0;
      const conversionRate = views > 0 ? Math.min(1, paidOrders / views) : 0;
      return {
        ...product.toObject?.() || product,
        recommendationSignals: {
          wishlistCount: wishlistMap.get(String(product._id)) || 0,
          cartCount: cartMap.get(String(product._id)) || 0,
          conversionRate,
        },
      };
    });
  }

  buildRelatedScore(baseProduct, candidate, settings, overrideWeights = null) {
    const weights = normalizeWeightMap(overrideWeights || settings?.weights || {});
    const reasons = [];
    let score = 0;

    const sameCategory = String(candidate.categoryId || candidate.category) === String(baseProduct.categoryId || baseProduct.category);
    if (sameCategory) {
      score += 1 * (weights.category || 0);
      reasons.push("Category match");
    }

    const baseBrand = getBrandValue(baseProduct);
    const candidateBrand = getBrandValue(candidate);
    const sameBrand = baseBrand && candidateBrand && baseBrand === candidateBrand;
    if (sameBrand) {
      score += 1 * (weights.brand || 0);
      reasons.push("Brand match");
    }

    const baseAttributes = getNormalizedAttributes(baseProduct);
    const candidateAttributes = getNormalizedAttributes(candidate);
    const configuredKeys = Array.isArray(settings?.attributeKeys) ? settings.attributeKeys : [];
    const attributeMatches = configuredKeys.filter((key) => baseAttributes[key] && candidateAttributes[key] && baseAttributes[key] === candidateAttributes[key]);
    const attributeScore = configuredKeys.length ? attributeMatches.length / configuredKeys.length : 0;
    if (attributeMatches.length) {
      score += attributeScore * (weights.attribute || 0);
      reasons.push(`Attribute match (${attributeMatches.join(", ")})`);
    }

    const priceScore = getPriceSimilarity(baseProduct, candidate, settings);
    if (priceScore > 0) {
      score += priceScore * (weights.price || 0);
      reasons.push("Price similarity");
    }

    const salesRatio = Math.min(1, Number(candidate?.analytics?.salesCount || 0) / Math.max(1, Number(baseProduct?.analytics?.salesCount || 1)));
    if (salesRatio > 0) {
      score += salesRatio * (weights.sales || 0);
    }

    const ratingScore = Math.min(1, Number(candidate?.ratings?.averageRating || 0) / 5);
    if (ratingScore > 0) {
      score += ratingScore * (weights.rating || 0);
    }

    return {
      score,
      reasons,
      breakdown: {
        category: sameCategory ? weights.category || 0 : 0,
        brand: sameBrand ? weights.brand || 0 : 0,
        attribute: attributeScore * (weights.attribute || 0),
        price: priceScore * (weights.price || 0),
        sales: salesRatio * (weights.sales || 0),
        rating: ratingScore * (weights.rating || 0),
      },
    };
  }

  async getBaseCandidates(baseProductId, limit = 50) {
    const baseProduct = await Product.findById(baseProductId).lean();
    if (!baseProduct) {
      throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
    }

    const candidateQuery = {
      ...PUBLIC_PRODUCT_QUERY,
      _id: { $ne: baseProduct._id },
      $or: [
        { categoryId: baseProduct.categoryId || null },
        { category: baseProduct.category || "" },
        { sellerId: baseProduct.sellerId || null },
      ],
    };

    const rawCandidates = await Product.find(candidateQuery)
      .sort({ "analytics.salesCount": -1, "ratings.averageRating": -1, createdAt: -1 })
      .limit(Math.max(limit, 20))
      .lean();

    return {
      baseProduct,
      candidates: await this.enrichProductsWithSignals(rawCandidates),
    };
  }

  async getRelatedProducts(productId, options = {}) {
    const settings = await this.getSettings();
    if (!settings.enabled.related) return { items: [], scoreBreakdown: {} };
    const limit = Number(options.limit || settings.limits.related || 8);
    const cacheKey = `related:product:${productId}:limit:${limit}`;
    const cached = await cache.getJson(cacheKey);
    if (cached && !options.skipCache) return cached;

    const { baseProduct, candidates } = await this.getBaseCandidates(productId, limit * 6);
    const scored = candidates
      .map((candidate) => ({
        product: candidate,
        ...this.buildRelatedScore(baseProduct, candidate, settings),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const payload = {
      items: scored.map((item) => ({ ...item.product, recommendationScore: item.score, recommendationReasons: item.reasons })),
      scoreBreakdown: Object.fromEntries(scored.map((item) => [String(item.product._id), item.breakdown])),
    };
    await cache.setJson(cacheKey, payload, settings.cacheTtlSeconds.related || 3600);
    await RelatedProductCache.findOneAndUpdate(
      { recommendationType: "related", productId },
      {
        $set: {
          items: scored.map((item) => ({
            productId: item.product._id,
            score: item.score,
            reasons: item.reasons,
            metadata: item.breakdown,
          })),
          scoreBreakdown: payload.scoreBreakdown,
          expiresAt: new Date(Date.now() + (settings.cacheTtlSeconds.related || 3600) * 1000),
          lastComputedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );
    return payload;
  }

  async getSimilarProducts(productId, options = {}) {
    const settings = await this.getSettings();
    if (!settings.enabled.similar) return { items: [], scoreBreakdown: {} };
    const similarWeights = {
      ...settings.weights.toObject?.() || settings.weights,
      attribute: 35,
      brand: 20,
      category: 25,
      price: 10,
      sales: 5,
      rating: 5,
    };
    const limit = Number(options.limit || settings.limits.similar || 8);
    const { baseProduct, candidates } = await this.getBaseCandidates(productId, limit * 6);
    const scored = candidates
      .map((candidate) => ({
        product: candidate,
        ...this.buildRelatedScore(baseProduct, candidate, settings, similarWeights),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return {
      items: scored.map((item) => ({ ...item.product, recommendationScore: item.score, recommendationReasons: item.reasons })),
      scoreBreakdown: Object.fromEntries(scored.map((item) => [String(item.product._id), item.breakdown])),
    };
  }

  async rebuildBundleRelationships() {
    const orders = await Order.find({ isActive: true, paymentStatus: "Paid", "items.1": { $exists: true } })
      .select("items totalAmount createdAt")
      .lean();

    const stats = new Map();
    for (const order of orders) {
      const items = (order.items || []).map((item) => ({ ...item, productId: String(item.productId) }));
      for (let i = 0; i < items.length; i += 1) {
        for (let j = 0; j < items.length; j += 1) {
          if (i === j) continue;
          const key = `${items[i].productId}:${items[j].productId}`;
          const current = stats.get(key) || {
            baseProductId: items[i].productId,
            associatedProductId: items[j].productId,
            frequencyScore: 0,
            revenueContribution: 0,
            orderCount: 0,
            lastPurchasedAt: null,
          };
          current.frequencyScore += Number(items[j].quantity || 1);
          current.revenueContribution += Number(items[j].price || 0) * Number(items[j].quantity || 1);
          current.orderCount += 1;
          current.lastPurchasedAt = order.createdAt;
          stats.set(key, current);
        }
      }
    }

    const operations = [...stats.values()].map((item) => ({
      updateOne: {
        filter: {
          baseProductId: item.baseProductId,
          associatedProductId: item.associatedProductId,
        },
        update: {
          $set: {
            frequencyScore: item.frequencyScore,
            revenueContribution: item.revenueContribution,
            bundleRevenue: item.revenueContribution,
            orderCount: item.orderCount,
            conversionRate: item.orderCount ? 1 : 0,
            relationshipStrength: Math.log10(item.frequencyScore + 1) + Math.log10(item.revenueContribution + 1),
            lastPurchasedAt: item.lastPurchasedAt,
          },
        },
        upsert: true,
      },
    }));

    if (operations.length) {
      await BundleRelationship.bulkWrite(operations);
    }

    return {
      rebuiltRelationships: operations.length,
    };
  }

  async getFrequentlyBoughtTogether(productId, options = {}) {
    const settings = await this.getSettings();
    if (!settings.enabled.frequentlyBoughtTogether) return { items: [], bundleTotal: 0 };
    const limit = Number(options.limit || settings.limits.frequentlyBoughtTogether || 3);
    const cacheKey = `bundle:product:${productId}:limit:${limit}`;
    const cached = await cache.getJson(cacheKey);
    if (cached && !options.skipCache) return cached;

    let relationships = await BundleRelationship.find({ baseProductId: productId })
      .sort({ relationshipStrength: -1, frequencyScore: -1 })
      .limit(limit)
      .lean();

    if (!relationships.length) {
      const fallback = await this.getRelatedProducts(productId, { limit });
      return { items: fallback.items || [], bundleTotal: (fallback.items || []).reduce((sum, item) => sum + getProductPrice(item), 0) };
    }

    const productIds = relationships.map((item) => item.associatedProductId);
    const products = await Product.find({ ...PUBLIC_PRODUCT_QUERY, _id: { $in: productIds } }).lean();
    const map = new Map(products.map((product) => [String(product._id), product]));
    const items = relationships
      .map((item) => {
        const product = map.get(String(item.associatedProductId));
        if (!product) return null;
        return {
          ...product,
          bundleScore: item.relationshipStrength,
          bundleMeta: item,
        };
      })
      .filter(Boolean);

    const bundleTotal = items.reduce((sum, item) => sum + getProductPrice(item), 0);
    const payload = { items, bundleTotal };
    await cache.setJson(cacheKey, payload, settings.cacheTtlSeconds.bundle || 3600);
    return payload;
  }

  async getCrossSellProducts(context = {}, options = {}) {
    const settings = await this.getSettings();
    if (!settings.enabled.crossSell) return { items: [] };
    const productIds = (context.productIds || []).map((id) => String(id));
    if (!productIds.length) return { items: [] };
    const limit = Number(options.limit || settings.limits.crossSell || 6);
    const sourceProducts = await Product.find({ _id: { $in: productIds } }).lean();
    const sourceBrands = [...new Set(sourceProducts.map(getBrandValue).filter(Boolean))];
    const sourceCategories = sourceProducts.map((product) => product.categoryId).filter(Boolean);
    const manualRules = await CrossSellRule.find({ enabled: true }).sort({ priority: 1, updatedAt: -1 }).lean();

    const manualProductIds = new Set();
    for (const rule of manualRules) {
      const matchesProduct = rule.sourceProductIds?.some((id) => productIds.includes(String(id)));
      const matchesCategory = rule.sourceCategoryIds?.some((id) => sourceCategories.some((categoryId) => String(categoryId) === String(id)));
      const matchesBrand = rule.sourceBrands?.some((brand) => sourceBrands.includes(String(brand).toLowerCase()));
      if (matchesProduct || matchesCategory || matchesBrand || applyRuleConditions(sourceProducts[0] || {}, rule.conditions)) {
        (rule.targetProductIds || []).forEach((id) => manualProductIds.add(String(id)));
      }
    }

    const bundleSuggestions = await BundleRelationship.find({ baseProductId: { $in: productIds } })
      .sort({ relationshipStrength: -1 })
      .limit(limit * 2)
      .lean();
    bundleSuggestions.forEach((item) => manualProductIds.add(String(item.associatedProductId)));

    const items = await Product.find({
      ...PUBLIC_PRODUCT_QUERY,
      _id: { $in: [...manualProductIds].filter((id) => !productIds.includes(id)) },
    })
      .limit(limit)
      .lean();
    return { items };
  }

  async getUpsellProducts(productId, options = {}) {
    const settings = await this.getSettings();
    if (!settings.enabled.upsell) return { items: [] };
    const limit = Number(options.limit || settings.limits.upsell || 4);
    const cacheKey = `upsell:product:${productId}:limit:${limit}`;
    const cached = await cache.getJson(cacheKey);
    if (cached && !options.skipCache) return cached;

    const baseProduct = await Product.findById(productId).lean();
    if (!baseProduct) throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
    const basePrice = getProductPrice(baseProduct);
    const minPrice = basePrice * (1 + Number(settings.upsellRules.minUpgradePercent || 5) / 100);
    const maxPrice = basePrice * (1 + Number(settings.upsellRules.maxUpgradePercent || 35) / 100);
    const brand = getBrandValue(baseProduct);

    let query = {
      ...PUBLIC_PRODUCT_QUERY,
      _id: { $ne: baseProduct._id },
      price: { $gte: minPrice, $lte: maxPrice },
    };
    if (settings.upsellRules.requireCategoryMatch) {
      query.categoryId = baseProduct.categoryId || undefined;
      query.category = query.categoryId ? undefined : baseProduct.category;
    }

    let candidates = await Product.find(query)
      .sort({ price: 1, "ratings.averageRating": -1, "analytics.salesCount": -1 })
      .limit(limit * 5)
      .lean();

    if (settings.upsellRules.requireBrandMatch && brand) {
      candidates = candidates.filter((item) => getBrandValue(item) === brand);
    }
    if (settings.upsellRules.requireInventory) {
      candidates = candidates.filter((item) => Number(item.stock || 0) > 0);
    }

    const rules = await UpsellRule.find({ enabled: true }).sort({ priority: 1 }).lean();
    const ruleMatches = rules
      .filter((rule) => !rule.sourceProductIds.length || rule.sourceProductIds.some((id) => String(id) === String(productId)))
      .flatMap((rule) => rule.targetProductIds || []);
    if (ruleMatches.length) {
      const manual = await Product.find({ ...PUBLIC_PRODUCT_QUERY, _id: { $in: ruleMatches } }).lean();
      candidates = [...manual, ...candidates];
    }

    const unique = [];
    const seen = new Set();
    for (const product of candidates) {
      const key = String(product._id);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(product);
      if (unique.length >= limit) break;
    }

    const payload = { items: unique };
    await cache.setJson(cacheKey, payload, settings.cacheTtlSeconds.upsell || 3600);
    return payload;
  }

  async recordRecentlyViewed(userId, productId) {
    const settings = await this.getSettings();
    if (!settings.enabled.recentlyViewed || !userId) return null;
    const expiresAt = new Date(Date.now() - Number(settings.recentlyViewed.expirationDays || 30) * 24 * 60 * 60 * 1000);
    await RecentlyViewed.deleteMany({ userId, lastViewedAt: { $lt: expiresAt } });
    await RecentlyViewed.findOneAndUpdate(
      { userId, productId },
      { $set: { lastViewedAt: new Date() }, $inc: { viewCount: 1 } },
      { upsert: true, new: true }
    );
    const all = await RecentlyViewed.find({ userId }).sort({ lastViewedAt: -1 }).lean();
    if (all.length > settings.recentlyViewed.maxHistorySize) {
      const removeIds = all.slice(settings.recentlyViewed.maxHistorySize).map((item) => item._id);
      await RecentlyViewed.deleteMany({ _id: { $in: removeIds } });
    }
    return true;
  }

  async getRecentlyViewed(userId, options = {}) {
    const settings = await this.getSettings();
    if (!settings.enabled.recentlyViewed || !userId) return { items: [] };
    const limit = Number(options.limit || settings.limits.recentlyViewed || 10);
    const rows = await RecentlyViewed.find({ userId }).sort({ lastViewedAt: -1 }).limit(limit).lean();
    const products = await Product.find({ ...PUBLIC_PRODUCT_QUERY, _id: { $in: rows.map((item) => item.productId) } }).lean();
    const map = new Map(products.map((product) => [String(product._id), product]));
    return {
      items: rows.map((row) => map.get(String(row.productId))).filter(Boolean),
    };
  }

  async getTrendingProducts(options = {}) {
    const settings = await this.getSettings();
    if (!settings.enabled.trending) return { items: [] };
    const limit = Number(options.limit || settings.limits.trending || 12);
    const cached = await cache.getJson(`trending:limit:${limit}`);
    if (cached && !options.skipCache) return cached;

    const products = await Product.find(PUBLIC_PRODUCT_QUERY)
      .sort({ "analytics.salesCount": -1, "analytics.views": -1, createdAt: -1 })
      .limit(limit * 6)
      .lean();
    const enriched = await this.enrichProductsWithSignals(products);
    const items = enriched
      .map((product) => ({
        ...product,
        trendingScore: calculatePopularityScore(product, settings.trendingWeights),
      }))
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, limit);

    const payload = { items };
    await cache.setJson(`trending:limit:${limit}`, payload, settings.cacheTtlSeconds.trending || 900);
    return payload;
  }

  async getPersonalizedRecommendations(userId, options = {}) {
    const settings = await this.getSettings();
    if (!settings.enabled.personalized || !userId) return { items: [] };
    const limit = Number(options.limit || settings.limits.personalized || 12);
    const cacheKey = `personalized:user:${userId}:limit:${limit}`;
    const cached = await cache.getJson(cacheKey);
    if (cached && !options.skipCache) return cached;

    const [recent, wishlist, orders, cart] = await Promise.all([
      RecentlyViewed.find({ userId }).sort({ lastViewedAt: -1 }).limit(20).lean(),
      Wishlist.find({ userId }).sort({ updatedAt: -1 }).limit(20).lean(),
      Order.find({ userId, isActive: true }).sort({ createdAt: -1 }).limit(20).lean(),
      Cart.findOne({ userId }).lean(),
    ]);

    const interestProductIds = [
      ...recent.map((item) => item.productId),
      ...wishlist.map((item) => item.productId),
      ...(orders.flatMap((order) => order.items || []).map((item) => item.productId)),
      ...((cart?.items || []).map((item) => item.productId)),
    ];

    const seedProducts = await Product.find({ _id: { $in: interestProductIds } }).lean();
    const categoryScores = new Map();
    const brandScores = new Map();
    for (const product of seedProducts) {
      const categoryKey = String(product.categoryId || product.category || "");
      const brandKey = getBrandValue(product);
      if (categoryKey) categoryScores.set(categoryKey, (categoryScores.get(categoryKey) || 0) + 1);
      if (brandKey) brandScores.set(brandKey, (brandScores.get(brandKey) || 0) + 1);
    }

    const candidates = await Product.find(PUBLIC_PRODUCT_QUERY)
      .sort({ "analytics.salesCount": -1, "ratings.averageRating": -1, createdAt: -1 })
      .limit(limit * 8)
      .lean();
    const enriched = await this.enrichProductsWithSignals(candidates);
    const items = enriched
      .filter((product) => !interestProductIds.some((id) => String(id) === String(product._id)))
      .map((product) => {
        const categoryKey = String(product.categoryId || product.category || "");
        const brandKey = getBrandValue(product);
        const affinity = (categoryScores.get(categoryKey) || 0) * 2 + (brandScores.get(brandKey) || 0);
        return {
          ...product,
          personalizedScore: affinity + calculatePopularityScore(product, settings.popularityWeights),
        };
      })
      .sort((a, b) => b.personalizedScore - a.personalizedScore)
      .slice(0, limit);

    const payload = { items };
    await cache.setJson(cacheKey, payload, settings.cacheTtlSeconds.personalized || 1800);
    return payload;
  }

  async getHomeRecommendations(userId, options = {}) {
    const [trending, personalized, recentlyViewed] = await Promise.all([
      this.getTrendingProducts({ limit: options.trendingLimit }),
      userId ? this.getPersonalizedRecommendations(userId, { limit: options.personalizedLimit }) : { items: [] },
      userId ? this.getRecentlyViewed(userId, { limit: options.recentlyViewedLimit }) : { items: [] },
    ]);

    return {
      trending: trending.items || [],
      personalized: personalized.items || [],
      recentlyViewed: recentlyViewed.items || [],
    };
  }

  async getProductPageRecommendations(productId, userId, options = {}) {
    const limit = Number(options.limit || 20);
    const [related, bundles, similar, personalized, recentlyViewed, upsell, trending, featured] = await Promise.all([
      this.getRelatedProducts(productId, { limit: options.relatedLimit || limit }),
      this.getFrequentlyBoughtTogether(productId, { limit: options.bundleLimit || limit }),
      this.getSimilarProducts(productId, { limit: options.similarLimit || limit }),
      userId ? this.getPersonalizedRecommendations(userId, { limit: options.personalizedLimit || 6 }) : { items: [] },
      userId ? this.getRecentlyViewed(userId, { limit: options.recentlyViewedLimit || 8 }) : { items: [] },
      this.getUpsellProducts(productId, { limit: options.upsellLimit || 4 }),
      this.getTrendingProducts({ limit: options.trendingLimit || limit }),
      this.getFeaturedProducts({ limit: options.featuredLimit || limit }),
    ]);

    return {
      related: related.items || [],
      relatedScoreBreakdown: related.scoreBreakdown || {},
      frequentlyBoughtTogether: bundles.items || [],
      bundleTotal: bundles.bundleTotal || 0,
      similar: similar.items || [],
      similarScoreBreakdown: similar.scoreBreakdown || {},
      personalized: personalized.items || [],
      recentlyViewed: recentlyViewed.items || [],
      upsell: upsell.items || [],
      trending: trending.items || [],
      featured: featured.items || [],
    };
  }

  async getFeaturedProducts(options = {}) {
    const limit = Number(options.limit || 20);
    const cached = await cache.getJson(`featured:limit:${limit}`);
    if (cached && !options.skipCache) return cached;

    const products = await Product.find(PUBLIC_PRODUCT_QUERY)
      .sort({ isFeatured: -1, featuredRank: 1, "analytics.salesCount": -1, createdAt: -1 })
      .limit(limit)
      .lean();
    const items = products.length ? products : (await this.getTrendingProducts({ limit })).items || [];
    const payload = {
      items,
      heroImages: items
        .flatMap((product) => (Array.isArray(product.images) ? product.images : []))
        .filter((image) => image?.url)
        .slice(0, 5),
    };
    await cache.setJson(`featured:limit:${limit}`, payload, 24 * 60 * 60);
    return payload;
  }

  async getAnalyticsSummary({ days = 30 } = {}) {
    const since = new Date();
    since.setDate(since.getDate() - Number(days || 30));
    const dateKeyMin = since.toISOString().slice(0, 10);
    const [analyticsRows, logSummary] = await Promise.all([
      RecommendationAnalytics.find({ dateKey: { $gte: dateKeyMin } }).sort({ dateKey: -1 }).lean(),
      RecommendationLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { recommendationType: "$recommendationType", eventType: "$eventType" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    return {
      rows: analyticsRows,
      eventSummary: logSummary,
    };
  }

  async logEvent({ recommendationType, surface, eventType, userId, productId, recommendedProductId, orderId, metadata = {} }) {
    const log = await RecommendationLog.create({
      recommendationType,
      surface,
      eventType,
      userId: normalizeObjectId(userId),
      productId: normalizeObjectId(productId),
      recommendedProductId: normalizeObjectId(recommendedProductId),
      orderId: normalizeObjectId(orderId),
      metadata,
    });

    const dateKey = new Date().toISOString().slice(0, 10);
    const update = {};
    if (eventType === "VIEW") update.views = 1;
    if (eventType === "CLICK") update.clicks = 1;
    if (eventType === "CONVERSION") {
      update.conversions = 1;
      update.revenue = Number(metadata.revenue || 0);
      update.bundleRevenue = Number(metadata.bundleRevenue || 0);
    }

    const analytics = await RecommendationAnalytics.findOneAndUpdate(
      { dateKey, recommendationType, surface },
      { $inc: update, $setOnInsert: { dateKey, recommendationType, surface } },
      { upsert: true, new: true }
    );
    analytics.ctr = analytics.views > 0 ? analytics.clicks / analytics.views : 0;
    analytics.conversionRate = analytics.clicks > 0 ? analytics.conversions / analytics.clicks : 0;
    await analytics.save();
    return log;
  }

  async preview(productId, userId) {
    const recommendations = await this.getProductPageRecommendations(productId, userId, {
      relatedLimit: 6,
      bundleLimit: 3,
      similarLimit: 6,
      personalizedLimit: 6,
      upsellLimit: 4,
    });
    return recommendations;
  }

  async rebuildAll(actor, progress = async () => {}) {
    const settings = await this.getSettings();
    await progress(25);
    const result = await this.rebuildBundleRelationships();
    await progress(75);
    settings.lastRebuiltAt = new Date();
    await settings.save();
    await this.clearCache(actor, false);
    await progress(90);
    await auditService.log({
      actor,
      action: "recommendation.rebuild.run",
      entityType: "RecommendationSettings",
      entityId: settings._id,
      metadata: result,
    });
    await progress(100);
    return result;
  }

  async clearCache(actor, logAudit = true) {
    await cache.clearByPrefixes(CACHE_PREFIXES);
    await RelatedProductCache.deleteMany({});
    const settings = await this.getSettings();
    settings.lastCacheClearedAt = new Date();
    await settings.save();
    if (logAudit) {
      await auditService.log({
        actor,
        action: "recommendation.cache.clear",
        entityType: "RecommendationSettings",
        entityId: settings._id,
      });
    }
    return { cleared: true };
  }

  async createJob(jobType, actor) {
    return RecommendationJob.create({
      job_type: jobType,
      status: "queued",
      progress: 0,
      createdBy: normalizeObjectId(actor?.sub),
    });
  }

  async getJob(jobId) {
    const job = await RecommendationJob.findById(jobId).lean();
    if (!job) throw new AppError("Recommendation job not found", 404, "RECOMMENDATION_JOB_NOT_FOUND");
    return job;
  }

  async updateJob(jobId, patch = {}) {
    return RecommendationJob.findByIdAndUpdate(jobId, { $set: patch }, { new: true });
  }
}

module.exports = new RecommendationService();
