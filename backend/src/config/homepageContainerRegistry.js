const CONTAINER_TYPES = [
  "CAROUSEL",
  "GRID",
  "FEATURED_PRODUCTS",
  "BANNER",
  "SLIDER",
  "FLASH_SALE",
  "DEALS_STRIP",
  "MASONRY",
  "CATEGORY_SHOWCASE",
  "BRAND_SHOWCASE",
  "RECENTLY_VIEWED",
  "RECOMMENDED",
  "TRENDING",
  "NEW_ARRIVALS",
  "TOP_RATED",
  "COMBO_DEALS",
  "VIDEO_PRODUCTS",
];

const CONTAINER_STATUS = ["DRAFT", "ACTIVE", "DISABLED"];
const PRODUCT_SELECTION_MODES = ["AUTO", "MANUAL"];
const SORT_OPTIONS = [
  "BEST_SELLING",
  "HIGHEST_DISCOUNT",
  "NEWEST",
  "TRENDING",
  "PRICE_LOW_TO_HIGH",
  "PRICE_HIGH_TO_LOW",
  "MOST_VIEWED",
  "TOP_RATED",
  "RANDOM",
  "OLDEST",
  "MOST_POPULAR",
  "CUSTOM_ORDER",
];

const PRODUCT_FIELD = {
  type: "async-multiselect",
  source: "products",
  searchable: true,
};

const FIELD_LIBRARY = {
  autoSlide: { type: "boolean", defaultValue: true },
  slideSpeed: { type: "number", min: 1000, max: 20000, defaultValue: 3500 },
  showArrows: { type: "boolean", defaultValue: true },
  showDots: { type: "boolean", defaultValue: true },
  infiniteLoop: { type: "boolean", defaultValue: true },
  productsPerView: { type: "number", min: 1, max: 8, defaultValue: 5 },
  swipeEnabled: { type: "boolean", defaultValue: true },
  desktopColumns: { type: "number", min: 1, max: 8, defaultValue: 4 },
  tabletColumns: { type: "number", min: 1, max: 6, defaultValue: 2 },
  mobileColumns: { type: "number", min: 1, max: 3, defaultValue: 1 },
  gapSize: { type: "number", min: 0, max: 48, defaultValue: 16 },
  cardStyle: { type: "select", options: ["DEFAULT", "ELEVATED", "MINIMAL", "EDITORIAL"], defaultValue: "ELEVATED" },
  headerStyle: { type: "select", options: ["DEFAULT", "CENTERED_FANCY"], defaultValue: "DEFAULT" },
  headerEyebrowText: { type: "text", defaultValue: "" },
  headerHeadingText: { type: "text", defaultValue: "" },
  headerCtaText: { type: "text", defaultValue: "View all" },
  headerCtaUrl: { type: "text", defaultValue: "" },
  featuredHeading: { type: "text", defaultValue: "" },
  featuredSubHeading: { type: "text", defaultValue: "" },
  featuredDescription: { type: "textarea", defaultValue: "" },
  badgeText: { type: "text", defaultValue: "" },
  ctaButtonText: { type: "text", defaultValue: "View all" },
  ctaUrl: { type: "text", defaultValue: "" },
  ctaTarget: { type: "select", options: ["SELF", "BLANK"], defaultValue: "SELF" },
  buttonStyle: { type: "select", options: ["PRIMARY", "SECONDARY", "OUTLINE", "GHOST"], defaultValue: "PRIMARY" },
  productSourceMode: {
    type: "select",
    options: ["MANUAL", "CATEGORY_BASED", "BRAND_BASED", "TRENDING_PRODUCTS", "NEWEST_PRODUCTS", "HIGHEST_RATED_PRODUCTS"],
    defaultValue: "MANUAL",
  },
  heroProduct: { ...PRODUCT_FIELD, maxItems: 1 },
  secondaryProducts: { ...PRODUCT_FIELD, maxItems: 50 },
  productsPerRowDesktop: { type: "select", options: ["2", "3", "4", "5", "6"], defaultValue: "4" },
  productsPerRowTablet: { type: "select", options: ["1", "2", "3", "4"], defaultValue: "2" },
  productsPerRowMobile: { type: "select", options: ["1", "2"], defaultValue: "1" },
  featuredLayoutStyle: {
    type: "select",
    options: ["LEFT_HERO", "RIGHT_HERO", "TOP_HERO", "BOTTOM_HERO", "HERO_PLUS_GRID", "HERO_PLUS_CAROUSEL", "MAGAZINE_LAYOUT", "CUSTOM_GRID"],
    defaultValue: "LEFT_HERO",
  },
  showProductImage: { type: "boolean", defaultValue: true },
  showProductName: { type: "boolean", defaultValue: true },
  showBrand: { type: "boolean", defaultValue: true },
  showPrice: { type: "boolean", defaultValue: true },
  showSalePrice: { type: "boolean", defaultValue: true },
  showRating: { type: "boolean", defaultValue: true },
  showReviewCount: { type: "boolean", defaultValue: true },
  showStockStatus: { type: "boolean", defaultValue: true },
  showWishlist: { type: "boolean", defaultValue: true },
  showQuickView: { type: "boolean", defaultValue: false },
  showCompare: { type: "boolean", defaultValue: false },
  showAddToCart: { type: "boolean", defaultValue: true },
  showDiscountBadge: { type: "boolean", defaultValue: true },
  showPopularBadge: { type: "boolean", defaultValue: false },
  showNewArrivalBadge: { type: "boolean", defaultValue: false },
  showLimitedStockBadge: { type: "boolean", defaultValue: true },
  showDeliveryBadge: { type: "boolean", defaultValue: false },
  bannerMedia: { type: "array", defaultValue: [] },
  overlayOpacity: { type: "number", min: 0, max: 1, step: 0.05, defaultValue: 0.35 },
  textPosition: { type: "select", options: ["LEFT", "CENTER", "RIGHT"], defaultValue: "LEFT" },
  slides: { type: "array", defaultValue: [] },
  autoplay: { type: "boolean", defaultValue: true },
  transitionEffect: { type: "select", options: ["SLIDE", "FADE", "SCALE"], defaultValue: "SLIDE" },
  indicators: { type: "boolean", defaultValue: true },
  startTime: { type: "datetime", defaultValue: "" },
  endTime: { type: "datetime", defaultValue: "" },
  countdownStyle: { type: "select", options: ["BLOCKS", "INLINE", "MINIMAL"], defaultValue: "BLOCKS" },
  flashBanner: { type: "text", defaultValue: "" },
  columnCount: { type: "number", min: 2, max: 6, defaultValue: 4 },
  cardHeights: { type: "select", options: ["AUTO", "MIXED", "TALL", "WIDE"], defaultValue: "MIXED" },
  masonryImage: { type: "image", defaultValue: "" },
  masonryImageHeight: { type: "number", min: 120, max: 700, defaultValue: 260 },
  categories: { type: "async-multiselect", source: "categories", searchable: true, defaultValue: [] },
  categoryCards: { type: "category-cards", defaultValue: [] },
  categoryBanner: { type: "image", defaultValue: "" },
  categoryLayout: { type: "select", options: ["CARDS", "STRIP", "EDITORIAL", "COMPACT_GRID"], defaultValue: "CARDS" },
  categoryColumns: { type: "number", min: 2, max: 6, defaultValue: 4 },
  brands: { type: "tags", defaultValue: [] },
  brandLogos: { type: "array", defaultValue: [] },
  brandBanner: { type: "text", defaultValue: "" },
  historyDuration: { type: "number", min: 1, max: 365, defaultValue: 30 },
  recommendationLogic: { type: "select", options: ["CATEGORY_AFFINITY", "POPULAR_PRODUCTS", "MANUAL"], defaultValue: "CATEGORY_AFFINITY" },
  manualOverride: { type: "boolean", defaultValue: false },
  viewThreshold: { type: "number", min: 1, max: 100000, defaultValue: 100 },
  salesThreshold: { type: "number", min: 1, max: 100000, defaultValue: 10 },
  trendingLogic: { type: "select", options: ["VIEWS", "SALES", "HYBRID"], defaultValue: "HYBRID" },
  daysRange: { type: "number", min: 1, max: 365, defaultValue: 30 },
  sortLatestFirst: { type: "boolean", defaultValue: true },
  minimumRating: { type: "number", min: 0, max: 5, step: 0.1, defaultValue: 4 },
  minimumReviews: { type: "number", min: 0, max: 100000, defaultValue: 10 },
  bundleProducts: { ...PRODUCT_FIELD, defaultValue: [] },
  comboDiscount: { type: "number", min: 0, max: 100, defaultValue: 10 },
  comboTitle: { type: "text", defaultValue: "" },
  comboSubtitle: { type: "text", defaultValue: "" },
  comboBadgeText: { type: "text", defaultValue: "Bundle deal" },
  comboCtaText: { type: "text", defaultValue: "View combo" },
  comboCtaUrl: { type: "text", defaultValue: "" },
  comboBanner: { type: "image", defaultValue: "" },
  comboLayout: { type: "select", options: ["HERO_BUNDLE", "PRODUCT_GRID", "COMPACT_STRIP"], defaultValue: "HERO_BUNDLE" },
  comboShowSavings: { type: "boolean", defaultValue: true },
  comboShowProducts: { type: "boolean", defaultValue: true },
  comboMaxProducts: { type: "number", min: 2, max: 8, defaultValue: 4 },
  videoUpload: { type: "text", defaultValue: "" },
  mute: { type: "boolean", defaultValue: true },
  videoPosition: { type: "select", options: ["TOP", "LEFT", "RIGHT", "BACKGROUND"], defaultValue: "TOP" },
};

function field(name, overrides = {}) {
  return {
    name,
    label: overrides.label || name.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase()),
    ...(FIELD_LIBRARY[name] || {}),
    ...overrides,
  };
}

const PRODUCT_TYPE_DEFAULTS = {
  supportsProducts: true,
  supportsManualSelection: true,
  supportsProductFilters: true,
};

const HEADER_FIELDS = [
  field("headerStyle", { label: "Header Style" }),
  field("headerEyebrowText", { label: "Fancy Small Text" }),
  field("headerHeadingText", { label: "Fancy Heading" }),
  field("headerCtaText", { label: "Button Text" }),
  field("headerCtaUrl", { label: "Button Link" }),
];

const REGISTRY = {
  CAROUSEL: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Carousel",
    fields: [...HEADER_FIELDS, field("autoSlide"), field("slideSpeed"), field("showArrows"), field("showDots"), field("infiniteLoop"), field("productsPerView"), field("swipeEnabled")],
  },
  GRID: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Grid",
    fields: [...HEADER_FIELDS, field("desktopColumns"), field("tabletColumns"), field("mobileColumns"), field("gapSize"), field("cardStyle")],
  },
  FEATURED_PRODUCTS: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Featured Products",
    defaultSortBy: "TRENDING",
    fields: [
      field("featuredHeading"),
      field("featuredSubHeading"),
      field("featuredDescription"),
      field("badgeText"),
      field("ctaButtonText"),
      field("ctaUrl"),
      field("ctaTarget"),
      field("buttonStyle"),
      field("productSourceMode"),
      field("heroProduct"),
      field("secondaryProducts"),
      field("productsPerRowDesktop"),
      field("productsPerRowTablet"),
      field("productsPerRowMobile"),
      field("featuredLayoutStyle"),
      field("showProductImage"),
      field("showProductName"),
      field("showBrand"),
      field("showPrice"),
      field("showSalePrice"),
      field("showRating"),
      field("showReviewCount"),
      field("showStockStatus"),
      field("showWishlist"),
      field("showQuickView"),
      field("showCompare"),
      field("showAddToCart"),
      field("showDiscountBadge"),
      field("showPopularBadge"),
      field("showNewArrivalBadge"),
      field("showLimitedStockBadge"),
      field("showDeliveryBadge"),
    ],
  },
  BANNER: {
    label: "Banner",
    supportsProducts: false,
    supportsManualSelection: false,
    supportsProductFilters: false,
    fields: [field("bannerMedia"), field("overlayOpacity"), field("textPosition"), field("autoSlide"), field("slideSpeed"), field("showArrows"), field("showDots")],
  },
  SLIDER: {
    label: "Slider",
    supportsProducts: false,
    supportsManualSelection: false,
    supportsProductFilters: false,
    fields: [field("slides"), field("autoplay"), field("transitionEffect"), field("indicators")],
  },
  FLASH_SALE: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Flash Sale",
    defaultSortBy: "HIGHEST_DISCOUNT",
    fields: [field("startTime"), field("endTime"), field("countdownStyle"), field("flashBanner")],
  },
  DEALS_STRIP: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Deals Strip",
    defaultSortBy: "HIGHEST_DISCOUNT",
    fields: [field("featuredHeading"), field("featuredDescription"), field("badgeText"), field("ctaButtonText"), field("ctaUrl")],
  },
  MASONRY: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Masonry",
    fields: [field("columnCount"), field("tabletColumns"), field("mobileColumns"), field("masonryImage"), field("masonryImageHeight"), field("cardHeights"), field("gapSize"), field("cardStyle")],
  },
  CATEGORY_SHOWCASE: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Category Showcase",
    fields: [field("categories"), field("categoryCards"), field("categoryBanner"), field("categoryLayout"), field("categoryColumns"), field("gapSize")],
  },
  BRAND_SHOWCASE: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Brand Showcase",
    fields: [field("brands"), field("brandLogos"), field("brandBanner")],
  },
  RECENTLY_VIEWED: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Recently Viewed",
    fields: [field("historyDuration"), field("secondaryProducts")],
  },
  RECOMMENDED: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Recommended",
    fields: [field("recommendationLogic"), field("manualOverride")],
  },
  TRENDING: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Trending",
    defaultSortBy: "TRENDING",
    fields: [...HEADER_FIELDS, field("viewThreshold"), field("salesThreshold"), field("trendingLogic")],
  },
  NEW_ARRIVALS: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "New Arrivals",
    defaultSortBy: "NEWEST",
    fields: [field("daysRange"), field("sortLatestFirst")],
  },
  TOP_RATED: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Top Rated",
    defaultSortBy: "TOP_RATED",
    fields: [field("minimumRating"), field("minimumReviews")],
  },
  COMBO_DEALS: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Combo Deals",
    fields: [field("comboTitle"), field("comboSubtitle"), field("comboBadgeText"), field("bundleProducts"), field("comboDiscount"), field("comboBanner"), field("comboLayout"), field("comboShowSavings"), field("comboShowProducts"), field("comboMaxProducts"), field("comboCtaText"), field("comboCtaUrl")],
  },
  VIDEO_PRODUCTS: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Video Products",
    fields: [field("videoUpload"), field("autoplay"), field("mute"), field("videoPosition")],
  },
};

const TYPE_ALIASES = {
  PRODUCT_CAROUSEL: "CAROUSEL",
};

function normalizeContainerType(type) {
  const normalized = String(type || "CAROUSEL").trim().toUpperCase();
  return TYPE_ALIASES[normalized] || normalized;
}

const COMMON_FIELDS = [
  { name: "title", label: "Container Name", type: "text", required: true },
  { name: "slug", label: "Slug", type: "text", required: true },
  { name: "description", label: "Description", type: "textarea" },
  { name: "containerType", label: "Container Type", type: "select", options: CONTAINER_TYPES, required: true },
  { name: "priority", label: "Priority", type: "number", defaultValue: 0 },
  { name: "status", label: "Status", type: "select", options: CONTAINER_STATUS, defaultValue: "DRAFT" },
  { name: "scheduleStart", label: "Schedule Start", type: "datetime" },
  { name: "scheduleEnd", label: "Schedule End", type: "datetime" },
  { name: "desktopVisible", label: "Desktop Visibility", type: "boolean", defaultValue: true },
  { name: "mobileVisible", label: "Mobile Visibility", type: "boolean", defaultValue: true },
  { name: "backgroundColor", label: "Background Color", type: "text", defaultValue: "" },
  { name: "textColor", label: "Text Color", type: "text", defaultValue: "" },
  { name: "padding", label: "Padding", type: "text", defaultValue: "24px" },
  { name: "margin", label: "Margin", type: "text", defaultValue: "0" },
  { name: "animation", label: "Animation", type: "select", options: ["NONE", "FADE_UP", "FADE_IN", "SLIDE_LEFT", "SLIDE_RIGHT"], defaultValue: "FADE_UP" },
  { name: "customCssClasses", label: "Custom CSS Classes", type: "text", defaultValue: "" },
  { name: "containerWidth", label: "Container Width", type: "text", defaultValue: "full" },
  { name: "containerHeight", label: "Container Height", type: "text", defaultValue: "auto" },
  { name: "containerTheme", label: "Container Theme", type: "select", options: ["DEFAULT", "LIGHT", "DARK", "BRAND"], defaultValue: "DEFAULT" },
];

const PRODUCT_FILTER_FIELDS = [
  { name: "categoryIds", label: "Categories", type: "async-multiselect", source: "categories", searchable: true },
  { name: "subCategoryIds", label: "Subcategories", type: "async-multiselect", source: "subcategories", searchable: true },
  { name: "brandIds", label: "Brands", type: "async-multiselect", source: "brands", searchable: true },
  { name: "tags", label: "Tags", type: "async-multiselect", source: "tags", searchable: true },
  { name: "minPrice", label: "Min Price", type: "number", min: 0 },
  { name: "maxPrice", label: "Max Price", type: "number", min: 0 },
  { name: "minDiscountPercentage", label: "Offer Percentage", type: "number", min: 0, max: 100, defaultValue: 0 },
  { name: "minimumRating", label: "Minimum Rating", type: "number", min: 0, max: 5, step: 0.1, defaultValue: 0 },
  { name: "showOnlyInStock", label: "Stock Filter", type: "boolean", defaultValue: true },
  { name: "sortBy", label: "Sort By", type: "select", options: SORT_OPTIONS, defaultValue: "TRENDING" },
  { name: "maxProductsToShow", label: "Maximum Products", type: "number", min: 1, max: 100, defaultValue: 12 },
  { name: "productSelectionMode", label: "Product Selection Mode", type: "select", options: PRODUCT_SELECTION_MODES, defaultValue: "AUTO" },
  { name: "manualProductIds", label: "Manual Products", type: "async-multiselect", source: "products", searchable: true },
];

function getContainerTypeConfig(type) {
  return REGISTRY[normalizeContainerType(type)] || REGISTRY.CAROUSEL;
}

function getContainerTypeSchema(type) {
  const normalizedType = normalizeContainerType(type);
  const typeConfig = getContainerTypeConfig(normalizedType);

  return {
    type: normalizedType,
    label: typeConfig.label,
    supportsProducts: Boolean(typeConfig.supportsProducts),
    supportsManualSelection: Boolean(typeConfig.supportsManualSelection),
    supportsProductFilters: Boolean(typeConfig.supportsProductFilters),
    defaultSortBy: typeConfig.defaultSortBy || "TRENDING",
    commonFields: COMMON_FIELDS,
    productFilterFields: typeConfig.supportsProductFilters ? PRODUCT_FILTER_FIELDS : [],
    typeFields: typeConfig.fields || [],
  };
}

function listContainerTypeSchemas() {
  return CONTAINER_TYPES.map((type) => getContainerTypeSchema(type));
}

module.exports = {
  CONTAINER_TYPES,
  CONTAINER_STATUS,
  PRODUCT_SELECTION_MODES,
  SORT_OPTIONS,
  COMMON_FIELDS,
  PRODUCT_FILTER_FIELDS,
  normalizeContainerType,
  getContainerTypeConfig,
  getContainerTypeSchema,
  listContainerTypeSchemas,
};
