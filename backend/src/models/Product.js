const mongoose = require("mongoose");

const PRODUCT_STATUS = ["PENDING", "APPROVED", "REJECTED"];
const CREATOR_TYPE = ["ADMIN"];

const variantOptionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const variantImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    altText: String,
    isPrimary: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const productVariantSchema = new mongoose.Schema(
  {
    variantId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      default: "",
    },
    attributes: {
      type: Map,
      of: String,
      default: {},
    },
    options: {
      type: [variantOptionSchema],
      default: [],
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    discountPrice: {
      type: Number,
      min: 0,
    },
    weight: {
      value: {
        type: Number,
        min: 0,
      },
      unit: {
        type: String,
        enum: ["kg"],
        default: "kg",
      },
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    reservedStock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    threshold: {
      type: Number,
      required: true,
      min: 0,
      default: 10,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    images: {
      type: [variantImageSchema],
      default: [],
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const productImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    altText: String,
    isPrimary: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

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
      type: [productImageSchema],
      default: [],
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
      averageRating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0,
      },
      totalReviews: {
        type: Number,
        default: 0,
      },
      ratingBreakdown: {
        five: { type: Number, default: 0 },
        four: { type: Number, default: 0 },
        three: { type: Number, default: 0 },
        two: { type: Number, default: 0 },
        one: { type: Number, default: 0 },
      },
    },

    // Analytics
    analytics: {
      views: {
        type: Number,
        default: 0,
      },
      salesCount: {
        type: Number,
        default: 0,
      },
      totalRevenue: {
        type: Number,
        default: 0,
      },
    },

    variantConfig: {
      type: [String],
      default: [],
    },
    variants: {
      type: [productVariantSchema],
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

// Helper method to get weight in kg
productSchema.methods.getWeightInKg = function () {
  return this.weight?.value || 0;
};

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
  Product: mongoose.model("Product", productSchema),
  PRODUCT_STATUS,
  CREATOR_TYPE,
};
