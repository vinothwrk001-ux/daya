const mongoose = require("mongoose");
const { generateSlug } = require("../utils/slug");

const BANNER_STATUS = ["active", "inactive", "draft", "scheduled"];

const homepageBannerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    title: { type: String, trim: true, default: "", maxlength: 200 },
    subtitle: { type: String, trim: true, default: "", maxlength: 320 },
    description: { type: String, trim: true, default: "", maxlength: 2000 },
    ctaText: { type: String, trim: true, default: "Shop now", maxlength: 80 },
    ctaUrl: { type: String, trim: true, default: "", maxlength: 500 },
    desktopImage: { type: String, trim: true, default: "" },
    mobileImage: { type: String, trim: true, default: "" },
    desktopImagePublicId: { type: String, trim: true, default: "" },
    mobileImagePublicId: { type: String, trim: true, default: "" },
    status: { type: String, enum: BANNER_STATUS, default: "active", index: true },
    displayOrder: { type: Number, default: 0, index: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    showOnHomepage: { type: Boolean, default: true, index: true },
    analytics: {
      views: { type: Number, default: 0, min: 0 },
      clicks: { type: Number, default: 0, min: 0 },
      conversions: { type: Number, default: 0, min: 0 },
      revenue: { type: Number, default: 0, min: 0 },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, collection: "homepage_banners" }
);

homepageBannerSchema.pre("validate", function normalizeSlug() {
  if (!this.slug && this.name) {
    this.slug = generateSlug(this.name);
  } else if (this.slug) {
    this.slug = generateSlug(this.slug);
  }
});

homepageBannerSchema.index({ showOnHomepage: 1, status: 1, displayOrder: 1 });

module.exports = {
  HomepageBanner: mongoose.models.HomepageBanner || mongoose.model("HomepageBanner", homepageBannerSchema),
  BANNER_STATUS,
};
