const { HomepageBanner } = require("../models/HomepageBanner");
const { HomepageBannerCategory } = require("../models/HomepageBannerCategory");
const { HomepageBannerAnalytics } = require("../models/HomepageBannerAnalytics");
const { Category } = require("../models/Category");
const { Product } = require("../models/Product");
const PlatformConfig = require("../models/PlatformConfig");
const { AppError } = require("../utils/AppError");
const { generateSlug } = require("../utils/slug");
const auditService = require("./audit.service");
const redisCache = require("../modules/recommendation/cache");
const { uploadMany } = require("../utils/upload");
const {
  syncBannerContainerToBuilder,
} = require("./homepage-banner-container.sync");
const bannerContainerService = require("./homepage-banner-container.service");

const CACHE_KEY = "homepage:banners:public";
const CACHE_TTL = Number(process.env.HOMEPAGE_BANNER_CACHE_TTL || 300);
const SETTINGS_KEY = "homepage_banner_settings";

const DEFAULT_SETTINGS = {
  maxCategoryCards: 6,
  autoplay: true,
  autoplayIntervalMs: 5000,
  transitionEffect: "fade",
  pauseOnHover: true,
  enableLoop: true,
  showArrows: true,
  showDots: true,
};

function resolveBannerMedia(banner, device = "desktop") {
  const isMobile = device === "mobile";
  const mediaType = banner.mediaType || "image";
  const url = isMobile
    ? banner.mobileMedia || banner.mobileImage || banner.desktopMedia || banner.desktopImage
    : banner.desktopMedia || banner.desktopImage;
  const poster = isMobile
    ? banner.mobilePoster || banner.desktopPoster || banner.mobileImage || banner.desktopImage
    : banner.desktopPoster || banner.desktopImage;
  return { mediaType, url: url || "", poster: poster || "" };
}

function applyBannerMediaFields(target, payload = {}) {
  const fields = [
    "featuredCollectionText",
    "mediaType",
    "desktopMedia",
    "mobileMedia",
    "desktopPoster",
    "mobilePoster",
    "showOverlay",
    "overlayOpacity",
    "hoverModeEnabled",
    "categoryHeading",
    "categoryDescription",
  ];

  fields.forEach((field) => {
    if (payload[field] === undefined) return;
    if (field === "overlayOpacity") {
      target[field] = Math.min(1, Math.max(0, Number(payload[field] || 0)));
      return;
    }
    if (field === "showOverlay" || field === "hoverModeEnabled") {
      target[field] = Boolean(payload[field]);
      return;
    }
    target[field] = String(payload[field] ?? "").trim();
  });

  if (payload.desktopImage !== undefined) {
    target.desktopImage = String(payload.desktopImage || "").trim();
    if ((target.mediaType || "image") === "image" && !target.desktopMedia) {
      target.desktopMedia = target.desktopImage;
    }
  }
  if (payload.mobileImage !== undefined) {
    target.mobileImage = String(payload.mobileImage || "").trim();
    if ((target.mediaType || "image") === "image" && !target.mobileMedia) {
      target.mobileMedia = target.mobileImage;
    }
  }
  if (payload.desktopMedia !== undefined && (target.mediaType || "image") === "image") {
    target.desktopImage = String(payload.desktopMedia || "").trim();
  }
  if (payload.mobileMedia !== undefined && (target.mediaType || "image") === "image") {
    target.mobileImage = String(payload.mobileMedia || "").trim();
  }
}

async function getSettings() {
  const doc = await PlatformConfig.findOne({ key: SETTINGS_KEY }).lean();
  return { ...DEFAULT_SETTINGS, ...(doc?.value || {}) };
}

async function invalidateCache() {
  await redisCache.del(CACHE_KEY);
  await redisCache.clearByPrefixes(["homepage:banners:"]);
}

function isBannerScheduleActive(banner, now = new Date()) {
  if (banner.startDate && now < new Date(banner.startDate)) return false;
  if (banner.endDate && now > new Date(banner.endDate)) return false;
  return true;
}

async function ensureUniqueSlug(slug, excludeId) {
  const existing = await HomepageBanner.findOne({
    slug,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select("_id")
    .lean();
  if (existing) {
    throw new AppError("Banner slug already exists", 409, "CONFLICT");
  }
}

async function getCategoryProductCount(categoryId) {
  const category = await Category.findById(categoryId).select("productCount").lean();
  if (category && typeof category.productCount === "number") {
    return category.productCount;
  }
  return Product.countDocuments({ categoryId, status: "APPROVED", isActive: true });
}

async function serializeBannerCategory(card, categoryMap) {
  const category = categoryMap.get(String(card.categoryId));
  if (!category) return null;

  const productCount = card.showProductCount !== false ? await getCategoryProductCount(category._id) : null;
  const title = card.customTitle || category.name;
  const subtitle = card.customSubtitle || category.description || "";
  const image =
    card.cardImage ||
    category.thumbnailUrl ||
    category.bannerUrl ||
    category.logo ||
    category.icon ||
    "";
  const url = card.ctaUrl || `/category/${category.slug}`;

  return {
    id: card._id,
    categoryId: category._id,
    name: category.name,
    slug: category.slug,
    title,
    subtitle,
    cardImage: image,
    ctaUrl: url,
    productCount,
    displayOrder: card.displayOrder ?? 0,
    showProductCount: card.showProductCount !== false,
  };
}

async function loadBannerCategories(bannerId, { activeOnly = false } = {}) {
  const query = { bannerId };
  if (activeOnly) query.status = "active";

  const cards = await HomepageBannerCategory.find(query).sort({ displayOrder: 1, createdAt: 1 }).lean();
  if (!cards.length) return [];

  const categoryIds = cards.map((c) => c.categoryId);
  const categories = await Category.find({
    _id: { $in: categoryIds },
    isActive: true,
    status: "active",
    visibility: "public",
  }).lean();

  const categoryMap = new Map(categories.map((c) => [String(c._id), c]));
  const serialized = [];
  for (const card of cards) {
    const item = await serializeBannerCategory(card, categoryMap);
    if (item) serialized.push(item);
  }
  return serialized;
}

async function serializePublicBanner(banner) {
  const categories = await loadBannerCategories(banner._id, { activeOnly: true });
  const desktop = resolveBannerMedia(banner, "desktop");
  const mobile = resolveBannerMedia(banner, "mobile");
  return {
    id: banner._id,
    name: banner.name,
    slug: banner.slug,
    title: banner.title,
    subtitle: banner.subtitle,
    description: banner.description,
    featuredCollectionText: banner.featuredCollectionText || "",
    ctaText: banner.ctaText,
    ctaUrl: banner.ctaUrl,
    mediaType: banner.mediaType || "image",
    desktopMedia: desktop.url,
    mobileMedia: mobile.url,
    desktopPoster: banner.desktopPoster || banner.desktopImage || "",
    mobilePoster: banner.mobilePoster || banner.mobileImage || banner.desktopPoster || "",
    desktopImage: desktop.url,
    mobileImage: mobile.url,
    showOverlay: Boolean(banner.showOverlay),
    overlayOpacity: Number(banner.overlayOpacity || 0),
    hoverModeEnabled: Boolean(banner.hoverModeEnabled),
    categoryHeading: banner.categoryHeading || "",
    categoryDescription: banner.categoryDescription || "",
    containerId: banner.containerId,
    displayOrder: banner.displayOrder,
    categories,
  };
}

async function listPublicBanners(query = {}) {
  const cached = await redisCache.getJson(CACHE_KEY);
  if (cached && !query.containerId && !query.containerSlug) return cached;

  const container = await bannerContainerService.resolvePublicContainer(query.containerId);
  if (!container) {
    return { container: null, settings: await getSettings(), banners: [] };
  }

  const now = new Date();
  const banners = await HomepageBanner.find({
    containerId: container._id,
    showOnHomepage: true,
    status: "active",
  })
    .sort({ displayOrder: 1, createdAt: 1 })
    .lean();

  const activeBanners = banners.filter((b) => isBannerScheduleActive(b, now));
  const containerSettings = { ...DEFAULT_SETTINGS, ...(container.settings || {}) };
  const payload = {
    container: bannerContainerService.serializeContainer(container, activeBanners.length),
    settings: containerSettings,
    banners: await Promise.all(activeBanners.map(serializePublicBanner)),
  };

  if (!query.containerId && !query.containerSlug) {
    await redisCache.setJson(CACHE_KEY, payload, CACHE_TTL);
  }
  return payload;
}

async function listAdminBanners(containerId) {
  const query = containerId ? { containerId } : {};
  const banners = await HomepageBanner.find(query).sort({ displayOrder: 1, createdAt: -1 }).lean();
  const cards = await HomepageBannerCategory.find({ bannerId: { $in: banners.map((b) => b._id) } })
    .sort({ displayOrder: 1 })
    .lean();

  const cardsByBanner = cards.reduce((acc, card) => {
    const key = String(card.bannerId);
    if (!acc[key]) acc[key] = [];
    acc[key].push(card);
    return acc;
  }, {});

  return banners.map((banner) => ({
    ...banner,
    categories: cardsByBanner[String(banner._id)] || [],
  }));
}

async function getAdminBannerById(bannerId) {
  const banner = await HomepageBanner.findById(bannerId).lean();
  if (!banner) throw new AppError("Banner not found", 404, "NOT_FOUND");
  const categories = await HomepageBannerCategory.find({ bannerId }).sort({ displayOrder: 1 }).lean();
  return { ...banner, categories };
}

async function syncBannerCategories(bannerId, categories = [], meta = {}) {
  const settings = await getSettings();
  const maxCards = Number(settings.maxCategoryCards || DEFAULT_SETTINGS.maxCategoryCards);
  if (categories.length > maxCards) {
    throw new AppError(`Maximum ${maxCards} category cards allowed per banner`, 400, "VALIDATION_ERROR");
  }

  await HomepageBannerCategory.deleteMany({ bannerId });

  if (!categories.length) return [];

  const rows = categories.map((item, index) => ({
    bannerId,
    categoryId: item.categoryId,
    displayOrder: Number.isFinite(Number(item.displayOrder)) ? Number(item.displayOrder) : index,
    customTitle: String(item.customTitle || "").trim(),
    customSubtitle: String(item.customSubtitle || "").trim(),
    cardImage: String(item.cardImage || "").trim(),
    ctaUrl: String(item.ctaUrl || "").trim(),
    showProductCount: item.showProductCount !== false,
    status: item.status === "inactive" ? "inactive" : "active",
  }));

  return HomepageBannerCategory.insertMany(rows);
}

async function syncContainerForBanner(banner, meta = {}) {
  if (!banner?.containerId) return null;
  const container = await bannerContainerService.getAdminContainerById(banner.containerId).catch(() => null);
  if (!container) return null;
  return syncBannerContainerToBuilder(container, meta);
}

async function createBanner(payload, meta = {}) {
  const slug = generateSlug(payload.slug || payload.name);
  await ensureUniqueSlug(slug);

  let containerId = payload.containerId || null;
  if (!containerId) {
    const defaultContainer = await bannerContainerService.ensureDefaultContainer(meta);
    containerId = defaultContainer._id;
  }

  const banner = await HomepageBanner.create({
    name: String(payload.name).trim(),
    slug,
    title: String(payload.title || "").trim(),
    subtitle: String(payload.subtitle || "").trim(),
    description: String(payload.description || "").trim(),
    featuredCollectionText: String(payload.featuredCollectionText || "").trim(),
    ctaText: String(payload.ctaText || "Shop now").trim(),
    ctaUrl: String(payload.ctaUrl || "").trim(),
    mediaType: payload.mediaType === "video" ? "video" : "image",
    desktopMedia: String(payload.desktopMedia || payload.desktopImage || "").trim(),
    mobileMedia: String(payload.mobileMedia || payload.mobileImage || "").trim(),
    desktopPoster: String(payload.desktopPoster || "").trim(),
    mobilePoster: String(payload.mobilePoster || "").trim(),
    desktopImage: String(payload.desktopImage || payload.desktopMedia || "").trim(),
    mobileImage: String(payload.mobileImage || payload.mobileMedia || "").trim(),
    showOverlay: Boolean(payload.showOverlay),
    overlayOpacity: Math.min(1, Math.max(0, Number(payload.overlayOpacity || 0))),
    hoverModeEnabled: Boolean(payload.hoverModeEnabled),
    categoryHeading: String(payload.categoryHeading || "").trim(),
    categoryDescription: String(payload.categoryDescription || "").trim(),
    status: payload.status || "active",
    displayOrder: Number(payload.displayOrder || 0),
    startDate: payload.startDate || null,
    endDate: payload.endDate || null,
    showOnHomepage: payload.showOnHomepage !== false,
    containerId,
    createdBy: meta.actor?.sub || meta.actor?._id || null,
    updatedBy: meta.actor?.sub || meta.actor?._id || null,
  });

  if (Array.isArray(payload.categories) && payload.categories.length) {
    await syncBannerCategories(banner._id, payload.categories, meta);
  }

  await invalidateCache();
  await syncContainerForBanner(banner, meta);
  await auditService.log({
    actor: meta.actor,
    action: "HOMEPAGE_BANNER_CREATED",
    entityType: "HomepageBanner",
    entityId: banner._id,
    metadata: { name: banner.name, slug: banner.slug },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return getAdminBannerById(banner._id);
}

async function updateBanner(bannerId, payload, meta = {}) {
  const banner = await HomepageBanner.findById(bannerId);
  if (!banner) throw new AppError("Banner not found", 404, "NOT_FOUND");

  const oldValues = banner.toObject();
  if (payload.slug || payload.name) {
    const slug = generateSlug(payload.slug || payload.name || banner.name);
    await ensureUniqueSlug(slug, banner._id);
    banner.slug = slug;
  }
  if (payload.name !== undefined) banner.name = String(payload.name).trim();
  if (payload.title !== undefined) banner.title = String(payload.title || "").trim();
  if (payload.subtitle !== undefined) banner.subtitle = String(payload.subtitle || "").trim();
  if (payload.description !== undefined) banner.description = String(payload.description || "").trim();
  if (payload.featuredCollectionText !== undefined) banner.featuredCollectionText = String(payload.featuredCollectionText || "").trim();
  if (payload.ctaText !== undefined) banner.ctaText = String(payload.ctaText || "").trim();
  if (payload.ctaUrl !== undefined) banner.ctaUrl = String(payload.ctaUrl || "").trim();
  applyBannerMediaFields(banner, payload);
  if (payload.status !== undefined) banner.status = payload.status;
  if (payload.displayOrder !== undefined) banner.displayOrder = Number(payload.displayOrder || 0);
  if (payload.startDate !== undefined) banner.startDate = payload.startDate || null;
  if (payload.endDate !== undefined) banner.endDate = payload.endDate || null;
  if (payload.showOnHomepage !== undefined) banner.showOnHomepage = Boolean(payload.showOnHomepage);
  if (payload.containerId !== undefined) banner.containerId = payload.containerId || null;
  banner.updatedBy = meta.actor?.sub || meta.actor?._id || null;

  await banner.save();

  if (Array.isArray(payload.categories)) {
    await syncBannerCategories(banner._id, payload.categories, meta);
  }

  await invalidateCache();
  await syncContainerForBanner(banner, meta);
  await auditService.log({
    actor: meta.actor,
    action: "HOMEPAGE_BANNER_UPDATED",
    entityType: "HomepageBanner",
    entityId: banner._id,
    metadata: { oldValues, newValues: payload },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return getAdminBannerById(banner._id);
}

async function deleteBanner(bannerId, meta = {}) {
  const banner = await HomepageBanner.findById(bannerId);
  if (!banner) throw new AppError("Banner not found", 404, "NOT_FOUND");

  const containerId = banner.containerId;
  await HomepageBannerCategory.deleteMany({ bannerId });
  await banner.deleteOne();
  await invalidateCache();
  if (containerId) {
    const container = await bannerContainerService.getAdminContainerById(containerId).catch(() => null);
    if (container) await syncBannerContainerToBuilder(container, meta);
  }

  await auditService.log({
    actor: meta.actor,
    action: "HOMEPAGE_BANNER_DELETED",
    entityType: "HomepageBanner",
    entityId: bannerId,
    metadata: { name: banner.name },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { deleted: true };
}

async function assignCategories(bannerId, categories, meta = {}) {
  const banner = await HomepageBanner.findById(bannerId);
  if (!banner) throw new AppError("Banner not found", 404, "NOT_FOUND");

  await syncBannerCategories(bannerId, categories, meta);
  await invalidateCache();

  await auditService.log({
    actor: meta.actor,
    action: "HOMEPAGE_BANNER_CATEGORIES_UPDATED",
    entityType: "HomepageBanner",
    entityId: bannerId,
    metadata: { count: categories.length },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return getAdminBannerById(bannerId);
}

async function removeCategory(bannerId, categoryId, meta = {}) {
  await HomepageBannerCategory.deleteOne({ bannerId, categoryId });
  await invalidateCache();
  await auditService.log({
    actor: meta.actor,
    action: "HOMEPAGE_BANNER_CATEGORY_REMOVED",
    entityType: "HomepageBanner",
    entityId: bannerId,
    metadata: { categoryId },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
  return getAdminBannerById(bannerId);
}

async function uploadBannerImages(bannerId, files = {}, meta = {}) {
  const banner = await HomepageBanner.findById(bannerId);
  if (!banner) throw new AppError("Banner not found", 404, "NOT_FOUND");

  if (!files.desktop?.[0] && !files.mobile?.[0] && !files.desktopPoster?.[0] && !files.mobilePoster?.[0]) {
    throw new AppError("No media files provided", 400, "VALIDATION_ERROR");
  }

  const isVideoMime = (file) => /^video\//i.test(file?.mimetype || "");

  if (files.desktop?.[0]) {
    const file = files.desktop[0];
    const [desktop] = await uploadMany([file], {
      folder: isVideoMime(file) ? "homepage/banners/desktop/video" : "homepage/banners/desktop",
    });
    if (desktop) {
      if (isVideoMime(file)) {
        banner.mediaType = "video";
        banner.desktopMedia = desktop.url;
      } else {
        banner.desktopMedia = desktop.url;
        banner.desktopImage = desktop.url;
        banner.desktopImagePublicId = desktop.public_id || desktop.publicId || "";
      }
    }
  }
  if (files.mobile?.[0]) {
    const file = files.mobile[0];
    const [mobile] = await uploadMany([file], {
      folder: isVideoMime(file) ? "homepage/banners/mobile/video" : "homepage/banners/mobile",
    });
    if (mobile) {
      if (isVideoMime(file)) {
        banner.mediaType = "video";
        banner.mobileMedia = mobile.url;
      } else {
        banner.mobileMedia = mobile.url;
        banner.mobileImage = mobile.url;
        banner.mobileImagePublicId = mobile.public_id || mobile.publicId || "";
      }
    }
  }
  if (files.desktopPoster?.[0]) {
    const [poster] = await uploadMany([files.desktopPoster[0]], { folder: "homepage/banners/desktop/poster" });
    if (poster) banner.desktopPoster = poster.url;
  }
  if (files.mobilePoster?.[0]) {
    const [poster] = await uploadMany([files.mobilePoster[0]], { folder: "homepage/banners/mobile/poster" });
    if (poster) banner.mobilePoster = poster.url;
  }
  banner.updatedBy = meta.actor?.sub || meta.actor?._id || null;
  await banner.save();
  await invalidateCache();
  await syncContainerForBanner(banner, meta);

  await auditService.log({
    actor: meta.actor,
    action: "HOMEPAGE_BANNER_IMAGE_CHANGED",
    entityType: "HomepageBanner",
    entityId: bannerId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return getAdminBannerById(bannerId);
}

async function trackEvent(bannerId, payload = {}) {
  const banner = await HomepageBanner.findById(bannerId);
  if (!banner) throw new AppError("Banner not found", 404, "NOT_FOUND");

  await HomepageBannerAnalytics.create({
    bannerId,
    categoryId: payload.categoryId || null,
    eventType: payload.eventType,
    userId: payload.userId || null,
    sessionId: payload.sessionId || "",
    revenue: Number(payload.revenue || 0),
    orderId: payload.orderId || null,
  });

  const inc = {};
  if (payload.eventType === "view") inc["analytics.views"] = 1;
  if (payload.eventType === "click") inc["analytics.clicks"] = 1;
  if (payload.eventType === "conversion") {
    inc["analytics.conversions"] = 1;
    inc["analytics.revenue"] = Number(payload.revenue || 0);
  }
  if (Object.keys(inc).length) {
    await HomepageBanner.updateOne({ _id: bannerId }, { $inc: inc });
  }

  if (payload.categoryId && payload.eventType === "category_click") {
    await HomepageBannerCategory.updateOne(
      { bannerId, categoryId: payload.categoryId },
      { $inc: { "analytics.clicks": 1 } }
    );
  }

  return { tracked: true };
}

async function getAnalyticsSummary() {
  const [total, active, inactive, topClicked, topRevenue] = await Promise.all([
    HomepageBanner.countDocuments({}),
    HomepageBanner.countDocuments({ status: "active" }),
    HomepageBanner.countDocuments({ status: "inactive" }),
    HomepageBanner.find({}).sort({ "analytics.clicks": -1 }).limit(5).lean(),
    HomepageBanner.find({}).sort({ "analytics.revenue": -1 }).limit(5).lean(),
  ]);

  const topCategoryCards = await HomepageBannerCategory.find({})
    .sort({ "analytics.clicks": -1 })
    .limit(5)
    .populate("categoryId", "name slug")
    .lean();

  return {
    totalBanners: total,
    activeBanners: active,
    inactiveBanners: inactive,
    topClicked,
    topRevenue,
    topCategoryCards,
  };
}

async function reorderBanners(items = [], meta = {}) {
  const updates = items.map((item) =>
    HomepageBanner.updateOne(
      { _id: item.id },
      { $set: { displayOrder: Number(item.displayOrder || 0), updatedBy: meta.actor?.sub || meta.actor?._id || null } }
    )
  );
  await Promise.all(updates);
  await invalidateCache();
  const firstBanner = items[0]?.id ? await HomepageBanner.findById(items[0].id).select("containerId").lean() : null;
  if (firstBanner?.containerId) {
    const container = await bannerContainerService.getAdminContainerById(firstBanner.containerId).catch(() => null);
    if (container) await syncBannerContainerToBuilder(container, meta);
  }
  await auditService.log({
    actor: meta.actor,
    action: "HOMEPAGE_BANNERS_REORDERED",
    entityType: "HomepageBanner",
    entityId: null,
    metadata: { count: items.length },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
  return listAdminBanners();
}

async function updateSettings(value, meta = {}) {
  await PlatformConfig.findOneAndUpdate(
    { key: SETTINGS_KEY },
    {
      $set: {
        key: SETTINGS_KEY,
        value: { ...DEFAULT_SETTINGS, ...value },
        category: "general",
        type: "object",
        isPublic: true,
        updatedBy: meta.actor?.sub || meta.actor?._id || null,
      },
    },
    { upsert: true, new: true }
  );
  await invalidateCache();
  return getSettings();
}

module.exports = {
  listPublicBanners,
  listAdminBanners,
  getAdminBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
  assignCategories,
  removeCategory,
  uploadBannerImages,
  trackEvent,
  getAnalyticsSummary,
  getSettings,
  updateSettings,
  reorderBanners,
  invalidateCache,
};
