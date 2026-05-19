const CONTAINER_TYPES = [
  "CAROUSEL",
  "GRID",
  "FEATURED",
  "BANNER",
  "SLIDER",
  "LIST",
  "TABS",
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
  "VENDOR_SPOTLIGHT",
  "COMBO_DEALS",
  "VIDEO_PRODUCTS",
];

const PRODUCT_SELECTION_MODES = ["AUTO", "MANUAL"];
const CONTAINER_STATUS = ["DRAFT", "ACTIVE", "DISABLED"];
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
];

const PRODUCT_FIELD = {
  kind: "async-multiselect",
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
  cardStyle: {
    type: "select",
    options: ["DEFAULT", "ELEVATED", "MINIMAL", "EDITORIAL"],
    defaultValue: "ELEVATED",
  },
  heroProduct: { ...PRODUCT_FIELD, maxItems: 1 },
  secondaryProducts: { ...PRODUCT_FIELD, maxItems: 6 },
  heroBanner: { type: "text", defaultValue: "" },
  layoutStyle: {
    type: "select",
    options: ["LEFT_HERO", "RIGHT_HERO", "STACKED"],
    defaultValue: "LEFT_HERO",
  },
  bannerImage: { type: "text", defaultValue: "" },
  bannerVideo: { type: "text", defaultValue: "" },
  heading: { type: "text", defaultValue: "" },
  subheading: { type: "textarea", defaultValue: "" },
  ctaButton: { type: "text", defaultValue: "" },
  ctaUrl: { type: "text", defaultValue: "" },
  overlayOpacity: { type: "number", min: 0, max: 1, step: 0.05, defaultValue: 0.35 },
  textPosition: {
    type: "select",
    options: ["LEFT", "CENTER", "RIGHT"],
    defaultValue: "LEFT",
  },
  slides: { type: "array", defaultValue: [] },
  autoplay: { type: "boolean", defaultValue: true },
  transitionEffect: {
    type: "select",
    options: ["SLIDE", "FADE", "SCALE"],
    defaultValue: "SLIDE",
  },
  indicators: { type: "boolean", defaultValue: true },
  listStyle: {
    type: "select",
    options: ["COMFORTABLE", "COMPACT", "RANKED"],
    defaultValue: "COMFORTABLE",
  },
  compactMode: { type: "boolean", defaultValue: false },
  thumbnailPosition: {
    type: "select",
    options: ["LEFT", "TOP"],
    defaultValue: "TOP",
  },
  tabCategories: {
    type: "async-multiselect",
    source: "categories",
    searchable: true,
    defaultValue: [],
  },
  defaultTab: { type: "text", defaultValue: "" },
  tabStyle: {
    type: "select",
    options: ["PILLS", "UNDERLINE", "SEGMENTED"],
    defaultValue: "PILLS",
  },
  startTime: { type: "datetime", defaultValue: "" },
  endTime: { type: "datetime", defaultValue: "" },
  countdownStyle: {
    type: "select",
    options: ["BLOCKS", "INLINE", "MINIMAL"],
    defaultValue: "BLOCKS",
  },
  flashBanner: { type: "text", defaultValue: "" },
  compactCards: { type: "boolean", defaultValue: true },
  miniLayout: { type: "boolean", defaultValue: true },
  scrollingDeals: { type: "boolean", defaultValue: true },
  columnCount: { type: "number", min: 2, max: 6, defaultValue: 4 },
  cardHeights: {
    type: "select",
    options: ["AUTO", "MIXED", "TALL"],
    defaultValue: "MIXED",
  },
  categories: {
    type: "async-multiselect",
    source: "categories",
    searchable: true,
    defaultValue: [],
  },
  categoryBanner: { type: "text", defaultValue: "" },
  categoryLayout: {
    type: "select",
    options: ["CARDS", "STRIP", "EDITORIAL"],
    defaultValue: "CARDS",
  },
  brands: {
    type: "tags",
    defaultValue: [],
  },
  brandLogos: {
    type: "array",
    defaultValue: [],
  },
  brandBanner: { type: "text", defaultValue: "" },
  historyDuration: { type: "number", min: 1, max: 365, defaultValue: 30 },
  recommendationLogic: {
    type: "select",
    options: ["CATEGORY_AFFINITY", "TOP_SELLERS", "MANUAL"],
    defaultValue: "CATEGORY_AFFINITY",
  },
  manualOverride: { type: "boolean", defaultValue: false },
  viewThreshold: { type: "number", min: 1, max: 100000, defaultValue: 100 },
  salesThreshold: { type: "number", min: 1, max: 100000, defaultValue: 10 },
  trendingLogic: {
    type: "select",
    options: ["VIEWS", "SALES", "HYBRID"],
    defaultValue: "HYBRID",
  },
  daysRange: { type: "number", min: 1, max: 365, defaultValue: 30 },
  sortLatestFirst: { type: "boolean", defaultValue: true },
  minimumReviews: { type: "number", min: 0, max: 100000, defaultValue: 10 },
  vendorBanner: { type: "text", defaultValue: "" },
  vendorTheme: {
    type: "select",
    options: ["LIGHT", "DARK", "BRAND"],
    defaultValue: "BRAND",
  },
  bundleProducts: { ...PRODUCT_FIELD, defaultValue: [] },
  comboDiscount: { type: "number", min: 0, max: 100, defaultValue: 10 },
  comboBanner: { type: "text", defaultValue: "" },
  videoUpload: { type: "text", defaultValue: "" },
  mute: { type: "boolean", defaultValue: true },
  videoPosition: {
    type: "select",
    options: ["TOP", "LEFT", "RIGHT", "BACKGROUND"],
    defaultValue: "TOP",
  },
};

function field(name, overrides = {}) {
  return {
    name,
    label: name
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (char) => char.toUpperCase()),
    ...FIELD_LIBRARY[name],
    ...overrides,
  };
}

const PRODUCT_TYPE_DEFAULTS = {
  supportsProducts: true,
  supportsManualSelection: true,
  supportsProductFilters: true,
  defaultSortBy: "TRENDING",
};

const REGISTRY = {
  CAROUSEL: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Carousel",
    fields: [field("autoSlide"), field("slideSpeed"), field("showArrows"), field("showDots"), field("infiniteLoop"), field("productsPerView"), field("swipeEnabled")],
  },
  GRID: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Grid",
    fields: [field("desktopColumns"), field("tabletColumns"), field("mobileColumns"), field("gapSize"), field("cardStyle")],
  },
  FEATURED: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Featured",
    fields: [field("heroProduct"), field("secondaryProducts"), field("heroBanner"), field("layoutStyle")],
  },
  BANNER: {
    label: "Banner",
    supportsProducts: false,
    supportsManualSelection: false,
    supportsProductFilters: false,
    fields: [field("bannerImage"), field("bannerVideo"), field("heading"), field("subheading"), field("ctaButton"), field("ctaUrl"), field("overlayOpacity"), field("textPosition")],
  },
  SLIDER: {
    label: "Slider",
    supportsProducts: false,
    supportsManualSelection: false,
    supportsProductFilters: false,
    fields: [field("slides"), field("autoplay"), field("transitionEffect"), field("indicators")],
  },
  LIST: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "List",
    fields: [field("listStyle"), field("compactMode"), field("thumbnailPosition")],
  },
  TABS: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Tabs",
    fields: [field("tabCategories"), field("defaultTab"), field("tabStyle")],
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
    fields: [field("compactCards"), field("miniLayout"), field("scrollingDeals")],
  },
  MASONRY: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Masonry",
    fields: [field("columnCount"), field("cardHeights"), field("gapSize")],
  },
  CATEGORY_SHOWCASE: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Category Showcase",
    fields: [field("categories"), field("categoryBanner"), field("categoryLayout")],
  },
  BRAND_SHOWCASE: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Brand Showcase",
    fields: [field("brands"), field("brandLogos"), field("brandBanner")],
  },
  RECENTLY_VIEWED: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Recently Viewed",
    fields: [field("historyDuration"), field("maxProducts", { type: "number", min: 1, max: 50, defaultValue: 12 })],
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
    fields: [field("viewThreshold"), field("salesThreshold"), field("trendingLogic")],
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
    fields: [field("minimumRating", { type: "number", min: 0, max: 5, step: 0.1, defaultValue: 4 }), field("minimumReviews")],
  },
  VENDOR_SPOTLIGHT: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Vendor Spotlight",
    fields: [field("vendorBanner"), field("vendorTheme")],
  },
  COMBO_DEALS: {
    ...PRODUCT_TYPE_DEFAULTS,
    label: "Combo Deals",
    fields: [field("bundleProducts"), field("comboDiscount"), field("comboBanner")],
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
  { name: "containerOffsetX", label: "Offset X", type: "text", defaultValue: "" },
  { name: "containerOffsetY", label: "Offset Y", type: "text", defaultValue: "" },
  { name: "containerHeight", label: "Container Height", type: "text", defaultValue: "auto" },
  { name: "containerTheme", label: "Container Theme", type: "select", options: ["DEFAULT", "LIGHT", "DARK", "BRAND"], defaultValue: "DEFAULT" },
];

const PRODUCT_FILTER_FIELDS = [
  { name: "vendorIds", label: "Vendors", type: "async-multiselect", source: "vendors", searchable: true },
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
