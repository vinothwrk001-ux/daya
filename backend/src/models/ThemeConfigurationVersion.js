const mongoose = require("mongoose");

const themeConfigurationVersionSchema = new mongoose.Schema(
  {
    themeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ThemeConfiguration",
      required: true,
      index: true,
    },
    tenantType: { type: String, trim: true, default: "platform", index: true },
    tenantKey: { type: String, trim: true, default: "default", index: true },
    versionNumber: { type: Number, required: true, min: 1 },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    changedBy: { type: String, trim: true, default: "" },
    changeType: { type: String, trim: true, default: "update" },
    changeSummary: { type: [String], default: [] },
    rollbackAvailable: { type: Boolean, default: true },
    restoredFromVersion: { type: Number, default: null },
    publishedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "changedAt", updatedAt: false },
    collection: "theme_configuration_versions",
  }
);

themeConfigurationVersionSchema.index({ themeId: 1, versionNumber: -1 }, { unique: true });

module.exports =
  mongoose.models.ThemeConfigurationVersion ||
  mongoose.model("ThemeConfigurationVersion", themeConfigurationVersionSchema);
