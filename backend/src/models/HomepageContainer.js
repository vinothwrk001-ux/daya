const mongoose = require("mongoose");
const { generateSlug } = require("../utils/slug");
const {
  CONTAINER_TYPES,
  CONTAINER_STATUS,
  PRODUCT_SELECTION_MODES,
  SORT_OPTIONS,
  normalizeContainerType,
  getContainerTypeSchema,
} = require("../config/homepageContainerRegistry");

const visibilitySchema = new mongoose.Schema(
  {
    desktop: { type: Boolean, default: true },
    mobile: { type: Boolean, default: true },
  },
  { _id: false }
);

const presentationSchema = new mongoose.Schema(
  {
    backgroundColor: { type: String, trim: true, default: "" },
    textColor: { type: String, trim: true, default: "" },
    padding: { type: String, trim: true, default: "24px" },
    margin: { type: String, trim: true, default: "0" },
    animation: { type: String, trim: true, default: "FADE_UP" },
    customCssClasses: { type: String, trim: true, default: "" },
    containerWidth: { type: String, trim: true, default: "full" },
    containerHeight: { type: String, trim: true, default: "auto" },
    containerTheme: { type: String, trim: true, default: "DEFAULT" },
  },
  { _id: false }
);

const scheduleSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    start: { type: Date, default: null },
    end: { type: Date, default: null },
  },
  { _id: false }
);

const filtersSchema = new mongoose.Schema(
  {
    vendorIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Vendor" }],
      default: [],
    },
    categoryIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
      default: [],
    },
    subCategoryIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subcategory" }],
      default: [],
    },
    brandIds: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    minPrice: { type: Number, min: 0, default: null },
    maxPrice: { type: Number, min: 0, default: null },
    minDiscountPercentage: { type: Number, min: 0, max: 100, default: 0 },
    minimumRating: { type: Number, min: 0, max: 5, default: 0 },
    showOnlyInStock: { type: Boolean, default: true },
    sortBy: {
      type: String,
      enum: SORT_OPTIONS,
      default: "TRENDING",
    },
    maxProductsToShow: { type: Number, min: 1, max: 100, default: 12 },
    productSelectionMode: {
      type: String,
      enum: PRODUCT_SELECTION_MODES,
      default: "AUTO",
    },
    manualProductIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
      default: [],
    },
  },
  { _id: false }
);

const homepageContainerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    containerType: {
      type: String,
      enum: CONTAINER_TYPES,
      default: "CAROUSEL",
      index: true,
    },
    status: {
      type: String,
      enum: CONTAINER_STATUS,
      default: "DRAFT",
      index: true,
    },
    priority: {
      type: Number,
      default: 0,
      index: true,
    },
    visibility: {
      type: visibilitySchema,
      default: () => ({}),
    },
    presentation: {
      type: presentationSchema,
      default: () => ({}),
    },
    schedule: {
      type: scheduleSchema,
      default: () => ({}),
    },
    filters: {
      type: filtersSchema,
      default: () => ({}),
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    content: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    analyticsEnabled: {
      type: Boolean,
      default: true,
    },
    metrics: {
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      productClicks: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 },
      revenue: { type: Number, default: 0 },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "homepage_containers",
  }
);

homepageContainerSchema.pre("validate", function normalizeContainer() {
  if (this.title && !this.slug) {
    this.slug = generateSlug(this.title);
  } else if (this.slug) {
    this.slug = generateSlug(this.slug);
  }

  this.containerType = normalizeContainerType(this.containerType);
  this.status = String(this.status || "DRAFT").trim().toUpperCase();

  const schema = getContainerTypeSchema(this.containerType);

  this.visibility = {
    desktop: this.visibility?.desktop !== false,
    mobile: this.visibility?.mobile !== false,
  };

  if (!this.schedule?.enabled) {
    this.schedule = {
      enabled: false,
      start: this.schedule?.start || null,
      end: this.schedule?.end || null,
    };
  }

  const currentFilters = this.filters?.toObject ? this.filters.toObject() : this.filters || {};
  currentFilters.brandIds = (currentFilters.brandIds || []).map((item) => String(item || "").trim()).filter(Boolean);
  currentFilters.tags = (currentFilters.tags || [])
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);

  if (currentFilters.productSelectionMode !== "MANUAL") {
    currentFilters.manualProductIds = [];
  }

  if (currentFilters.maxPrice !== null && currentFilters.minPrice !== null && currentFilters.maxPrice < currentFilters.minPrice) {
    currentFilters.maxPrice = currentFilters.minPrice;
  }

  this.filters = currentFilters;

  const currentConfig = this.config && typeof this.config === "object" ? { ...this.config } : {};
  for (const field of schema.typeFields || []) {
    if (currentConfig[field.name] === undefined && field.defaultValue !== undefined) {
      currentConfig[field.name] = field.defaultValue;
    }
  }
  this.config = currentConfig;
});

homepageContainerSchema.index({ status: 1, priority: 1, createdAt: -1 });
homepageContainerSchema.index({ "schedule.enabled": 1, "schedule.start": 1, "schedule.end": 1, status: 1 });
homepageContainerSchema.index({ "visibility.desktop": 1, "visibility.mobile": 1, status: 1, priority: 1 });
homepageContainerSchema.index({ containerType: 1, status: 1, priority: 1 });

module.exports = {
  HomepageContainer:
    mongoose.models.HomepageContainer ||
    mongoose.model("HomepageContainer", homepageContainerSchema),
  CONTAINER_TYPES,
  CONTAINER_STATUS,
  PRODUCT_SELECTION_MODES,
  SORT_OPTIONS,
};
