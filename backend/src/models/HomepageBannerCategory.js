const mongoose = require("mongoose");

const homepageBannerCategorySchema = new mongoose.Schema(
  {
    bannerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HomepageBanner",
      required: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    displayOrder: { type: Number, default: 0, index: true },
    customTitle: { type: String, trim: true, default: "", maxlength: 160 },
    customSubtitle: { type: String, trim: true, default: "", maxlength: 320 },
    cardImage: { type: String, trim: true, default: "" },
    cardImagePublicId: { type: String, trim: true, default: "" },
    ctaUrl: { type: String, trim: true, default: "", maxlength: 500 },
    showProductCount: { type: Boolean, default: true },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    analytics: {
      views: { type: Number, default: 0, min: 0 },
      clicks: { type: Number, default: 0, min: 0 },
    },
  },
  { timestamps: true, collection: "homepage_banner_categories" }
);

homepageBannerCategorySchema.index({ bannerId: 1, categoryId: 1 }, { unique: true });
homepageBannerCategorySchema.index({ bannerId: 1, displayOrder: 1 });

module.exports = {
  HomepageBannerCategory:
    mongoose.models.HomepageBannerCategory ||
    mongoose.model("HomepageBannerCategory", homepageBannerCategorySchema),
};
