const crypto = require("crypto");
const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const { Vendor } = require("../models/Vendor");
const { Product } = require("../models/Product");
const { ProductReview } = require("../models/ProductReview");
const { Order } = require("../models/Order");
const { UserNotification } = require("../models/UserNotification");
const { VendorFollower } = require("../models/VendorFollower");
const { VendorStoreView } = require("../models/VendorStoreView");
const { VendorCollection } = require("../models/VendorCollection");
const homepageLayoutService = require("./homepage-layout.service");

const STORE_CACHE_TTL_MS = Number(process.env.VENDOR_STOREFRONT_CACHE_TTL_MS || 60000);
const storeCache = new Map();

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ""));
}

function toObjectId(value) {
  if (!isObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function hashValue(value) {
  if (!value) return "";
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function cacheGet(key) {
  const hit = storeCache.get(key);
  if (!hit || hit.expiresAt < Date.now()) {
    storeCache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  storeCache.set(key, { value, expiresAt: Date.now() + STORE_CACHE_TTL_MS });
  return value;
}

function clearVendorCache(vendorIdOrSlug) {
  const needle = String(vendorIdOrSlug || "");
  for (const key of storeCache.keys()) {
    if (key.includes(needle)) storeCache.delete(key);
  }
}

function getPublicVendorFilter(slugOrId) {
  const key = String(slugOrId || "").trim().toLowerCase();
  return {
    status: "approved",
    isStoreVisible: { $ne: false },
    ...(isObjectId(key) ? { _id: key } : { storeSlug: key }),
  };
}

function sanitizeVendor(vendor, metrics = {}) {
  if (!vendor) return null;
  const joinedAt = vendor.createdAt || vendor.updatedAt || new Date();
  const yearsOnPlatform = Math.max(
    0,
    Math.floor((Date.now() - new Date(joinedAt).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  );

  return {
    _id: vendor._id,
    vendorCode: vendor.vendorCode,
    storeSlug: vendor.storeSlug,
    storeUrl: `/vendor/${vendor.storeSlug}`,
    vendorName: vendor.shopName || vendor.companyName || "Store",
    companyName: vendor.companyName || "",
    logoUrl: vendor.logoUrl || "",
    bannerUrl: vendor.bannerUrl || "",
    verified: vendor.status === "approved",
    rating: Number(metrics.averageRating || 0),
    totalReviews: Number(metrics.totalReviews || 0),
    followersCount: Number(metrics.followersCount || 0),
    productsCount: Number(metrics.productsCount || 0),
    yearsOnPlatform,
    storeDescription: vendor.storeDescription || "",
    supportEmail: vendor.supportEmail || "",
    supportPhone: vendor.supportPhone || "",
    address: vendor.address || "",
    defaultCourier: vendor.defaultCourier || "",
    payoutSchedule: vendor.payoutSchedule || "",
    shippingSettings: {
      defaultShippingMode: vendor.shippingSettings?.defaultShippingMode || "",
      allowedShippingModes: vendor.shippingSettings?.allowedShippingModes || [],
    },
    storeSocialVisibility: vendor.storeSocialVisibility || {},
    storeCategories: Array.isArray(vendor.storeCategories) && vendor.storeCategories.length
      ? vendor.storeCategories
      : [],
    storeAbout: vendor.storeAbout || {},
    storeThemeColor: vendor.storeThemeColor || "#0f766e",
    seo: {
      metaTitle: vendor.storeSeo?.metaTitle || `${vendor.shopName || vendor.companyName || "Vendor"} Store`,
      metaDescription:
        vendor.storeSeo?.metaDescription ||
        vendor.storeDescription ||
        `Shop products from ${vendor.shopName || vendor.companyName || "this vendor"} on the marketplace.`,
      metaKeywords: vendor.storeSeo?.metaKeywords || [],
      ogImage: vendor.storeSeo?.ogImage || vendor.bannerUrl || vendor.logoUrl || "",
      canonicalUrl: `/vendor/${vendor.storeSlug}`,
      schemaType: "Store",
    },
  };
}

function productProjection() {
  return [
    "name",
    "slug",
    "category",
    "categoryId",
    "subCategory",
    "subCategoryId",
    "price",
    "discountPrice",
    "currency",
    "stock",
    "images",
    "thumbnail",
    "sellerId",
    "ratings",
    "analytics",
    "variants",
    "attributes",
    "createdAt",
    "updatedAt",
  ].join(" ");
}

function populateSeller(query) {
  return query.populate("sellerId", "companyName shopName storeSlug logoUrl status isStoreVisible");
}

function buildProductFilter(vendorId, query = {}) {
  const filter = {
    sellerId: vendorId,
    status: "APPROVED",
    isActive: true,
  };

  if (query.search) {
    const search = String(query.search).trim();
    if (search) filter.$text = { $search: search };
  }
  if (query.category) filter.category = String(query.category).trim();
  if (isObjectId(query.categoryId)) filter.categoryId = query.categoryId;
  if (query.subCategory) filter.subCategory = String(query.subCategory).trim();
  if (isObjectId(query.subCategoryId)) filter.subCategoryId = query.subCategoryId;
  if (query.brand) filter["attributes.brand"] = String(query.brand).trim();
  if (query.color) filter["attributes.color"] = String(query.color).trim();
  if (query.size) filter["attributes.size"] = String(query.size).trim();
  if (query.availability === "in_stock") filter.stock = { $gt: 0 };
  if (query.availability === "out_of_stock") filter.stock = { $lte: 0 };
  if (query.rating) filter["ratings.averageRating"] = { $gte: Number(query.rating) || 0 };

  const minPrice = Number(query.minPrice);
  const maxPrice = Number(query.maxPrice);
  if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
    filter.$expr = {
      $and: [
        ...(Number.isFinite(minPrice)
          ? [{ $gte: [{ $ifNull: ["$discountPrice", "$price"] }, minPrice] }]
          : []),
        ...(Number.isFinite(maxPrice)
          ? [{ $lte: [{ $ifNull: ["$discountPrice", "$price"] }, maxPrice] }]
          : []),
      ],
    };
  }
  if (query.discount === "true") filter.discountPrice = { $gt: 0 };

  return filter;
}

function buildProductSort(query = {}) {
  const sortKey = String(query.sortBy || "").toLowerCase();
  const sortMap = {
    newest: { createdAt: -1 },
    createdat: { createdAt: -1 },
    best_selling: { "analytics.salesCount": -1, createdAt: -1 },
    bestselling: { "analytics.salesCount": -1, createdAt: -1 },
    highest_rated: { "ratings.averageRating": -1, "ratings.totalReviews": -1 },
    highestrated: { "ratings.averageRating": -1, "ratings.totalReviews": -1 },
    discount: { discountPrice: 1, createdAt: -1 },
    price_low: { price: 1 },
    price_high: { price: -1 },
  };
  return sortMap[sortKey] || { createdAt: -1 };
}

async function getVendorMetrics(vendorId) {
  const [followersCount, productsCount, reviewStats] = await Promise.all([
    VendorFollower.countDocuments({ vendorId }),
    Product.countDocuments({ sellerId: vendorId, status: "APPROVED", isActive: true }),
    ProductReview.aggregate([
      { $match: { vendorId: toObjectId(vendorId), status: "approved" } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
        },
      },
    ]),
  ]);

  return {
    followersCount,
    productsCount,
    averageRating: reviewStats[0]?.averageRating || 0,
    totalReviews: reviewStats[0]?.totalReviews || 0,
  };
}

async function findPublicVendor(slugOrId) {
  const vendor = await Vendor.findOne(getPublicVendorFilter(slugOrId)).lean();
  if (!vendor) throw new AppError("Vendor store not found", 404, "VENDOR_STORE_NOT_FOUND");
  return vendor;
}

async function getFollowState(vendorId, customerId) {
  if (!customerId) return false;
  const follow = await VendorFollower.exists({ vendorId, customerId });
  return Boolean(follow);
}

async function listProductsForVendor(vendorId, query = {}) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 32, 1), 96);
  const filter = buildProductFilter(vendorId, query);
  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    populateSeller(Product.find(filter))
      .select(productProjection())
      .sort(buildProductSort(query))
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  return {
    products,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
}

async function getProductRows(vendorId) {
  const baseFilter = { sellerId: vendorId, status: "APPROVED", isActive: true };
  const projection = productProjection();
  const [featuredProducts, newArrivals, bestSellers, topRatedProducts, dealsOfTheDay, recentlyAddedProducts] =
    await Promise.all([
      populateSeller(Product.find(baseFilter)).select(projection).sort({ "analytics.views": -1, createdAt: -1 }).limit(16).lean(),
      populateSeller(Product.find(baseFilter)).select(projection).sort({ createdAt: -1 }).limit(16).lean(),
      populateSeller(Product.find(baseFilter)).select(projection).sort({ "analytics.salesCount": -1, createdAt: -1 }).limit(16).lean(),
      populateSeller(Product.find(baseFilter)).select(projection).sort({ "ratings.averageRating": -1, "ratings.totalReviews": -1 }).limit(16).lean(),
      populateSeller(Product.find({ ...baseFilter, discountPrice: { $gt: 0 } })).select(projection).sort({ discountPrice: 1 }).limit(16).lean(),
      populateSeller(Product.find(baseFilter)).select(projection).sort({ updatedAt: -1 }).limit(16).lean(),
    ]);

  return {
    featuredProducts,
    newArrivals,
    bestSellers,
    topRatedProducts,
    dealsOfTheDay,
    recentlyAddedProducts,
    recommendedProducts: [...bestSellers, ...topRatedProducts]
      .filter((item, index, arr) => arr.findIndex((candidate) => String(candidate._id) === String(item._id)) === index)
      .slice(0, 16),
  };
}

class VendorStorefrontService {
  async getStorefront(slug, customerId = null) {
    const cacheKey = `storefront:${slug}:${customerId || "guest"}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const vendor = await findPublicVendor(slug);
    const layoutPromise = homepageLayoutService
      .getSharedVendorLayout({
        device: "desktop",
        currentVendorId: vendor._id,
      })
      .catch(() => null);

    const [metrics, isFollowing, rows, collections, assignedLayout] = await Promise.all([
      getVendorMetrics(vendor._id),
      getFollowState(vendor._id, customerId),
      getProductRows(vendor._id),
      VendorCollection.find({ vendorId: vendor._id, isActive: true })
        .sort({ sortOrder: 1, createdAt: -1 })
        .limit(24)
        .lean(),
      layoutPromise,
    ]);

    return cacheSet(cacheKey, {
      vendor: sanitizeVendor(vendor, metrics),
      isFollowing,
      collections,
      assignedLayout: assignedLayout?.layout || null,
      layoutRows: assignedLayout?.rows || [],
      containers: assignedLayout?.containers || [],
      ...rows,
    });
  }

  async getVendorProducts(slug, query = {}, customerId = null) {
    const vendor = await findPublicVendor(slug);
    const [metrics, isFollowing, listing] = await Promise.all([
      getVendorMetrics(vendor._id),
      getFollowState(vendor._id, customerId),
      listProductsForVendor(vendor._id, query),
    ]);

    return {
      vendor: sanitizeVendor(vendor, metrics),
      isFollowing,
      ...listing,
    };
  }

  async getVendorReviews(slug, query = {}, customerId = null) {
    const vendor = await findPublicVendor(slug);
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);
    const sortBy = String(query.sortBy || "helpful").toLowerCase();
    const sort = {
      newest: { createdAt: -1 },
      highest: { rating: -1, createdAt: -1 },
      lowest: { rating: 1, createdAt: -1 },
      helpful: { helpfulCount: -1, createdAt: -1 },
    }[sortBy] || { helpfulCount: -1, createdAt: -1 };

    const filter = { vendorId: vendor._id, status: "approved" };
    const [metrics, isFollowing, reviews, total, distribution] = await Promise.all([
      getVendorMetrics(vendor._id),
      getFollowState(vendor._id, customerId),
      ProductReview.find(filter)
        .select("productId customerId rating title review images videos verifiedPurchase helpfulCount createdAt vendorReply vendorReplyDate")
        .populate("productId", "name images")
        .populate("customerId", "name avatarUrl")
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ProductReview.countDocuments(filter),
      ProductReview.aggregate([
        { $match: { vendorId: vendor._id, status: "approved" } },
        { $group: { _id: "$rating", count: { $sum: 1 } } },
      ]),
    ]);

    return {
      vendor: sanitizeVendor(vendor, metrics),
      isFollowing,
      averageRating: metrics.averageRating,
      totalReviews: metrics.totalReviews,
      ratingDistribution: distribution.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }),
      reviews: reviews.map((review) => ({
        ...review,
        customerId: review.customerId
          ? {
              _id: review.customerId._id,
              name: review.customerId.name,
              avatarUrl: review.customerId.avatarUrl,
            }
          : null,
      })),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async followVendor(slug, customerId) {
    const vendor = await findPublicVendor(slug);
    await VendorFollower.updateOne(
      { vendorId: vendor._id, customerId },
      {
        $setOnInsert: {
          vendorId: vendor._id,
          customerId,
          followedAt: new Date(),
          source: "storefront",
        },
        $set: { notificationEnabled: true },
      },
      { upsert: true }
    );

    await UserNotification.create({
      userId: customerId,
      type: "SYSTEM",
      title: "Store followed",
      message: `You will receive product, collection, deal, flash sale, and restock alerts from ${vendor.shopName || vendor.companyName}.`,
      entityType: "Vendor",
      entityId: vendor._id,
    });

    clearVendorCache(vendor._id);
    clearVendorCache(vendor.storeSlug);
    const metrics = await getVendorMetrics(vendor._id);
    return { vendor: sanitizeVendor(vendor, metrics), isFollowing: true };
  }

  async unfollowVendor(slug, customerId) {
    const vendor = await findPublicVendor(slug);
    await VendorFollower.deleteOne({ vendorId: vendor._id, customerId });
    clearVendorCache(vendor._id);
    clearVendorCache(vendor.storeSlug);
    const metrics = await getVendorMetrics(vendor._id);
    return { vendor: sanitizeVendor(vendor, metrics), isFollowing: false };
  }

  async listFollowers(slug, query = {}) {
    const vendor = await findPublicVendor(slug);
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 24, 1), 50);
    const [metrics, followers, total] = await Promise.all([
      getVendorMetrics(vendor._id),
      VendorFollower.find({ vendorId: vendor._id })
        .select("customerId followedAt")
        .populate("customerId", "name avatarUrl")
        .sort({ followedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      VendorFollower.countDocuments({ vendorId: vendor._id }),
    ]);

    return {
      vendor: sanitizeVendor(vendor, metrics),
      followers: followers.map((follow) => ({
        followedAt: follow.followedAt,
        customer: follow.customerId
          ? {
              _id: follow.customerId._id,
              name: follow.customerId.name,
              avatarUrl: follow.customerId.avatarUrl,
            }
          : null,
      })),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async listCustomerFollowedStores(customerId, query = {}) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);
    const follows = await VendorFollower.find({ customerId })
      .sort({ followedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    const vendorIds = follows.map((follow) => follow.vendorId);
    const [vendors, total] = await Promise.all([
      Vendor.find({ _id: { $in: vendorIds }, status: "approved", isStoreVisible: { $ne: false } }).lean(),
      VendorFollower.countDocuments({ customerId }),
    ]);
    const vendorById = new Map(vendors.map((vendor) => [String(vendor._id), vendor]));

    const rows = await Promise.all(
      follows.map(async (follow) => {
        const vendor = vendorById.get(String(follow.vendorId));
        if (!vendor) return null;
        const [metrics, latestProducts, latestOffers] = await Promise.all([
          getVendorMetrics(vendor._id),
          Product.find({ sellerId: vendor._id, status: "APPROVED", isActive: true })
            .populate("sellerId", "companyName shopName storeSlug logoUrl status isStoreVisible")
            .select(productProjection())
            .sort({ createdAt: -1 })
            .limit(4)
            .lean(),
          Product.find({ sellerId: vendor._id, status: "APPROVED", isActive: true, discountPrice: { $gt: 0 } })
            .populate("sellerId", "companyName shopName storeSlug logoUrl status isStoreVisible")
            .select(productProjection())
            .sort({ updatedAt: -1 })
            .limit(4)
            .lean(),
        ]);
        return {
          followedAt: follow.followedAt,
          notificationEnabled: follow.notificationEnabled,
          vendor: sanitizeVendor(vendor, metrics),
          latestProducts,
          latestOffers,
        };
      })
    );

    return {
      stores: rows.filter(Boolean),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async recordStoreEvent(slug, payload = {}, req = {}) {
    const vendor = await findPublicVendor(slug);
    const eventType = String(payload.eventType || "PAGE_VIEW").toUpperCase();
    const sessionId = String(payload.sessionId || req.get?.("x-session-id") || "").trim().slice(0, 120);
    const customerId = req.user?.sub && isObjectId(req.user.sub) ? req.user.sub : null;
    const productId = payload.productId && isObjectId(payload.productId) ? payload.productId : null;

    const doc = await VendorStoreView.create({
      vendorId: vendor._id,
      customerId,
      sessionId,
      productId,
      eventType,
      path: String(payload.path || req.originalUrl || "").slice(0, 240),
      revenue: Number(payload.revenue || 0),
      quantity: Number(payload.quantity || 0),
      ipHash: hashValue(req.ip),
      userAgentHash: hashValue(req.get?.("user-agent")),
      meta: payload.meta || {},
    });

    if (productId && ["PRODUCT_CLICK", "WISHLIST_ADD", "CART_ADD"].includes(eventType)) {
      await Product.updateOne({ _id: productId, sellerId: vendor._id }, { $inc: { "analytics.views": 1 } });
    }

    return { eventId: doc._id };
  }

  async getVendorAnalytics(vendorUserId, query = {}) {
    const vendor = await Vendor.findOne({ userId: vendorUserId }).select("_id").lean();
    if (!vendor) throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
    return this.getAnalyticsForVendorId(vendor._id, query);
  }

  async getAnalyticsForVendorId(vendorId, query = {}) {
    const days = Math.min(Math.max(Number(query.days) || 30, 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const vendorObjectId = toObjectId(vendorId);
    const [events, followers, revenueRows, topProducts, topCategories] = await Promise.all([
      VendorStoreView.aggregate([
        { $match: { vendorId: vendorObjectId, createdAt: { $gte: since } } },
        { $group: { _id: "$eventType", count: { $sum: 1 }, revenue: { $sum: "$revenue" } } },
      ]),
      VendorFollower.countDocuments({ vendorId }),
      Order.aggregate([
        { $match: { sellerId: vendorObjectId, createdAt: { $gte: since }, paymentStatus: { $in: ["Paid", "Partially Refunded"] } } },
        { $group: { _id: null, revenue: { $sum: "$totalAmount" }, orders: { $sum: 1 }, averageOrderValue: { $avg: "$totalAmount" } } },
      ]),
      Product.find({ sellerId: vendorId }).select("name images analytics ratings price discountPrice").sort({ "analytics.salesCount": -1 }).limit(10).lean(),
      Product.aggregate([
        { $match: { sellerId: vendorObjectId, status: "APPROVED", isActive: true } },
        { $group: { _id: "$category", products: { $sum: 1 }, revenue: { $sum: "$analytics.totalRevenue" } } },
        { $sort: { revenue: -1, products: -1 } },
        { $limit: 10 },
      ]),
    ]);

    const eventMap = Object.fromEntries(events.map((item) => [item._id, item]));
    const revenue = revenueRows[0] || {};
    return {
      rangeDays: days,
      storeVisits: eventMap.PAGE_VIEW?.count || 0,
      uniqueVisitors: eventMap.UNIQUE_VISITOR?.count || 0,
      followers,
      productViews: eventMap.PRODUCT_CLICK?.count || 0,
      wishlistAdds: eventMap.WISHLIST_ADD?.count || 0,
      cartAdds: eventMap.CART_ADD?.count || 0,
      storeClicks: eventMap.STORE_CLICK?.count || 0,
      followEvents: eventMap.FOLLOW?.count || 0,
      conversions: eventMap.CONVERSION?.count || revenue.orders || 0,
      revenue: revenue.revenue || eventMap.REVENUE?.revenue || 0,
      averageOrderValue: revenue.averageOrderValue || 0,
      storeCtr: eventMap.PAGE_VIEW?.count
        ? Math.round(((eventMap.STORE_CLICK?.count || 0) / eventMap.PAGE_VIEW.count) * 10000) / 100
        : 0,
      customerRetention: followers ? Math.min(100, Math.round(((revenue.orders || 0) / followers) * 100)) : 0,
      topProducts,
      topCategories,
    };
  }

  async updateVendorStoreSettings(vendorUserId, payload = {}) {
    const patch = {
      ...(payload.bannerUrl !== undefined ? { bannerUrl: payload.bannerUrl } : {}),
      ...(payload.logoUrl !== undefined ? { logoUrl: payload.logoUrl } : {}),
      ...(payload.storeDescription !== undefined ? { storeDescription: payload.storeDescription } : {}),
      ...(payload.storeThemeColor !== undefined ? { storeThemeColor: payload.storeThemeColor } : {}),
      ...(Array.isArray(payload.storeCategories) ? { storeCategories: payload.storeCategories.slice(0, 12) } : {}),
      ...(payload.storeSeo ? { storeSeo: payload.storeSeo } : {}),
      storeSocialVisibility: {
        showExternalLinks: false,
        showSocialContacts: false,
        showDirectContact: false,
      },
    };
    const vendor = await Vendor.findOneAndUpdate({ userId: vendorUserId }, { $set: patch }, { returnDocument: "after" }).lean();
    if (!vendor) throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
    clearVendorCache(vendor._id);
    clearVendorCache(vendor.storeSlug);
    return sanitizeVendor(vendor, await getVendorMetrics(vendor._id));
  }

  async adminUpdateStoreVisibility(vendorId, payload = {}) {
    const action = String(payload.action || "").toLowerCase();
    const patch = {};
    if (action === "approve" || action === "show") patch.isStoreVisible = true;
    if (action === "hide") patch.isStoreVisible = false;
    if (action === "suspend") {
      patch.isStoreVisible = false;
      patch.status = "rejected";
      patch.rejectionReason = payload.reason || "Store suspended by marketplace moderation.";
    }
    if (action === "feature") patch.isStoreFeatured = true;
    if (action === "unfeature") patch.isStoreFeatured = false;
    if (action === "verify") patch.status = "approved";
    if (payload.reason !== undefined) patch.storeHiddenReason = String(payload.reason || "").slice(0, 500);
    if (!Object.keys(patch).length) throw new AppError("Unsupported store moderation action", 400, "VALIDATION_ERROR");

    const vendor = await Vendor.findByIdAndUpdate(vendorId, { $set: patch }, { returnDocument: "after" }).lean();
    if (!vendor) throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
    clearVendorCache(vendor._id);
    clearVendorCache(vendor.storeSlug);
    return sanitizeVendor(vendor, await getVendorMetrics(vendor._id));
  }

  async notifyFollowersForProduct(product, eventType = "NEW_PRODUCT") {
    if (!product?.sellerId) return { notified: 0 };
    const followers = await VendorFollower.find({
      vendorId: product.sellerId,
      notificationEnabled: true,
    }).select("customerId").lean();
    if (!followers.length) return { notified: 0 };

    const vendor = await Vendor.findById(product.sellerId).select("shopName companyName").lean();
    const titleByType = {
      NEW_PRODUCT: "New product from a followed store",
      PRICE_DROP: "Price drop from a followed store",
      BACK_IN_STOCK: "Back in stock from a followed store",
      FLASH_SALE: "Flash sale from a followed store",
      NEW_COLLECTION: "New collection from a followed store",
    };

    await UserNotification.insertMany(
      followers.map((follow) => ({
        userId: follow.customerId,
        type: "SYSTEM",
        title: titleByType[eventType] || "Store update from a followed vendor",
        message: `${vendor?.shopName || vendor?.companyName || "A followed store"} updated ${product.name}.`,
        entityType: "Product",
        entityId: product._id,
      })),
      { ordered: false }
    );

    return { notified: followers.length };
  }
}

module.exports = new VendorStorefrontService();
