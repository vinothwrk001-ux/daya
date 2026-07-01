const mongoose = require("mongoose");
const { createGlobalTheme } = require("../modules/theme-engine/tokens");

const scheduleSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    timezone: { type: String, trim: true, default: "UTC" },
  },
  { _id: false }
);

const themeConfigurationSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true, maxlength: 120 },
    description: { type: String, trim: true, default: "", maxlength: 500 },
    isActive: { type: Boolean, default: false, index: true },
    isDefault: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: ["draft", "published", "scheduled", "archived"],
      default: "draft",
      index: true,
    },
    themeType: { type: String, trim: true, default: "custom", index: true },
    version: { type: Number, default: 1, min: 1 },
    globalTheme: { type: mongoose.Schema.Types.Mixed, default: () => createGlobalTheme() },
    pageThemes: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    sectionThemes: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    componentThemes: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    mobileTheme: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    tabletTheme: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    desktopTheme: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    schedule: { type: scheduleSchema, default: () => ({}) },
    publishedAt: { type: Date, default: null },
    clonedFrom: { type: mongoose.Schema.Types.ObjectId, ref: "ThemeConfiguration", default: null },
    tenantType: { type: String, trim: true, default: "platform", index: true },
    tenantKey: { type: String, trim: true, default: "default", index: true },
    createdBy: { type: String, trim: true, default: "" },
    updatedBy: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,
    collection: "theme_configurations",
  }
);

themeConfigurationSchema.index({ tenantType: 1, tenantKey: 1, isActive: 1 });
themeConfigurationSchema.index({ tenantType: 1, tenantKey: 1, isDefault: 1 });
themeConfigurationSchema.index({ status: 1, "schedule.startAt": 1, "schedule.endAt": 1 });
themeConfigurationSchema.index({ updatedAt: -1 });

module.exports =
  mongoose.models.ThemeConfiguration ||
  mongoose.model("ThemeConfiguration", themeConfigurationSchema);
