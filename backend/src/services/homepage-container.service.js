const mongoose = require("mongoose");
const { HomepageContainer } = require("../models/HomepageContainer");
const { Product } = require("../models/Product");
const { Vendor } = require("../models/Vendor");
const { Category } = require("../models/Category");
const { Subcategory } = require("../models/Subcategory");
const { InfluencerProfile, InfluencerStorefront, InfluencerCollection } = require("../modules/influencer/model");
const { AppError } = require("../utils/AppError");
const { uploadMany } = require("../utils/upload");
const {
  normalizeContainerType,
  getContainerTypeSchema,
  listContainerTypeSchemas,
  VENDOR_STOREFRONT_TYPES,
  INFLUENCER_STOREFRONT_TYPES,
} = require("../config/homepageContainerRegistry");

const DEFAULT_PREVIEW_LIMIT = 12;
const DEFAULT_VENDOR_LAYOUT_LIMIT = 20;
const CACHE_TTL_MS = 60 * 1000;
const responseCache = new Map();
const VENDOR_DATA_SOURCE_TYPES = new Set([
  "CURRENT_VENDOR_PRODUCTS",
  "CURRENT_VENDOR_FEATURED",
  "CURRENT_VENDOR_NEW_ARRIVALS",
  "CURRENT_VENDOR_BEST_SELLERS",
  "CURRENT_VENDOR_DEALS",
  "CURRENT_VENDOR_TOP_RATED",
  "CURRENT_VENDOR_RECOMMENDED",
]);
const VENDOR_STOREFRONT_TYPE_SET = new Set(VENDOR_STOREFRONT_TYPES);
const INFLUENCER_STOREFRONT_TYPE_SET = new Set(INFLUENCER_STOREFRONT_TYPES);

function normalizeDataSourceType(value) {
  const next = String(value || "DEFAULT").trim().toUpperCase();
  if (next === "DEFAULT" || VENDOR_DATA_SOURCE_TYPES.has(next)) return next;
  return "DEFAULT";
}

function setCache(key, value) {
  responseCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function getCache(key) {
  const cached = responseCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }
  return cached.value;
}

function invalidateCache(prefix = "homepage:") {
  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) {
      responseCache.delete(key);
    }
  }
}

function toObjectIdArray(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((item) => String(item || "").trim())
    .filter((item) => mongoose.isValidObjectId(item))
    .map((item) => new mongoose.Types.ObjectId(item));
}

function toStringArray(values = []) {
  if (!Array.isArray(values)) {
    if (typeof values === "string") {
      return values
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  }

  return values
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePositiveNumber(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeDate(value, fallback = null) {
  if (!value) return fallback;
  const next = new Date(value);
  return Number.isNaN(next.getTime()) ? fallback : next;
}

function normalizeInteger(value, fallback = 0, { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {}) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(Math.max(Math.round(next), min), max);
}

function extractNumericValue(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const match = String(value).match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : fallback;
}

function mapLegacyWidthType(value) {
  switch (String(value || "full").trim().toLowerCase()) {
    case "wide":
    case "content":
    case "boxed":
      return "boxed";
    case "medium":
      return "medium";
    case "narrow":
      return "narrow";
    case "screen":
    case "full":
      return "full";
    default:
      return "custom";
  }
}

function mapLegacyHeightType(value) {
  const raw = String(value || "auto").trim().toLowerCase();
  if (!raw || raw === "auto") return "auto";
  const numeric = extractNumericValue(raw, null);
  if (numeric === null) return "custom";
  if (numeric <= 300) return "small";
  if (numeric <= 500) return "medium";
  if (numeric <= 700) return "large";
  if (numeric <= 900) return "extraLarge";
  return "custom";
}

function mapLegacyTheme(value) {
  switch (String(value || "DEFAULT").trim().toUpperCase()) {
    case "LIGHT":
      return "light";
    case "DARK":
      return "dark";
    case "BRAND":
      return "premium";
    case "DEFAULT":
    default:
      return "default";
  }
}

function mapLegacyAnimation(value) {
  switch (String(value || "FADE_UP").trim().toUpperCase()) {
    case "NONE":
      return "none";
    case "FADE_IN":
      return "fadeUp";
    case "SLIDE_LEFT":
      return "fadeLeft";
    case "SLIDE_RIGHT":
      return "fadeRight";
    case "FADE_UP":
    default:
      return "fadeUp";
  }
}

function normalizeLayout(input = {}, legacyPresentation = {}, payload = {}) {
  const backgroundType =
    input.backgroundType ||
    payload.backgroundType ||
    (input.backgroundVideo || payload.backgroundVideo
      ? "video"
      : input.backgroundImage || payload.backgroundImage
        ? "image"
        : input.gradientColor1 || input.gradientColor2 || payload.gradientColor1 || payload.gradientColor2
          ? "gradient"
          : "solid");

  return {
    widthType: String(input.widthType || payload.widthType || mapLegacyWidthType(payload.containerWidth ?? legacyPresentation.containerWidth)).trim(),
    customWidth: normalizeInteger(
      input.customWidth ?? payload.customWidth ?? extractNumericValue(payload.containerWidth ?? legacyPresentation.containerWidth, 1400),
      1400,
      { min: 200, max: 2000 }
    ),
    heightType: String(input.heightType || payload.heightType || mapLegacyHeightType(payload.containerHeight ?? legacyPresentation.containerHeight)).trim(),
    customHeight: normalizeInteger(
      input.customHeight ?? payload.customHeight ?? extractNumericValue(payload.containerHeight ?? legacyPresentation.containerHeight, 450),
      450,
      { min: 100, max: 2000 }
    ),
    alignment: String(input.alignment || payload.alignment || "center").trim(),
    positionX: normalizeInteger(
      input.positionX ?? payload.positionX ?? extractNumericValue(payload.containerOffsetX ?? legacyPresentation.containerOffsetX, 0),
      0,
      { min: -2000, max: 2000 }
    ),
    positionY: normalizeInteger(
      input.positionY ?? payload.positionY ?? extractNumericValue(payload.containerOffsetY ?? legacyPresentation.containerOffsetY, 0),
      0,
      { min: -2000, max: 2000 }
    ),
    padding: normalizeInteger(input.padding ?? payload.padding ?? extractNumericValue(legacyPresentation.padding, 24), 24, { min: 0, max: 150 }),
    marginTop: normalizeInteger(input.marginTop ?? payload.marginTop, 16, { min: 0, max: 150 }),
    marginBottom: normalizeInteger(input.marginBottom ?? payload.marginBottom, 16, { min: 0, max: 150 }),
    marginLeft: normalizeInteger(input.marginLeft ?? payload.marginLeft, 0, { min: 0, max: 150 }),
    marginRight: normalizeInteger(input.marginRight ?? payload.marginRight, 0, { min: 0, max: 150 }),
    backgroundType: String(backgroundType).trim(),
    backgroundColor: String(input.backgroundColor ?? payload.backgroundColor ?? legacyPresentation.backgroundColor ?? "#ffffff").trim() || "#ffffff",
    gradientColor1: String(input.gradientColor1 ?? payload.gradientColor1 ?? "#fff7ed").trim() || "#fff7ed",
    gradientColor2: String(input.gradientColor2 ?? payload.gradientColor2 ?? "#fde68a").trim() || "#fde68a",
    gradientDirection: String(input.gradientDirection ?? payload.gradientDirection ?? "to right").trim() || "to right",
    backgroundImage: String(input.backgroundImage ?? payload.backgroundImage ?? "").trim(),
    backgroundVideo: String(input.backgroundVideo ?? payload.backgroundVideo ?? "").trim(),
    theme: String(input.theme || payload.theme || mapLegacyTheme(payload.containerTheme ?? legacyPresentation.containerTheme)).trim(),
    animation: String(input.animation || payload.animation || mapLegacyAnimation(payload.animation ?? legacyPresentation.animation)).trim(),
  };
}

function getDefaultConfig(type, input = {}) {
  const schema = getContainerTypeSchema(type);
  return (schema.typeFields || []).reduce((acc, field) => {
    if (input[field.name] !== undefined) {
      acc[field.name] = input[field.name];
    } else if (field.defaultValue !== undefined) {
      acc[field.name] = field.defaultValue;
    }
    return acc;
  }, {});
}

function normalizePayload(payload = {}, actorId = null, { partial = false } = {}) {
  const containerType = normalizeContainerType(payload.containerType || payload.type || "CAROUSEL");
  const schema = getContainerTypeSchema(containerType);

  const visibility = payload.visibility || {};
  const presentation = payload.presentation || {};
  const layoutInput = payload.layout || presentation.layout || {};
  const filters = payload.filters || {};
  const schedule = payload.schedule || {};
  const inputConfig = payload.config || {};
  const layout = normalizeLayout(layoutInput, presentation, payload);

  const normalized = {
    ...(payload.title !== undefined ? { title: String(payload.title || "").trim() } : {}),
    ...(payload.slug !== undefined ? { slug: String(payload.slug || "").trim() } : {}),
    ...(payload.description !== undefined ? { description: String(payload.description || "").trim() } : {}),
    containerType,
    ...(payload.dataSourceType !== undefined ? { dataSourceType: normalizeDataSourceType(payload.dataSourceType) } : {}),
    ...(payload.priority !== undefined ? { priority: Number(payload.priority || 0) } : {}),
    ...(payload.status !== undefined ? { status: String(payload.status || "").trim().toUpperCase() } : {}),
    ...(payload.analyticsEnabled !== undefined ? { analyticsEnabled: Boolean(payload.analyticsEnabled) } : {}),
    visibility: {
      desktop:
        payload.desktopVisible !== undefined
          ? Boolean(payload.desktopVisible)
          : visibility.desktop !== undefined
            ? Boolean(visibility.desktop)
            : true,
      tablet:
        payload.tabletVisible !== undefined
          ? Boolean(payload.tabletVisible)
          : visibility.tablet !== undefined
            ? Boolean(visibility.tablet)
            : true,
      mobile:
        payload.mobileVisible !== undefined
          ? Boolean(payload.mobileVisible)
          : visibility.mobile !== undefined
            ? Boolean(visibility.mobile)
            : true,
    },
    presentation: {
      backgroundColor: layout.backgroundType === "solid" ? layout.backgroundColor : String(payload.backgroundColor ?? presentation.backgroundColor ?? "").trim(),
      textColor: String(payload.textColor ?? presentation.textColor ?? "").trim(),
      padding: `${layout.padding}px`,
      margin: `${layout.marginTop}px ${layout.marginRight}px ${layout.marginBottom}px ${layout.marginLeft}px`,
      animation: String(payload.animation ?? presentation.animation ?? "FADE_UP").trim().toUpperCase(),
      customCssClasses: String(payload.customCssClasses ?? presentation.customCssClasses ?? "").trim(),
      containerWidth:
        layout.widthType === "custom"
          ? `${layout.customWidth}px`
          : layout.widthType,
      containerHeight:
        layout.heightType === "custom"
          ? `${layout.customHeight}px`
          : layout.heightType,
      containerTheme: String(payload.containerTheme ?? presentation.containerTheme ?? "DEFAULT").trim().toUpperCase(),
      containerOffsetX: `${layout.positionX}px`,
      containerOffsetY: `${layout.positionY}px`,
      layout,
    },
    schedule: {
      enabled:
        payload.scheduleEnabled !== undefined
          ? Boolean(payload.scheduleEnabled)
          : schedule.enabled !== undefined
            ? Boolean(schedule.enabled)
            : Boolean(payload.scheduleStart || payload.scheduleEnd || payload.startDate || payload.endDate),
      start: normalizeDate(payload.scheduleStart ?? payload.startDate ?? schedule.start, null),
      end: normalizeDate(payload.scheduleEnd ?? payload.endDate ?? schedule.end, null),
    },
    filters: {
      vendorIds: toObjectIdArray(payload.vendorIds ?? filters.vendorIds ?? []),
      categoryIds: toObjectIdArray(payload.categoryIds ?? filters.categoryIds ?? []),
      subCategoryIds: toObjectIdArray(payload.subCategoryIds ?? filters.subCategoryIds ?? []),
      brandIds: toStringArray(payload.brandIds ?? filters.brandIds ?? []),
      tags: toStringArray(payload.tags ?? filters.tags ?? []).map((item) => item.toLowerCase()),
      minPrice: normalizePositiveNumber(payload.minPrice ?? filters.minPrice, null),
      maxPrice: normalizePositiveNumber(payload.maxPrice ?? filters.maxPrice, null),
      minDiscountPercentage: normalizePositiveNumber(payload.minDiscountPercentage ?? filters.minDiscountPercentage, 0),
      minimumRating: normalizePositiveNumber(payload.minimumRating ?? filters.minimumRating, 0),
      showOnlyInStock:
        payload.showOnlyInStock !== undefined
          ? Boolean(payload.showOnlyInStock)
          : filters.showOnlyInStock !== undefined
            ? Boolean(filters.showOnlyInStock)
            : true,
      sortBy: String(payload.sortBy ?? filters.sortBy ?? schema.defaultSortBy ?? "TRENDING").trim().toUpperCase(),
      maxProductsToShow: Math.min(
        Math.max(Number(payload.maxProductsToShow ?? filters.maxProductsToShow ?? DEFAULT_PREVIEW_LIMIT), 1),
        100
      ),
      productSelectionMode: String(
        payload.productSelectionMode ?? filters.productSelectionMode ?? "AUTO"
      ).trim().toUpperCase(),
      manualProductIds: toObjectIdArray(payload.manualProductIds ?? filters.manualProductIds ?? []),
    },
    config: getDefaultConfig(containerType, { ...inputConfig, ...(payload.config || {}) }),
  };

  for (const field of schema.typeFields || []) {
    if (payload[field.name] !== undefined) {
      normalized.config[field.name] = payload[field.name];
    }
  }

  if (!schema.supportsProductFilters) {
    normalized.filters = {
      vendorIds: [],
      categoryIds: [],
      subCategoryIds: [],
      brandIds: [],
      tags: [],
      minPrice: null,
      maxPrice: null,
      minDiscountPercentage: 0,
      minimumRating: 0,
      showOnlyInStock: false,
      sortBy: schema.defaultSortBy || "TRENDING",
      maxProductsToShow: DEFAULT_PREVIEW_LIMIT,
      productSelectionMode: "AUTO",
      manualProductIds: [],
    };
  }

  if (!partial && actorId) {
    normalized.createdBy = actorId;
  }
  if (actorId) {
    normalized.updatedBy = actorId;
  }

  return normalized;
}

async function validateReferences(payload = {}, existingId = null) {
  const filters = payload.filters || {};
  const config = payload.config || {};
  const featuredProductIds =
    payload.containerType === "FEATURED_PRODUCTS"
      ? [
          ...(Array.isArray(config.heroProduct) ? config.heroProduct : config.heroProduct ? [config.heroProduct] : []),
          ...(Array.isArray(config.secondaryProducts) ? config.secondaryProducts : []),
        ].filter(Boolean)
      : [];
  const comboProductIds = payload.containerType === "COMBO_DEALS" ? extractConfigIds(config.bundleProducts) : [];
  const showcaseCategoryIds = payload.containerType === "CATEGORY_SHOWCASE" ? extractConfigIds(config.categories) : [];
  const manualVendorIds = isVendorStorefrontContainer(payload.containerType) && String(config.storefrontSelectionMode || "AUTO").toUpperCase() === "MANUAL"
    ? extractConfigIds(config.manualVendorIds).filter((id) => mongoose.isValidObjectId(id))
    : [];
  const manualInfluencerIds = isInfluencerStorefrontContainer(payload.containerType) && String(config.storefrontSelectionMode || "AUTO").toUpperCase() === "MANUAL"
    ? extractConfigIds(config.manualInfluencerIds).filter((id) => mongoose.isValidObjectId(id))
    : [];
  const [vendors, categories, subcategories, manualProducts, featuredProducts, comboProducts, showcaseCategories, manualStoreVendors, manualStoreInfluencers, slugConflict] = await Promise.all([
    filters.vendorIds?.length
      ? Vendor.find({ _id: { $in: filters.vendorIds }, status: "approved" }).select("_id").lean()
      : Promise.resolve([]),
    filters.categoryIds?.length
      ? Category.find({ _id: { $in: filters.categoryIds }, isActive: true }).select("_id").lean()
      : Promise.resolve([]),
    filters.subCategoryIds?.length
      ? Subcategory.find({ _id: { $in: filters.subCategoryIds }, status: "active" }).select("_id categoryId").lean()
      : Promise.resolve([]),
    filters.manualProductIds?.length
      ? Product.find({
          _id: { $in: filters.manualProductIds },
          status: "APPROVED",
          isActive: true,
        })
          .select("_id sellerId categoryId subCategoryId")
          .lean()
      : Promise.resolve([]),
    featuredProductIds.length
      ? Product.find({
          _id: { $in: featuredProductIds },
          status: "APPROVED",
          isActive: true,
        })
          .select("_id")
          .lean()
      : Promise.resolve([]),
    comboProductIds.length
      ? Product.find({
          _id: { $in: comboProductIds },
          status: "APPROVED",
          isActive: true,
        })
          .select("_id")
          .lean()
      : Promise.resolve([]),
    showcaseCategoryIds.length
      ? Category.find({ _id: { $in: showcaseCategoryIds }, isActive: true }).select("_id").lean()
      : Promise.resolve([]),
    manualVendorIds.length
      ? Vendor.find({ _id: { $in: manualVendorIds }, status: "approved", isStoreVisible: { $ne: false } }).select("_id").lean()
      : Promise.resolve([]),
    manualInfluencerIds.length
      ? InfluencerProfile.find({ _id: { $in: manualInfluencerIds }, state: { $in: ["verified", "active"] } }).select("_id").lean()
      : Promise.resolve([]),
    payload.slug
      ? HomepageContainer.findOne({
          slug: payload.slug,
          ...(existingId ? { _id: { $ne: existingId } } : {}),
        })
          .select("_id")
          .lean()
      : Promise.resolve(null),
  ]);

  if (slugConflict) {
    throw new AppError("Homepage container slug already exists", 409, "SLUG_EXISTS");
  }

  if (filters.vendorIds?.length && vendors.length !== filters.vendorIds.length) {
    throw new AppError("One or more selected vendors are invalid or not approved", 400, "INVALID_VENDOR_SCOPE");
  }

  if (filters.categoryIds?.length && categories.length !== filters.categoryIds.length) {
    throw new AppError("One or more selected categories are invalid", 400, "INVALID_CATEGORY_SCOPE");
  }

  if (filters.subCategoryIds?.length && subcategories.length !== filters.subCategoryIds.length) {
    throw new AppError("One or more selected subcategories are invalid", 400, "INVALID_SUBCATEGORY_SCOPE");
  }

  const categorySet = new Set((filters.categoryIds || []).map((item) => String(item)));
  if (categorySet.size && subcategories.some((item) => !categorySet.has(String(item.categoryId)))) {
    throw new AppError("Selected subcategories must belong to the selected categories", 400, "SUBCATEGORY_CATEGORY_MISMATCH");
  }

  if (filters.productSelectionMode === "MANUAL" && filters.manualProductIds?.length) {
    if (manualProducts.length !== filters.manualProductIds.length) {
      throw new AppError("One or more manual products are invalid or not publicly visible", 400, "INVALID_MANUAL_PRODUCTS");
    }
  }

  if (featuredProductIds.length && featuredProducts.length !== new Set(featuredProductIds.map(String)).size) {
    throw new AppError("One or more featured products are invalid or not publicly visible", 400, "INVALID_FEATURED_PRODUCTS");
  }

  if (comboProductIds.length && comboProducts.length !== new Set(comboProductIds).size) {
    throw new AppError("One or more combo products are invalid or not publicly visible", 400, "INVALID_COMBO_PRODUCTS");
  }

  if (showcaseCategoryIds.length && showcaseCategories.length !== new Set(showcaseCategoryIds).size) {
    throw new AppError("One or more showcase categories are invalid", 400, "INVALID_SHOWCASE_CATEGORIES");
  }

  if (manualVendorIds.length && manualStoreVendors.length !== new Set(manualVendorIds).size) {
    throw new AppError("One or more selected storefront vendors are invalid or unavailable", 400, "INVALID_STOREFRONT_VENDORS");
  }

  if (manualInfluencerIds.length && manualStoreInfluencers.length !== new Set(manualInfluencerIds).size) {
    throw new AppError("One or more selected storefront influencers are invalid or unavailable", 400, "INVALID_STOREFRONT_INFLUENCERS");
  }

  validateTypeSpecificRules(payload);
}

function validateTypeSpecificRules(payload = {}) {
  const { containerType, config = {}, filters = {}, schedule = {} } = payload;

  if (schedule.enabled && schedule.start && schedule.end && schedule.start > schedule.end) {
    throw new AppError("Schedule start must be earlier than schedule end", 400, "INVALID_SCHEDULE");
  }

  if (containerType === "FLASH_SALE") {
    const start = normalizeDate(config.startTime, null);
    const end = normalizeDate(config.endTime, null);
    if (!start || !end || start >= end) {
      throw new AppError("Flash sale start time must be earlier than end time", 400, "INVALID_FLASH_SALE_WINDOW");
    }
  }

  const bannerMedia = Array.isArray(config.bannerMedia) ? config.bannerMedia : [];
  if (containerType === "BANNER" && !bannerMedia.length && !String(config.bannerImage || "").trim() && !String(config.bannerVideo || "").trim()) {
    throw new AppError("Banner image or banner video is required", 400, "BANNER_MEDIA_REQUIRED");
  }

  if (containerType === "VIDEO_PRODUCTS" && !String(config.videoUpload || "").trim()) {
    throw new AppError("Video upload is required for video products containers", 400, "VIDEO_REQUIRED");
  }

  if (containerType === "GRID" && !Number.isFinite(Number(config.desktopColumns))) {
    throw new AppError("Desktop columns are required for grid containers", 400, "GRID_COLUMNS_REQUIRED");
  }

  if (filters.maxPrice !== null && filters.minPrice !== null && filters.maxPrice < filters.minPrice) {
    throw new AppError("Maximum price must be greater than or equal to minimum price", 400, "INVALID_PRICE_RANGE");
  }
}

function matchesSchedule(container = {}, now = new Date()) {
  if (container.status !== "ACTIVE") return false;
  if (!container.schedule?.enabled) return true;
  if (container.schedule?.start && new Date(container.schedule.start) > now) return false;
  if (container.schedule?.end && new Date(container.schedule.end) < now) return false;
  return true;
}

function matchesDevice(container = {}, device = "all") {
  const normalized = String(device || "all").trim().toLowerCase();
  if (!normalized || normalized === "all") return true;
  if (normalized === "mobile") return container.visibility?.mobile !== false;
  if (normalized === "tablet") return container.visibility?.tablet !== false;
  if (normalized === "desktop") return container.visibility?.desktop !== false;
  return true;
}

function buildProductBaseMatch(container = {}, approvedVendorIds = []) {
  const filters = container.filters || {};
  const currentVendorId = container.__currentVendorId;
  const match = {
    status: "APPROVED",
    isActive: true,
  };

  if (currentVendorId && mongoose.isValidObjectId(currentVendorId)) {
    match.sellerId = new mongoose.Types.ObjectId(currentVendorId);
  } else if (approvedVendorIds.length) {
    match.sellerId = { $in: approvedVendorIds };
  }

  if (!currentVendorId && filters.vendorIds?.length) {
    match.sellerId = { $in: filters.vendorIds.map((item) => new mongoose.Types.ObjectId(item)) };
  }

  if (filters.categoryIds?.length) {
    match.categoryId = { $in: filters.categoryIds.map((item) => new mongoose.Types.ObjectId(item)) };
  }

  if (filters.subCategoryIds?.length) {
    match.subCategoryId = { $in: filters.subCategoryIds.map((item) => new mongoose.Types.ObjectId(item)) };
  }

  if (filters.tags?.length) {
    match.tags = { $in: filters.tags.map((item) => String(item).toLowerCase()) };
  }

  if (filters.productSelectionMode === "MANUAL" && filters.manualProductIds?.length) {
    match._id = { $in: filters.manualProductIds.map((item) => new mongoose.Types.ObjectId(item)) };
  }

  if (filters.brandIds?.length) {
    const brandRegex = filters.brandIds.map((item) => new RegExp(`^${escapeRegex(item)}$`, "i"));
    match.$or = [
      { "attributes.brand": { $in: brandRegex } },
      { brand: { $in: brandRegex } },
      { name: { $in: brandRegex } },
    ];
  }

  return match;
}

function buildComputedFields() {
  return {
    availableStock: {
      $cond: [
        { $gt: [{ $size: { $ifNull: ["$variants", []] } }, 0] },
        {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: { $ifNull: ["$variants", []] },
                  as: "variant",
                  cond: { $ne: ["$$variant.isActive", false] },
                },
              },
              as: "variant",
              in: { $max: [0, { $subtract: [{ $ifNull: ["$$variant.stock", 0] }, { $ifNull: ["$$variant.reservedStock", 0] }] }] },
            },
          },
        },
        { $max: [0, { $subtract: [{ $ifNull: ["$stock", 0] }, 0] }] },
      ],
    },
    effectivePrice: {
      $cond: [
        {
          $and: [
            { $ne: ["$discountPrice", null] },
            { $gt: ["$discountPrice", 0] },
            { $lt: ["$discountPrice", "$price"] },
          ],
        },
        "$discountPrice",
        "$price",
      ],
    },
    computedDiscountPercentage: {
      $cond: [
        {
          $and: [
            { $gt: ["$price", 0] },
            { $ne: ["$discountPrice", null] },
            { $gt: ["$discountPrice", 0] },
            { $lt: ["$discountPrice", "$price"] },
          ],
        },
        {
          $multiply: [
            {
              $divide: [{ $subtract: ["$price", "$discountPrice"] }, "$price"],
            },
            100,
          ],
        },
        0,
      ],
    },
  };
}

function buildSortStages(sortBy = "TRENDING") {
  switch (sortBy) {
    case "BEST_SELLING":
      return [{ $sort: { "analytics.salesCount": -1, createdAt: -1 } }];
    case "HIGHEST_DISCOUNT":
      return [{ $sort: { computedDiscountPercentage: -1, createdAt: -1 } }];
    case "NEWEST":
      return [{ $sort: { createdAt: -1 } }];
    case "OLDEST":
      return [{ $sort: { createdAt: 1 } }];
    case "PRICE_LOW_TO_HIGH":
      return [{ $sort: { effectivePrice: 1, createdAt: -1 } }];
    case "PRICE_HIGH_TO_LOW":
      return [{ $sort: { effectivePrice: -1, createdAt: -1 } }];
    case "MOST_VIEWED":
    case "MOST_POPULAR":
      return [{ $sort: { "analytics.views": -1, createdAt: -1 } }];
    case "TOP_RATED":
      return [{ $sort: { "ratings.averageRating": -1, "ratings.totalReviews": -1, createdAt: -1 } }];
    case "FEATURED":
      return [{ $sort: { featuredRank: 1, "analytics.salesCount": -1, createdAt: -1 } }];
    case "RANDOM":
      return [{ $sample: { size: 100 } }];
    case "CUSTOM_ORDER":
      return [];
    case "TRENDING":
    default:
      return [{ $sort: { "analytics.views": -1, "analytics.salesCount": -1, createdAt: -1 } }];
  }
}

function resolveFeaturedSortBy(container = {}) {
  const mode = String(container?.config?.productSourceMode || "").toUpperCase();
  if (mode === "BEST_SELLERS") return "BEST_SELLING";
  if (mode === "TRENDING_PRODUCTS") return "TRENDING";
  if (mode === "NEWEST_PRODUCTS") return "NEWEST";
  if (mode === "HIGHEST_RATED_PRODUCTS") return "TOP_RATED";
  return container?.filters?.sortBy || "TRENDING";
}

function resolveVendorSortBy(container = {}) {
  const source = String(container.dataSourceType || "DEFAULT").toUpperCase();
  const configured = String(container.config?.orderBy || container.config?.sortBy || container.filters?.sortBy || "").toUpperCase();
  const aliases = {
    POPULARITY: "MOST_POPULAR",
    SALES: "BEST_SELLING",
    RATING: "TOP_RATED",
    NEWEST: "NEWEST",
  };

  if (source === "CURRENT_VENDOR_FEATURED") return "FEATURED";
  if (source === "CURRENT_VENDOR_NEW_ARRIVALS") return "NEWEST";
  if (source === "CURRENT_VENDOR_BEST_SELLERS") return "BEST_SELLING";
  if (source === "CURRENT_VENDOR_DEALS") return "HIGHEST_DISCOUNT";
  if (source === "CURRENT_VENDOR_TOP_RATED") return "TOP_RATED";
  if (source === "CURRENT_VENDOR_RECOMMENDED") return "TRENDING";
  return aliases[configured] || configured || (container.containerType === "GRID" ? "NEWEST" : "TRENDING");
}

async function hydrateProductsByIds(ids = []) {
  if (!ids.length) return [];
  const products = await Product.find({ _id: { $in: ids } })
    .populate("sellerId", "companyName shopName logoUrl storeSlug bannerUrl")
    .lean();
  const orderMap = new Map(ids.map((id, index) => [String(id), index]));
  return products.sort((a, b) => orderMap.get(String(a._id)) - orderMap.get(String(b._id)));
}

function extractConfigIds(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (item && typeof item === "object") {
        return item.value || item._id || item.id || "";
      }
      return item;
    })
    .filter(Boolean)
    .map(String);
}

function isVendorStorefrontContainer(type) {
  return VENDOR_STOREFRONT_TYPE_SET.has(normalizeContainerType(type));
}

function isInfluencerStorefrontContainer(type) {
  return INFLUENCER_STOREFRONT_TYPE_SET.has(normalizeContainerType(type));
}

function isStorefrontDiscoveryContainer(type) {
  return isVendorStorefrontContainer(type) || isInfluencerStorefrontContainer(type);
}

function normalizeStorefrontSelectionMode(config = {}) {
  return String(config.storefrontSelectionMode || "AUTO").trim().toUpperCase() === "MANUAL" ? "MANUAL" : "AUTO";
}

function clampStorefrontLimit(config = {}) {
  return Math.min(Math.max(Number(config.maxStorefrontCards || config.maxCards || 8), 1), 48);
}

function yearsActiveFrom(date) {
  if (!date) return 0;
  const created = new Date(date);
  if (Number.isNaN(created.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - created.getTime()) / (365 * 24 * 60 * 60 * 1000)));
}

function normalizeCategoryCards(cards = []) {
  const parsedCards = typeof cards === "string" ? parseJsonArray(cards) : cards;
  return (Array.isArray(parsedCards) ? parsedCards : [])
    .map((card, index) => ({
      _id: String(card?._id || card?.id || `custom-category-${index}`),
      name: String(card?.name || card?.title || card?.label || "").trim(),
      slug: String(card?.slug || "").trim(),
      code: String(card?.code || "").trim(),
      icon: String(card?.icon || "").trim(),
      logo: String(card?.logo || card?.image || "").trim(),
      color: String(card?.color || "").trim(),
      productCount: Number(card?.productCount || 0),
      description: String(card?.description || "").trim(),
      linkUrl: String(card?.linkUrl || card?.url || "").trim(),
    }))
    .filter((card) => card.name);
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function resolveCategoryShowcaseItems(container = {}) {
  if (container.containerType !== "CATEGORY_SHOWCASE") return [];

  const customCards = normalizeCategoryCards(container.config?.categoryCards);
  if (customCards.length) return customCards;

  const selectedIds = extractConfigIds(container.config?.categories);
  const limit = Math.min(Math.max(Number(container.config?.categoryColumns || 4) * 2, 4), 24);
  const query = selectedIds.length ? { _id: { $in: selectedIds }, isActive: true } : { isActive: true };
  const categories = await Category.find(query).sort({ order: 1, name: 1, createdAt: 1 }).lean();
  const orderedCategories = selectedIds.length
    ? categories.sort((left, right) => selectedIds.indexOf(String(left._id)) - selectedIds.indexOf(String(right._id)))
    : categories.slice(0, limit);
  const categoryIds = orderedCategories.map((item) => item._id);
  const productCounts = categoryIds.length
    ? await Product.aggregate([
        { $match: { categoryId: { $in: categoryIds }, status: "APPROVED", isActive: true } },
        { $group: { _id: "$categoryId", count: { $sum: 1 } } },
      ])
    : [];
  const countMap = new Map(productCounts.map((item) => [String(item._id), Number(item.count || 0)]));

  return orderedCategories.map((category) => ({
    _id: category._id,
    name: category.name,
    slug: category.slug,
    code: category.code,
    icon: category.icon,
    logo: category.logo,
    color: category.color,
    productCount: countMap.get(String(category._id)) || 0,
  }));
}

async function withCategoryShowcaseData(container = {}) {
  if (container.containerType !== "CATEGORY_SHOWCASE") return container;
  const categoryItems = await resolveCategoryShowcaseItems(container);
  return {
    ...container,
    config: {
      ...(container.config || {}),
      categoryItems,
    },
  };
}

async function buildVendorStorefrontCards(container = {}) {
  const config = container.config || {};
  const limit = clampStorefrontLimit(config);
  const selectionMode = normalizeStorefrontSelectionMode(config);
  const manualIds = extractConfigIds(config.manualVendorIds).filter((id) => mongoose.isValidObjectId(id));
  const query = { status: "approved", isStoreVisible: { $ne: false }, storeSlug: { $nin: ["", null] } };
  let sort = { isStoreFeatured: -1, lastActiveAt: -1, createdAt: -1 };

  if (selectionMode === "MANUAL" && manualIds.length) {
    query._id = { $in: manualIds.map((id) => new mongoose.Types.ObjectId(id)) };
  } else {
    const rule = String(config.vendorAutoRule || "").toUpperCase();
    if (container.containerType === "VENDOR_FEATURED_STORES" || rule === "VERIFIED") query.isStoreFeatured = true;
    if (container.containerType === "VENDOR_NEW_STORES" || rule === "NEWEST") sort = { createdAt: -1 };
    if (rule === "RECENTLY_ACTIVE") sort = { lastActiveAt: -1, createdAt: -1 };
    if (rule === "RANDOM") sort = null;
  }

  const vendors = sort
    ? await Vendor.find(query).sort(sort).limit(limit).lean()
    : await Vendor.aggregate([{ $match: query }, { $sample: { size: limit } }]);
  const orderedVendors =
    selectionMode === "MANUAL" && manualIds.length
      ? vendors.sort((left, right) => manualIds.indexOf(String(left._id)) - manualIds.indexOf(String(right._id)))
      : vendors;
  const vendorIds = orderedVendors.map((vendor) => vendor._id);
  const productCounts = vendorIds.length
    ? await Product.aggregate([
        { $match: { sellerId: { $in: vendorIds }, status: "APPROVED", isActive: true } },
        { $group: { _id: "$sellerId", count: { $sum: 1 }, sales: { $sum: { $ifNull: ["$analytics.salesCount", 0] } }, revenue: { $sum: { $ifNull: ["$analytics.revenue", 0] } } } },
      ])
    : [];
  const countMap = new Map(productCounts.map((item) => [String(item._id), item]));

  return orderedVendors.map((vendor) => {
    const counts = countMap.get(String(vendor._id)) || {};
    return {
      _id: vendor._id,
      entityType: "vendor",
      slug: vendor.storeSlug,
      href: `/vendor/${vendor.storeSlug}`,
      name: vendor.shopName || vendor.companyName || "Vendor Store",
      description: vendor.storeDescription || "",
      category: (vendor.storeCategories || []).join(", "),
      logo: vendor.logoUrl || "",
      banner: vendor.bannerUrl || "",
      productsCount: Number(counts.count || 0),
      followersCount: Number(vendor.followersCount || vendor.followers || 0),
      rating: Number(vendor.rating || vendor.averageRating || 0),
      reviewsCount: Number(vendor.reviewsCount || vendor.reviewCount || 0),
      yearsActive: yearsActiveFrom(vendor.createdAt),
      verified: vendor.status === "approved",
      featured: vendor.isStoreFeatured === true,
      metrics: {
        sales: Number(counts.sales || 0),
        revenue: Number(counts.revenue || 0),
      },
    };
  });
}

async function buildInfluencerStorefrontCards(container = {}) {
  const config = container.config || {};
  const limit = clampStorefrontLimit(config);
  const selectionMode = normalizeStorefrontSelectionMode(config);
  const manualIds = extractConfigIds(config.manualInfluencerIds).filter((id) => mongoose.isValidObjectId(id));
  const profileQuery = { state: { $in: ["verified", "active"] } };
  let sort = { verified: -1, followers: -1, createdAt: -1 };

  if (selectionMode === "MANUAL" && manualIds.length) {
    profileQuery._id = { $in: manualIds.map((id) => new mongoose.Types.ObjectId(id)) };
  } else {
    const rule = String(config.influencerAutoRule || "").toUpperCase();
    if (container.containerType === "INFLUENCER_VERIFIED_CREATORS" || rule === "VERIFIED") profileQuery.verified = true;
    if (container.containerType === "INFLUENCER_NEW_CREATORS" || rule === "NEWEST") sort = { createdAt: -1 };
    if (container.containerType === "INFLUENCER_TRENDING_CREATORS" || rule === "TRENDING" || rule === "MOST_VIEWED") sort = { "stats.views": -1, followers: -1, createdAt: -1 };
    if (rule === "MOST_REVENUE_GENERATED") sort = { "stats.revenue": -1, followers: -1, createdAt: -1 };
    if (rule === "TOP_CONVERTING") sort = { "stats.sales": -1, "stats.clicks": -1, createdAt: -1 };
    if (rule === "RANDOM") sort = null;
  }

  const profiles = sort
    ? await InfluencerProfile.find(profileQuery).sort(sort).limit(limit).lean()
    : await InfluencerProfile.aggregate([{ $match: profileQuery }, { $sample: { size: limit } }]);
  const orderedProfiles =
    selectionMode === "MANUAL" && manualIds.length
      ? profiles.sort((left, right) => manualIds.indexOf(String(left._id)) - manualIds.indexOf(String(right._id)))
      : profiles;
  const profileIds = orderedProfiles.map((profile) => profile._id);
  const [storefronts, collectionCounts] = await Promise.all([
    profileIds.length ? InfluencerStorefront.find({ influencerId: { $in: profileIds }, status: { $in: ["active", "published"] } }).lean() : [],
    profileIds.length
      ? InfluencerCollection.aggregate([
          { $match: { influencerId: { $in: profileIds }, status: "active" } },
          { $group: { _id: "$influencerId", count: { $sum: 1 }, productIds: { $push: "$productIds" } } },
        ])
      : [],
  ]);
  const storefrontMap = new Map(storefronts.map((item) => [String(item.influencerId), item]));
  const collectionMap = new Map(collectionCounts.map((item) => [String(item._id), item]));

  return orderedProfiles
    .map((profile) => {
      const storefront = storefrontMap.get(String(profile._id));
      const slug = storefront?.slug || profile.storeSlug;
      if (!slug) return null;
      const collectionStats = collectionMap.get(String(profile._id)) || {};
      const productsCount = (collectionStats.productIds || []).flat().filter(Boolean).length || Number(storefront?.featuredProductIds?.length || 0);
      const clicks = Number(profile.stats?.clicks || 0);
      const sales = Number(profile.stats?.sales || 0);
      return {
        _id: profile._id,
        entityType: "influencer",
        slug,
        href: `/influencer/${slug}`,
        name: storefront?.name || profile.displayName || profile.storeName || "Creator Storefront",
        username: profile.socialHandles?.instagram || profile.influencerCode || slug,
        description: storefront?.description || profile.shortBio || profile.bio || "",
        category: profile.primaryCategory || (profile.categories || []).join(", "),
        logo: storefront?.profileImage || storefront?.logo || profile.profilePicture || "",
        banner: storefront?.banner || profile.coverBanner || "",
        followersCount: Number(profile.followers || 0),
        collectionsCount: Number(collectionStats.count || 0),
        productsCount,
        rating: clicks > 0 ? Number(((sales / clicks) * 100).toFixed(2)) : Number(profile.rating || 0),
        reviewsCount: Number(profile.rating ? Math.round(profile.rating * 10) : 0),
        verified: profile.verified === true,
        featured: container.containerType === "INFLUENCER_FEATURED_CREATORS",
        topCreator: Number(profile.followers || 0) >= 10000 || Number(profile.stats?.revenue || 0) > 0,
        metrics: {
          views: Number(profile.stats?.views || 0),
          clicks,
          sales,
          revenue: Number(profile.stats?.revenue || 0),
        },
      };
    })
    .filter(Boolean);
}

async function resolveStorefrontCards(container = {}) {
  if (isVendorStorefrontContainer(container.containerType)) {
    return buildVendorStorefrontCards(container);
  }
  if (isInfluencerStorefrontContainer(container.containerType)) {
    return buildInfluencerStorefrontCards(container);
  }
  return [];
}

async function getApprovedVendorIds() {
  const vendors = await Vendor.find({ status: "approved" }).select("_id").lean();
  return vendors.map((vendor) => new mongoose.Types.ObjectId(vendor._id));
}

function applyTypeSpecificProductConstraints(container = {}) {
  const filters = container.filters || {};
  const config = container.config || {};
  const constraint = {};

  if (container.containerType === "NEW_ARRIVALS") {
    const daysRange = Number(config.daysRange || 30);
    constraint.createdAt = { $gte: new Date(Date.now() - daysRange * 24 * 60 * 60 * 1000) };
  }

  if (container.containerType === "TOP_RATED") {
    constraint["ratings.averageRating"] = { $gte: Number(config.minimumRating ?? filters.minimumRating ?? 4) };
    constraint["ratings.totalReviews"] = { $gte: Number(config.minimumReviews || 0) };
  }

  if (container.containerType === "TRENDING") {
    constraint["analytics.views"] = { $gte: Number(config.viewThreshold || 0) };
    constraint["analytics.salesCount"] = { $gte: Number(config.salesThreshold || 0) };
  }

  return constraint;
}

function applyVendorDataSourceConstraints(container = {}) {
  const source = String(container.dataSourceType || "DEFAULT").toUpperCase();
  if (source === "CURRENT_VENDOR_FEATURED") {
    return { $or: [{ isFeatured: true }, { featured: true }] };
  }
  if (source === "CURRENT_VENDOR_DEALS") {
    return { discountPrice: { $gt: 0 } };
  }
  if (source === "CURRENT_VENDOR_TOP_RATED") {
    return {
      "ratings.averageRating": { $gte: Number(container.config?.minimumRating || 4) },
      "ratings.totalReviews": { $gte: Number(container.config?.minimumReviews || 0) },
    };
  }
  return {};
}

function shouldUseVendorProducts(container = {}, options = {}) {
  return Boolean(options.currentVendorId && mongoose.isValidObjectId(options.currentVendorId));
}

function inferVendorDataSourceType(container = {}) {
  const configured = normalizeDataSourceType(container.dataSourceType || "DEFAULT");
  if (configured !== "DEFAULT") return configured;
  switch (container.containerType) {
    case "FEATURED_PRODUCTS":
      return "CURRENT_VENDOR_FEATURED";
    case "NEW_ARRIVALS":
      return "CURRENT_VENDOR_NEW_ARRIVALS";
    case "TOP_RATED":
      return "CURRENT_VENDOR_TOP_RATED";
    case "TRENDING":
    case "CAROUSEL":
      return "CURRENT_VENDOR_PRODUCTS";
    case "DEALS_STRIP":
    case "FLASH_SALE":
    case "COMBO_DEALS":
      return "CURRENT_VENDOR_DEALS";
    case "RECOMMENDED":
      return "CURRENT_VENDOR_RECOMMENDED";
    case "GRID":
    default:
      return "CURRENT_VENDOR_PRODUCTS";
  }
}

function withVendorProductContext(container = {}, options = {}) {
  if (!shouldUseVendorProducts(container, options)) return container;
  const source = inferVendorDataSourceType(container);
  return {
    ...container,
    __currentVendorId: String(options.currentVendorId),
    dataSourceType: source,
    filters: {
      ...(container.filters || {}),
      productSelectionMode: "AUTO",
      manualProductIds: [],
      vendorIds: [],
      maxProductsToShow: Number(container.filters?.maxProductsToShow || DEFAULT_VENDOR_LAYOUT_LIMIT),
    },
  };
}

async function resolveContainerProducts(container, options = {}) {
  container = withVendorProductContext(container, options);
  if (isStorefrontDiscoveryContainer(container.containerType)) {
    const storefrontCards = await resolveStorefrontCards(container);
    return {
      products: [],
      storefrontCards,
      storefrontPagination: {
        total: storefrontCards.length,
        page: 1,
        limit: storefrontCards.length,
        pages: 1,
      },
      pagination: {
        total: 0,
        page: 1,
        limit: 0,
        pages: 0,
      },
    };
  }
  const schema = getContainerTypeSchema(container.containerType);
  if (!schema.supportsProducts) {
    return {
      products: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 0,
        pages: 0,
      },
    };
  }

  const filters = container.filters || {};
  const config = container.config || {};
  const page = Math.max(Number(options.page || 1), 1);
  const limitFallback = container.__currentVendorId ? DEFAULT_VENDOR_LAYOUT_LIMIT : DEFAULT_PREVIEW_LIMIT;
  const limit = Math.min(Math.max(Number(options.limit || filters.maxProductsToShow || limitFallback), 1), 100);
  const skip = (page - 1) * limit;
  const approvedVendorIds = options.approvedVendorIds || (await getApprovedVendorIds());
  const featuredIds =
    container.containerType === "FEATURED_PRODUCTS"
      ? [
          ...(Array.isArray(config.heroProduct) ? config.heroProduct : config.heroProduct ? [config.heroProduct] : []),
          ...(Array.isArray(config.secondaryProducts) ? config.secondaryProducts : []),
        ].filter(Boolean)
      : [];

  if (!container.__currentVendorId && container.containerType === "FEATURED_PRODUCTS" && featuredIds.length && String(config.productSourceMode || "MANUAL").toUpperCase() === "MANUAL") {
    const uniqueIds = [...new Set(featuredIds.map(String))].slice(0, limit);
    const products = await hydrateProductsByIds(uniqueIds);
    return {
      products,
      pagination: {
        total: products.length,
        page: 1,
        limit,
        pages: 1,
      },
    };
  }

  if (!container.__currentVendorId && container.containerType === "COMBO_DEALS") {
    const comboIds = extractConfigIds(config.bundleProducts);
    if (comboIds.length) {
      const uniqueIds = [...new Set(comboIds)].slice(0, Math.min(Number(config.comboMaxProducts || limit), limit));
      const products = await hydrateProductsByIds(uniqueIds);
      return {
        products,
        pagination: {
          total: products.length,
          page: 1,
          limit,
          pages: 1,
        },
      };
    }
  }

  const pipeline = [
    { $match: buildProductBaseMatch(container, approvedVendorIds) },
    { $match: applyTypeSpecificProductConstraints(container) },
    ...(container.__currentVendorId ? [{ $match: applyVendorDataSourceConstraints(container) }] : []),
    { $addFields: buildComputedFields() },
  ];

  const expressionMatch = {};
  if (filters.showOnlyInStock !== false) {
    expressionMatch.availableStock = { $gt: 0 };
  }
  if (filters.minDiscountPercentage) {
    expressionMatch.computedDiscountPercentage = {
      ...(expressionMatch.computedDiscountPercentage || {}),
      $gte: Number(filters.minDiscountPercentage || 0),
    };
  }
  if (filters.minPrice !== null && filters.minPrice !== undefined) {
    expressionMatch.effectivePrice = {
      ...(expressionMatch.effectivePrice || {}),
      $gte: Number(filters.minPrice),
    };
  }
  if (filters.maxPrice !== null && filters.maxPrice !== undefined) {
    expressionMatch.effectivePrice = {
      ...(expressionMatch.effectivePrice || {}),
      $lte: Number(filters.maxPrice),
    };
  }
  if (filters.minimumRating) {
    expressionMatch["ratings.averageRating"] = { $gte: Number(filters.minimumRating) };
  }
  if (Object.keys(expressionMatch).length) {
    pipeline.push({ $match: expressionMatch });
  }

  const sortBy = container.__currentVendorId
    ? resolveVendorSortBy(container)
    : container.containerType === "FEATURED_PRODUCTS"
      ? resolveFeaturedSortBy(container)
      : filters.sortBy;
  pipeline.push(...buildSortStages(sortBy));

  const countPipeline = pipeline.filter((stage) => !stage.$sample && !stage.$sort).concat({ $count: "total" });

  pipeline.push({ $skip: skip }, { $limit: limit }, { $project: { _id: 1 } });

  const [rows, totalRows] = await Promise.all([Product.aggregate(pipeline), Product.aggregate(countPipeline)]);
  const ids = rows.map((item) => item._id);
  const products = await hydrateProductsByIds(ids);
  const total = Number(totalRows?.[0]?.total || 0);

  return {
    products,
    pagination: {
      total,
      page,
      limit,
      pages: Math.max(Math.ceil(total / limit), 1),
    },
  };
}

function mapContainerDocument(container, productsPayload = null) {
  const filters = container.filters || {};
  const metrics = container.metrics || {};

  const normalizedType = normalizeContainerType(container.containerType);
  const mapped = {
    _id: container._id,
    title: container.title,
    slug: container.slug,
    description: container.description || "",
    containerType: normalizedType,
    dataSourceType: container.dataSourceType || "DEFAULT",
    priority: container.priority ?? 0,
    status: container.status,
    visibility: {
      desktop: container.visibility?.desktop !== false,
      tablet: container.visibility?.tablet !== false,
      mobile: container.visibility?.mobile !== false,
    },
    presentation: container.presentation || {},
    schedule: container.schedule || { enabled: false, start: null, end: null },
    filters: {
      vendorIds: filters.vendorIds || [],
      categoryIds: filters.categoryIds || [],
      subCategoryIds: filters.subCategoryIds || [],
      brandIds: filters.brandIds || [],
      tags: filters.tags || [],
      minPrice: filters.minPrice ?? null,
      maxPrice: filters.maxPrice ?? null,
      minDiscountPercentage: filters.minDiscountPercentage ?? 0,
      minimumRating: filters.minimumRating ?? 0,
      showOnlyInStock: filters.showOnlyInStock !== false,
      sortBy: filters.sortBy || "TRENDING",
      maxProductsToShow: filters.maxProductsToShow ?? DEFAULT_PREVIEW_LIMIT,
      productSelectionMode: filters.productSelectionMode || "AUTO",
      manualProductIds: filters.manualProductIds || [],
    },
    config: container.config || {},
    analyticsEnabled: container.analyticsEnabled !== false,
    analytics: {
      impressions: Number(metrics.impressions || 0),
      clicks: Number(metrics.clicks || 0),
      productClicks: Number(metrics.productClicks || 0),
      conversions: Number(metrics.conversions || 0),
      revenue: Number(metrics.revenue || 0),
      ctr:
        Number(metrics.impressions || 0) > 0
          ? Number((((metrics.clicks || 0) / metrics.impressions) * 100).toFixed(2))
          : 0,
      conversionRate:
        Number(metrics.clicks || 0) > 0
          ? Number((((metrics.conversions || 0) / metrics.clicks) * 100).toFixed(2))
          : 0,
    },
    createdAt: container.createdAt,
    updatedAt: container.updatedAt,
  };

  if (productsPayload) {
    mapped.products = productsPayload.products;
    mapped.productPagination = productsPayload.pagination;
    if (Array.isArray(productsPayload.storefrontCards)) {
      mapped.storefrontCards = productsPayload.storefrontCards;
      mapped.storefrontPagination = productsPayload.storefrontPagination || {
        total: productsPayload.storefrontCards.length,
        page: 1,
        limit: productsPayload.storefrontCards.length,
        pages: 1,
      };
    }
  }

  return mapped;
}

async function buildAdminAnalyticsSummary(query = {}) {
  const containers = await HomepageContainer.find(query)
    .select("title containerType status metrics priority")
    .sort({ "metrics.clicks": -1, "metrics.impressions": -1, priority: 1 })
    .lean();

  const items = containers.map((container) => mapContainerDocument(container));
  const topByCtr = [...items].sort((a, b) => b.analytics.ctr - a.analytics.ctr).slice(0, 5);
  const topByConversion = [...items].sort((a, b) => b.analytics.conversionRate - a.analytics.conversionRate).slice(0, 5);
  const topByRevenue = [...items].sort((a, b) => b.analytics.revenue - a.analytics.revenue).slice(0, 5);

  return {
    totalContainers: items.length,
    activeContainers: items.filter((item) => item.status === "ACTIVE").length,
    topByCtr,
    topByConversion,
    topByRevenue,
  };
}

class HomepageContainerService {
  getContainerSchemas() {
    return listContainerTypeSchemas();
  }

  getContainerSchema(type) {
    return getContainerTypeSchema(type);
  }

  async listAdminContainers({ page = 1, limit = 20, search = "", status = "", containerType = "" } = {}) {
    const query = {};
    if (status) query.status = String(status).trim().toUpperCase();
    if (containerType) query.containerType = String(containerType).trim().toUpperCase();
    if (search) {
      query.$or = [
        { title: { $regex: escapeRegex(search), $options: "i" } },
        { description: { $regex: escapeRegex(search), $options: "i" } },
        { slug: { $regex: escapeRegex(search), $options: "i" } },
      ];
    }

    const safePage = Math.max(Number(page || 1), 1);
    const safeLimit = Math.min(Math.max(Number(limit || 20), 1), 100);
    const skip = (safePage - 1) * safeLimit;

    const [containers, total, analyticsSummary] = await Promise.all([
      HomepageContainer.find(query)
        .sort({ priority: 1, createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate("filters.vendorIds", "companyName shopName logoUrl")
        .populate("filters.categoryIds", "name slug")
        .populate("filters.subCategoryIds", "name categoryId")
        .populate("filters.manualProductIds", "name slug price discountPrice")
        .lean(),
      HomepageContainer.countDocuments(query),
      buildAdminAnalyticsSummary(query),
    ]);

    return {
      containers: containers.map((item) => mapContainerDocument(item)),
      analyticsSummary,
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        pages: Math.max(Math.ceil(total / safeLimit), 1),
      },
    };
  }

  async getContainerById(id) {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid homepage container id", 400, "INVALID_ID");
    }
    const container = await HomepageContainer.findById(id)
      .populate("filters.vendorIds", "companyName shopName logoUrl bannerUrl storeSlug")
      .populate("filters.categoryIds", "name slug")
      .populate("filters.subCategoryIds", "name categoryId")
      .populate("filters.manualProductIds", "name slug price discountPrice")
      .lean();
    if (!container) {
      throw new AppError("Homepage container not found", 404, "NOT_FOUND");
    }
    return mapContainerDocument(container);
  }

  async createContainer(payload = {}, actorId) {
    const normalized = normalizePayload(payload, actorId);
    await validateReferences(normalized);
    const created = await HomepageContainer.create(normalized);
    invalidateCache();
    return this.getContainerById(created._id);
  }

  async updateContainer(id, payload = {}, actorId) {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid homepage container id", 400, "INVALID_ID");
    }
    const existing = await HomepageContainer.findById(id).lean();
    if (!existing) {
      throw new AppError("Homepage container not found", 404, "NOT_FOUND");
    }

    const normalized = normalizePayload(payload, actorId, { partial: true });
    const merged = {
      ...existing,
      ...normalized,
      visibility: { ...(existing.visibility || {}), ...(normalized.visibility || {}) },
      presentation: {
        ...(existing.presentation || {}),
        ...(normalized.presentation || {}),
        layout: {
          ...(existing.presentation?.layout || {}),
          ...(normalized.presentation?.layout || {}),
        },
      },
      schedule: { ...(existing.schedule || {}), ...(normalized.schedule || {}) },
      filters: { ...(existing.filters || {}), ...(normalized.filters || {}) },
      config: { ...(existing.config || {}), ...(normalized.config || {}) },
    };

    await validateReferences(merged, id);

    await HomepageContainer.findByIdAndUpdate(
      id,
      {
        $set: {
          ...normalized,
          visibility: merged.visibility,
          presentation: merged.presentation,
          schedule: merged.schedule,
          filters: merged.filters,
          config: merged.config,
        },
      },
      { runValidators: true }
    );

    invalidateCache();
    return this.getContainerById(id);
  }

  async deleteContainer(id) {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid homepage container id", 400, "INVALID_ID");
    }
    const deleted = await HomepageContainer.findByIdAndDelete(id).lean();
    if (!deleted) {
      throw new AppError("Homepage container not found", 404, "NOT_FOUND");
    }
    invalidateCache();
    return { _id: deleted._id };
  }

  async reorderContainers(items = [], actorId = null) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new AppError("At least one container reorder item is required", 400, "VALIDATION_ERROR");
    }
    const bulkOps = items
      .filter((item) => mongoose.isValidObjectId(item.id))
      .map((item) => ({
        updateOne: {
          filter: { _id: item.id },
          update: {
            $set: {
              priority: Number(item.priority || 0),
              ...(actorId ? { updatedBy: actorId } : {}),
            },
          },
        },
      }));

    if (!bulkOps.length) {
      throw new AppError("No valid homepage containers were provided for reordering", 400, "VALIDATION_ERROR");
    }

    await HomepageContainer.bulkWrite(bulkOps);
    invalidateCache();
    return { updated: bulkOps.length };
  }

  async previewContainer(payload = {}) {
    const normalized = normalizePayload(payload, null, { partial: true });
    await validateReferences(normalized);
    const displayContainer = await withCategoryShowcaseData(normalized);
    const productsPayload = await resolveContainerProducts(
      {
        ...displayContainer,
        status: displayContainer.status || "ACTIVE",
      },
      { page: 1, limit: normalized.filters?.maxProductsToShow || DEFAULT_PREVIEW_LIMIT }
    );

    return {
      container: mapContainerDocument({
        ...displayContainer,
        _id: "preview",
        createdAt: new Date(),
        updatedAt: new Date(),
        metrics: {},
      }, productsPayload),
      ...productsPayload,
    };
  }

  async uploadContainerMedia(files = []) {
    return await uploadMany(files, { folder: "homepage_containers" });
  }

  async listPublicContainers({ device = "all", includeProducts = true, page = 1, limit } = {}) {
    const cacheKey = `homepage:list:${device}:${includeProducts}:${page}:${limit || "auto"}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const containers = await HomepageContainer.find({ status: "ACTIVE" })
      .sort({ priority: 1, createdAt: -1 })
      .lean();

    const visible = containers.filter((container) => matchesSchedule(container, now) && matchesDevice(container, device));
    if (!includeProducts) {
      const result = visible.map((item) => mapContainerDocument(item));
      setCache(cacheKey, result);
      return result;
    }

    const approvedVendorIds = await getApprovedVendorIds();
    const resolved = await Promise.all(
      visible.map(async (container) => {
        const displayContainer = await withCategoryShowcaseData(container);
        const productsPayload = await resolveContainerProducts(container, {
          page,
          limit: limit || container.filters?.maxProductsToShow || DEFAULT_PREVIEW_LIMIT,
          approvedVendorIds,
        });
        return mapContainerDocument(displayContainer, productsPayload);
      })
    );

    const result = resolved.filter((item) => {
      const schema = getContainerTypeSchema(item.containerType);
      if (!schema.supportsProducts) return true;
      return Array.isArray(item.products) && item.products.length > 0;
    });

    setCache(cacheKey, result);
    return result;
  }

  async getContainerProductsBySlug(slug, { page = 1, limit = 24, device = "all" } = {}) {
    const container = await HomepageContainer.findOne({ slug: String(slug || "").trim().toLowerCase() }).lean();
    if (!container) {
      throw new AppError("Homepage container not found", 404, "NOT_FOUND");
    }
    if (!matchesSchedule(container) || !matchesDevice(container, device) || container.status !== "ACTIVE") {
      throw new AppError("Homepage container is not currently available", 404, "CONTAINER_INACTIVE");
    }

    const productsPayload = await resolveContainerProducts(container, { page, limit });
    return {
      container: mapContainerDocument(container),
      ...productsPayload,
    };
  }

  async trackContainerEvent(id, eventType, payload = {}) {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid homepage container id", 400, "INVALID_ID");
    }

    const update = {};
    switch (String(eventType || "").trim().toLowerCase()) {
      case "impression":
        update["metrics.impressions"] = 1;
        break;
      case "click":
      case "card_click":
      case "store_visit":
        update["metrics.clicks"] = 1;
        break;
      case "product_click":
        update["metrics.productClicks"] = 1;
        break;
      case "conversion":
        update["metrics.conversions"] = 1;
        update["metrics.revenue"] = Number(payload.revenue || 0);
        break;
      default:
        throw new AppError("Unsupported homepage analytics event", 400, "INVALID_EVENT");
    }

    const inc = {};
    for (const [key, value] of Object.entries(update)) {
      inc[key] = Number(value || 0);
    }

    const container = await HomepageContainer.findByIdAndUpdate(
      id,
      { $inc: inc },
      { returnDocument: "after", select: "_id metrics analyticsEnabled" }
    ).lean();

    if (!container) {
      throw new AppError("Homepage container not found", 404, "NOT_FOUND");
    }

    invalidateCache();
    return {
      _id: container._id,
      analytics: mapContainerDocument(container).analytics,
    };
  }

  async listActiveContainersForBuilder() {
    const containers = await HomepageContainer.find({ status: "ACTIVE" })
      .sort({ createdAt: -1, priority: 1 })
      .lean();

    return containers.map((item) => mapContainerDocument(item));
  }

  async getResolvedContainersByIds(
    ids = [],
    { device = "all", includeProducts = true, page = 1, limit, respectVisibility = true, currentVendorId = null } = {}
  ) {
    const objectIds = ids
      .map((item) => String(item || "").trim())
      .filter((item) => mongoose.isValidObjectId(item))
      .map((item) => new mongoose.Types.ObjectId(item));

    if (!objectIds.length) return [];

    const rows = await HomepageContainer.find({
      _id: { $in: objectIds },
      status: "ACTIVE",
    }).lean();

    const now = new Date();
    const orderMap = new Map(objectIds.map((id, index) => [String(id), index]));
    const filtered = rows
      .filter((container) => (respectVisibility ? matchesSchedule(container, now) && matchesDevice(container, device) : true))
      .sort((a, b) => orderMap.get(String(a._id)) - orderMap.get(String(b._id)));

    if (!includeProducts) {
      return filtered.map((item) => mapContainerDocument(item));
    }

    const approvedVendorIds = await getApprovedVendorIds();
    const resolved = await Promise.all(
      filtered.map(async (container) => {
        const productsPayload = await resolveContainerProducts(container, {
          page,
          limit: limit || container.filters?.maxProductsToShow || (currentVendorId ? DEFAULT_VENDOR_LAYOUT_LIMIT : DEFAULT_PREVIEW_LIMIT),
          approvedVendorIds,
          currentVendorId,
        });
        return mapContainerDocument(container, productsPayload);
      })
    );

    return resolved.filter((item) => {
      const schema = getContainerTypeSchema(item.containerType);
      if (!schema.supportsProducts) return true;
      return Array.isArray(item.products) && item.products.length > 0;
    });
  }
}

module.exports = new HomepageContainerService();
