const mongoose = require("mongoose");
const { PRODUCT_STATUS, CREATOR_TYPE } = require("../../constants/product.constants");

const imageSchema = require("./image.schema");
const variantSchema = require("./variant.schema");
const ratingsSchema = require("./ratings.schema");
const analyticsSchema = require("./analytics.schema");

const productSchema = new mongoose.Schema(
  {
    // Basic Info
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    shortDescription: {
      type: String,
      maxlength: 500,
    },

    // Classification
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      index: true,
    },
    subCategory: {
      type: String,
      trim: true,
    },
    subCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
      index: true,
    },
    tags: [{ type: String, trim: true, lowercase: true }],

    // Pricing
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    discountPrice: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
      enum: ["USD", "EUR", "INR", "GBP"],
    },

    // Inventory
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    SKU: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    productNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
    },

    // Media
    images: {
      type: [imageSchema],
      default: [],
    },
    hoverImage: {
      type: [imageSchema],
      default: [],
    },
    cardType: {
      type: String,
      enum: ["NORMAL", "HOVER"],
      default: "NORMAL",
    },
    thumbnail: String,

    // Ownership
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    creatorType: {
      type: String,
      enum: CREATOR_TYPE,
      required: true,
      default: "ADMIN",
    },

    // Status & Visibility
    status: {
      type: String,
      enum: PRODUCT_STATUS,
      default: "PENDING",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    featuredRank: {
      type: Number,
      default: 0,
      index: true,
    },

    // For approval workflow
    rejectionReason: String,
    approvedAt: Date,
    approvedBy: mongoose.Schema.Types.ObjectId,

    // Ratings & Reviews
    ratings: {
      type: ratingsSchema,
      default: () => ({}),
    },

    // Analytics
    analytics: {
      type: analyticsSchema,
      default: () => ({}),
    },

    variantConfig: {
      type: [String],
      default: [],
    },
    variants: {
      type: [variantSchema],
      default: [],
    },

    // SEO
    metaDescription: String,
    metaKeywords: [String],

    // Additional Details - Shipping & Logistics
    weight: {
      value: {
        type: Number,
        required: true,
        min: [0.1, "Weight must be greater than 0"],
        description: "Weight in kilograms",
      },
      unit: {
        type: String,
        enum: ["kg"],
        default: "kg",
      },
    },
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
    },
    returnPolicy: String,
    modulesData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    attributes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    extraDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

productSchema.virtual("genericImages").get(function getGenericImages() {
  return Array.isArray(this.images) ? this.images : [];
});

productSchema.virtual("genericImages").set(function setGenericImages(value) {
  this.images = Array.isArray(value) ? value : [];
});

// Pre-save validation for weight
productSchema.pre("save", async function () {
  if (!this.weight || !this.weight.value) {
    const err = new Error(
      "Product weight is required. Must specify weight in kg with minimum value 0.1"
    );
    err.statusCode = 400;
    err.code = "WEIGHT_REQUIRED";
    throw err;
  }
});

const cacheManager = require("../../utils/cache.manager");

// Helper method to get weight in kg
productSchema.methods.getWeightInKg = function () {
  return this.weight?.value || 0;
};

// Sitemap Cache Invalidation
productSchema.post("save", function () {
  cacheManager.invalidatePrefix("sitemap:products");
  cacheManager.invalidatePrefix("sitemap:index");
});
productSchema.post("findOneAndUpdate", function () {
  cacheManager.invalidatePrefix("sitemap:products");
  cacheManager.invalidatePrefix("sitemap:index");
});
productSchema.post("findOneAndDelete", function () {
  cacheManager.invalidatePrefix("sitemap:products");
  cacheManager.invalidatePrefix("sitemap:index");
});
productSchema.post("updateOne", function () {
  cacheManager.invalidatePrefix("sitemap:products");
  cacheManager.invalidatePrefix("sitemap:index");
});
productSchema.post("deleteOne", function () {
  cacheManager.invalidatePrefix("sitemap:products");
  cacheManager.invalidatePrefix("sitemap:index");
});

// Indexes for performance
productSchema.index({ name: "text", description: "text" });
productSchema.index({ category: 1, isActive: 1, status: 1 });
productSchema.index({ categoryId: 1, subCategoryId: 1, createdAt: -1 });
productSchema.index({ createdBy: 1, status: 1 });
productSchema.index({ isActive: 1, status: 1, "ratings.averageRating": -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ status: 1, isActive: 1, createdAt: -1 });
productSchema.index({ "attributes.$**": 1 });
productSchema.index({ "variants.attributes.$**": 1 });
productSchema.index({ "variants.stock": 1, isActive: 1, status: 1 });

module.exports = {
  Product: mongoose.models.Product || mongoose.model("Product", productSchema),
  PRODUCT_STATUS,
  CREATOR_TYPE,
};
