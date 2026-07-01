const { Category, CATEGORY_STATUS, CATEGORY_VISIBILITY } = require("../models/Category");
const { CategoryAnalytics } = require("../models/CategoryAnalytics");
const { Product } = require("../models/Product");
const PlatformConfig = require("../models/PlatformConfig");
const { AppError } = require("../utils/AppError");
const { generateSlug } = require("../utils/slug");
const { uploadMany } = require("../utils/upload");
const auditService = require("./audit.service");

const CAROUSEL_CONFIG_KEY = "category_carousel_homepage";
const HERO_BANNER_CONFIG_KEY = "category_hero_homepage";

const DEFAULT_CAROUSEL_CONFIG = {
  enabled: true,
  eyebrow: "CATEGORYS",
  title: "Explore Categories",
  subtitle: "Shop Products By Category",
};

const DEFAULT_HERO_BANNER_CONFIG = {
  enabled: true,
  eyebrow: "CATEGORIES",
  panelDescription:
    "Explore a wide range of stylish apparel, designed for comfort, quality, and everyday wear.",
  ctaLabel: "Shop now",
  autoRotate: false,
  rotationInterval: 5000,
  defaultCategoryId: "",
};

function resolveThumbnail(category = {}) {
  return category.thumbnailUrl || category.logo || category.icon || "";
}

function syncActiveFromStatus(status, isActive) {
  if (status) return status === "active";
  return isActive !== false;
}

function syncStatusFromPayload(payload = {}, existing = {}) {
  if (payload.status && CATEGORY_STATUS.includes(payload.status)) {
    return payload.status;
  }
  if (payload.isActive === false) return existing.status && existing.status !== "active" ? existing.status : "inactive";
  if (payload.isActive === true) return "active";
  return existing.status || "active";
}

function sanitizeCategoryPayload(payload = {}, existing = {}) {
  const name = String(payload.name ?? existing.name ?? "").trim();
  const slug = generateSlug(payload.slug || name || existing.slug);
  const code = String(payload.code ?? existing.code ?? "").trim().toUpperCase() || name.charAt(0).toUpperCase();
  const status = syncStatusFromPayload(payload, existing);
  const visibility =
    payload.visibility && CATEGORY_VISIBILITY.includes(payload.visibility)
      ? payload.visibility
      : existing.visibility || "public";

  return {
    name,
    code,
    slug,
    description: String(payload.description ?? existing.description ?? "").trim(),
    icon: typeof payload.icon === "string" ? payload.icon.trim() : existing.icon || "",
    logo: typeof payload.logo === "string" ? payload.logo.trim() : existing.logo || "",
    thumbnailUrl: typeof payload.thumbnailUrl === "string" ? payload.thumbnailUrl.trim() : existing.thumbnailUrl || "",
    bannerUrl: typeof payload.bannerUrl === "string" ? payload.bannerUrl.trim() : existing.bannerUrl || "",
    cloudinaryPublicId:
      typeof payload.cloudinaryPublicId === "string"
        ? payload.cloudinaryPublicId.trim()
        : existing.cloudinaryPublicId || "",
    color: typeof payload.color === "string" ? payload.color.trim() : existing.color || "",
    parentCategoryId: payload.parentCategoryId || existing.parentCategoryId || null,
    order: Number.isFinite(Number(payload.order)) ? Number(payload.order) : existing.order || 0,
    status,
    visibility,
    showOnHomepage: payload.showOnHomepage ?? existing.showOnHomepage ?? true,
    showInHeroBanner: payload.showInHeroBanner ?? existing.showInHeroBanner ?? false,
    redirectToServices: payload.redirectToServices ?? existing.redirectToServices ?? false,
    heroHeading: String(payload.heroHeading ?? existing.heroHeading ?? "").trim(),
    heroSubheading: String(payload.heroSubheading ?? existing.heroSubheading ?? "").trim(),
    isActive: syncActiveFromStatus(status, payload.isActive ?? existing.isActive),
    seoTitle: String(payload.seoTitle ?? existing.seoTitle ?? "").trim(),
    seoDescription: String(payload.seoDescription ?? existing.seoDescription ?? "").trim(),
    createdBy: payload.createdBy || existing.createdBy || null,
  };
}

function serializeCategory(category = {}) {
  return {
    ...category,
    thumbnail_url: resolveThumbnail(category),
    banner_url: category.bannerUrl || "",
    hero_heading: category.heroHeading || "",
    hero_subheading: category.heroSubheading || "",
    display_in_hero_banner: category.showInHeroBanner === true,
    redirect_to_services: category.redirectToServices === true,
  };
}

async function ensureUniqueSlug(slug, excludeId) {
  const existing = await Category.findOne({
    slug,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select("_id")
    .lean();

  if (existing) {
    throw new AppError("Category slug already exists", 409, "CONFLICT");
  }
}

async function refreshProductCount(categoryId) {
  const count = await Product.countDocuments({
    categoryId,
    status: "APPROVED",
    isActive: true,
  });
  await Category.updateOne({ _id: categoryId }, { $set: { productCount: count } });
  return count;
}

async function attachProductCounts(categories = []) {
  return Promise.all(
    categories.map(async (category) => {
      const productCount =
        typeof category.productCount === "number" && category.productCount >= 0
          ? category.productCount
          : await refreshProductCount(category._id);
      return serializeCategory({ ...category, productCount });
    })
  );
}

async function listActiveCategories() {
  const categories = await Category.find({
    isActive: true,
    status: "active",
    visibility: "public",
  })
    .sort({ order: 1, name: 1, createdAt: 1 })
    .lean();
  return attachProductCounts(categories);
}

async function listHomepageCategories() {
  const categories = await Category.find({
    isActive: true,
    status: "active",
    visibility: "public",
    showOnHomepage: true,
  })
    .sort({ order: 1, name: 1, createdAt: 1 })
    .lean();
  return attachProductCounts(categories);
}

async function attachHeroFeaturedProduct(categories = []) {
  return Promise.all(
    categories.map(async (category) => {
      const product = await Product.findOne({
        categoryId: category._id,
        status: "APPROVED",
        isActive: true,
      })
        .sort({ createdAt: -1 })
        .select("name images thumbnail slug")
        .lean();

      const productImage = product?.images?.[0] || product?.thumbnail || "";
      const heroImage = category.bannerUrl || category.thumbnailUrl || productImage || category.logo || category.icon || "";

      return serializeCategory({
        ...category,
        heroImage,
        featuredProduct: product
          ? {
              _id: product._id,
              name: product.name,
              slug: product.slug,
              image: productImage,
            }
          : null,
      });
    })
  );
}

async function listHeroBannerCategories() {
  const categories = await Category.find({
    isActive: true,
    status: "active",
    visibility: "public",
    showInHeroBanner: true,
  })
    .sort({ order: 1, name: 1, createdAt: 1 })
    .lean();

  return attachHeroFeaturedProduct(categories);
}

async function listAllCategories() {
  const categories = await Category.find({}).sort({ order: 1, name: 1, createdAt: 1 }).lean();
  return attachProductCounts(categories);
}

async function getCategoryBySlug(slug) {
  const category = await Category.findOne({
    slug: generateSlug(slug),
    isActive: true,
    status: "active",
    visibility: "public",
  }).lean();
  if (!category) throw new AppError("Category not found", 404, "NOT_FOUND");
  const productCount = await refreshProductCount(category._id);
  return serializeCategory({ ...category, productCount });
}

async function getCarouselConfig() {
  const doc = await PlatformConfig.findOne({ key: CAROUSEL_CONFIG_KEY }).lean();
  if (!doc?.value) return DEFAULT_CAROUSEL_CONFIG;
  return { ...DEFAULT_CAROUSEL_CONFIG, ...doc.value };
}

async function updateCarouselConfig(value, actor) {
  const doc = await PlatformConfig.findOneAndUpdate(
    { key: CAROUSEL_CONFIG_KEY },
    {
      $set: {
        key: CAROUSEL_CONFIG_KEY,
        value: { ...DEFAULT_CAROUSEL_CONFIG, ...value },
        category: "general",
        type: "object",
        isPublic: true,
        updatedBy: actor?.sub || actor?._id || null,
      },
    },
    { upsert: true, new: true }
  );
  return doc.value;
}

async function getHeroBannerConfig() {
  const doc = await PlatformConfig.findOne({ key: HERO_BANNER_CONFIG_KEY }).lean();
  if (!doc?.value) return DEFAULT_HERO_BANNER_CONFIG;
  return { ...DEFAULT_HERO_BANNER_CONFIG, ...doc.value };
}

async function updateHeroBannerConfig(value, actor) {
  const doc = await PlatformConfig.findOneAndUpdate(
    { key: HERO_BANNER_CONFIG_KEY },
    {
      $set: {
        key: HERO_BANNER_CONFIG_KEY,
        value: { ...DEFAULT_HERO_BANNER_CONFIG, ...value },
        category: "general",
        type: "object",
        isPublic: true,
        updatedBy: actor?.sub || actor?._id || null,
      },
    },
    { upsert: true, new: true }
  );
  return doc.value;
}

async function createCategory(payload, meta = {}) {
  const category = sanitizeCategoryPayload(payload);
  if (!category.name) throw new AppError("Category name is required", 400, "VALIDATION_ERROR");
  if (!category.slug) throw new AppError("Category slug is required", 400, "VALIDATION_ERROR");

  await ensureUniqueSlug(category.slug);
  const created = await Category.create(category);

  await auditService.log({
    actor: meta.actor || { role: "admin" },
    action: "CATEGORY_CREATED",
    entityType: "Category",
    entityId: created._id,
    metadata: { name: created.name, slug: created.slug },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return serializeCategory(created.toObject());
}

async function updateCategory(categoryId, payload, meta = {}) {
  const existing = await Category.findById(categoryId);
  if (!existing) throw new AppError("Category not found", 404, "NOT_FOUND");

  const oldValues = {
    name: existing.name,
    status: existing.status,
    visibility: existing.visibility,
    thumbnailUrl: existing.thumbnailUrl,
  };

  const nextValues = sanitizeCategoryPayload(payload, existing.toObject());
  if (!nextValues.name) throw new AppError("Category name is required", 400, "VALIDATION_ERROR");
  await ensureUniqueSlug(nextValues.slug, existing._id);

  Object.assign(existing, nextValues);
  await existing.save();

  await auditService.log({
    actor: meta.actor || { role: "admin" },
    action: "CATEGORY_UPDATED",
    entityType: "Category",
    entityId: existing._id,
    metadata: { oldValues, newValues: nextValues },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return serializeCategory(existing.toObject());
}

async function toggleCategory(categoryId, isActive, meta = {}) {
  const category = await Category.findById(categoryId);
  if (!category) throw new AppError("Category not found", 404, "NOT_FOUND");

  category.isActive = Boolean(isActive);
  category.status = category.isActive ? "active" : "inactive";
  await category.save();

  await auditService.log({
    actor: meta.actor || { role: "admin" },
    action: "CATEGORY_STATUS_CHANGED",
    entityType: "Category",
    entityId: category._id,
    metadata: { isActive: category.isActive, status: category.status },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return serializeCategory(category.toObject());
}

async function uploadCategoryMedia(categoryId, files = {}, meta = {}) {
  const category = await Category.findById(categoryId);
  if (!category) throw new AppError("Category not found", 404, "NOT_FOUND");

  const updates = {};

  if (files.thumbnail?.[0]) {
    const [uploaded] = await uploadMany([files.thumbnail[0]], { folder: "categories/thumbnails" });
    updates.thumbnailUrl = uploaded.url;
    updates.logo = uploaded.url;
    updates.cloudinaryPublicId = uploaded.publicId || category.cloudinaryPublicId;
  }

  if (files.banner?.[0]) {
    const [uploaded] = await uploadMany([files.banner[0]], { folder: "categories/banners" });
    updates.bannerUrl = uploaded.url;
  }

  if (files.icon?.[0]) {
    const [uploaded] = await uploadMany([files.icon[0]], { folder: "categories/icons" });
    updates.icon = uploaded.url;
  }

  if (!Object.keys(updates).length) {
    throw new AppError("No media files provided", 400, "VALIDATION_ERROR");
  }

  Object.assign(category, updates);
  await category.save();

  await auditService.log({
    actor: meta.actor || { role: "admin" },
    action: "CATEGORY_THUMBNAIL_CHANGED",
    entityType: "Category",
    entityId: category._id,
    metadata: updates,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return serializeCategory(category.toObject());
}

async function trackCategoryEvent(categoryId, { eventType, userId, sessionId, productId, orderId, revenue } = {}) {
  const category = await Category.findById(categoryId).select("_id").lean();
  if (!category) throw new AppError("Category not found", 404, "NOT_FOUND");

  await CategoryAnalytics.create({
    categoryId,
    eventType,
    userId: userId || null,
    sessionId: sessionId || "",
    productId: productId || null,
    orderId: orderId || null,
    revenue: Number(revenue || 0),
  });

  return { tracked: true };
}

async function getCategoryAnalyticsSummary() {
  const [topViewed, topClicked, topRevenue] = await Promise.all([
    CategoryAnalytics.aggregate([
      { $match: { eventType: "view" } },
      { $group: { _id: "$categoryId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    CategoryAnalytics.aggregate([
      { $match: { eventType: "click" } },
      { $group: { _id: "$categoryId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    CategoryAnalytics.aggregate([
      { $match: { eventType: "order" } },
      { $group: { _id: "$categoryId", revenue: { $sum: "$revenue" }, orders: { $sum: 1 } } },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]),
  ]);

  const categoryIds = [
    ...new Set([
      ...topViewed.map((row) => String(row._id)),
      ...topClicked.map((row) => String(row._id)),
      ...topRevenue.map((row) => String(row._id)),
    ]),
  ];

  const categories = await Category.find({ _id: { $in: categoryIds } }).select("name slug").lean();
  const categoryMap = new Map(categories.map((c) => [String(c._id), c]));

  const mapRows = (rows, valueKey = "count") =>
    rows.map((row) => ({
      category: categoryMap.get(String(row._id)) || { _id: row._id },
      value: row[valueKey] || 0,
      orders: row.orders,
      revenue: row.revenue,
    }));

  return {
    topViewed: mapRows(topViewed),
    topClicked: mapRows(topClicked),
    topRevenue: mapRows(topRevenue, "revenue"),
  };
}

module.exports = {
  listActiveCategories,
  listHomepageCategories,
  listHeroBannerCategories,
  listAllCategories,
  getCategoryBySlug,
  getCarouselConfig,
  updateCarouselConfig,
  getHeroBannerConfig,
  updateHeroBannerConfig,
  createCategory,
  updateCategory,
  toggleCategory,
  uploadCategoryMedia,
  trackCategoryEvent,
  getCategoryAnalyticsSummary,
  refreshProductCount,
  CATEGORY_STATUS,
  CATEGORY_VISIBILITY,
};
