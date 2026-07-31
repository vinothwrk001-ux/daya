const mongoose = require("mongoose");
const { generateSlug } = require("../utils/slug");

const CATEGORY_STATUS = ["active", "inactive", "draft", "archived"];
const CATEGORY_VISIBILITY = ["public", "private", "hidden"];

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    code: {
      type: String,
      trim: true,
      maxlength: 10,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    icon: {
      type: String,
      trim: true,
      default: "",
    },
    logo: {
      type: String,
      trim: true,
      default: "",
    },
    thumbnailUrl: {
      type: String,
      trim: true,
      default: "",
    },
    bannerUrl: {
      type: String,
      trim: true,
      default: "",
    },
    cloudinaryPublicId: {
      type: String,
      trim: true,
      default: "",
    },
    color: {
      type: String,
      trim: true,
      default: "",
    },
    parentCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: CATEGORY_STATUS,
      default: "active",
      index: true,
    },
    visibility: {
      type: String,
      enum: CATEGORY_VISIBILITY,
      default: "public",
      index: true,
    },
    showOnHomepage: {
      type: Boolean,
      default: true,
      index: true,
    },
    showInHeroBanner: {
      type: Boolean,
      default: false,
      index: true,
    },
    redirectToServices: {
      type: Boolean,
      default: false,
      index: true,
    },
    heroHeading: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },
    heroSubheading: {
      type: String,
      trim: true,
      maxlength: 320,
      default: "",
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    productCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    seoTitle: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },
    seoDescription: {
      type: String,
      trim: true,
      maxlength: 320,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

categorySchema.pre("validate", function setCategorySlug() {
  if (!this.code && this.name) {
    this.code = this.name.charAt(0).toUpperCase();
  } else if (this.code) {
    this.code = this.code.trim().toUpperCase();
  }

  if (!this.slug && this.name) {
    this.slug = generateSlug(this.name);
  } else if (this.slug) {
    this.slug = generateSlug(this.slug);
  }
});

const cacheManager = require("../utils/cache.manager");

// Sitemap Cache Invalidation
categorySchema.post("save", function () {
  cacheManager.invalidatePrefix("sitemap:categories");
  cacheManager.invalidatePrefix("sitemap:index");
});
categorySchema.post("findOneAndUpdate", function () {
  cacheManager.invalidatePrefix("sitemap:categories");
  cacheManager.invalidatePrefix("sitemap:index");
});
categorySchema.post("findOneAndDelete", function () {
  cacheManager.invalidatePrefix("sitemap:categories");
  cacheManager.invalidatePrefix("sitemap:index");
});
categorySchema.post("updateOne", function () {
  cacheManager.invalidatePrefix("sitemap:categories");
  cacheManager.invalidatePrefix("sitemap:index");
});
categorySchema.post("deleteOne", function () {
  cacheManager.invalidatePrefix("sitemap:categories");
  cacheManager.invalidatePrefix("sitemap:index");
});

categorySchema.index({ isActive: 1, order: 1, name: 1 });
categorySchema.index({ status: 1, visibility: 1, showOnHomepage: 1, order: 1 });
categorySchema.index({ status: 1, visibility: 1, showInHeroBanner: 1, order: 1 });

module.exports = {
  Category: mongoose.models.Category || mongoose.model("Category", categorySchema),
  CATEGORY_STATUS,
  CATEGORY_VISIBILITY,
};
