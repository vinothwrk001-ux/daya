const mongoose = require("mongoose");
const { generateSlug } = require("../utils/slug");

const CONTAINER_STATUS = ["active", "inactive", "draft"];

const defaultContainerSettings = {
  maxCategoryCards: 6,
  autoplay: true,
  autoplayIntervalMs: 5000,
  transitionEffect: "fade",
  pauseOnHover: true,
  enableLoop: true,
  showArrows: true,
  showDots: true,
};

const homepageBannerContainerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true, default: "", maxlength: 500 },
    status: { type: String, enum: CONTAINER_STATUS, default: "active", index: true },
    displayOrder: { type: Number, default: 0, index: true },
    showOnHomepage: { type: Boolean, default: true, index: true },
    publishedToBuilder: { type: Boolean, default: false },
    builderContainerId: { type: mongoose.Schema.Types.ObjectId, ref: "HomepageContainer", default: null },
    overlayOpacity: { type: Number, default: 0, min: 0, max: 1 },
    textPosition: { type: String, enum: ["left", "center", "right"], default: "left" },
    settings: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ ...defaultContainerSettings }),
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, collection: "homepage_banner_containers" }
);

homepageBannerContainerSchema.pre("validate", function normalizeSlug() {
  if (!this.slug && this.name) {
    this.slug = generateSlug(this.name);
  } else if (this.slug) {
    this.slug = generateSlug(this.slug);
  }
});

homepageBannerContainerSchema.index({ showOnHomepage: 1, status: 1, displayOrder: 1 });

module.exports = {
  HomepageBannerContainer:
    mongoose.models.HomepageBannerContainer ||
    mongoose.model("HomepageBannerContainer", homepageBannerContainerSchema),
  CONTAINER_STATUS,
  defaultContainerSettings,
};
