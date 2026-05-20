const mongoose = require("mongoose");

const versionSchema = new mongoose.Schema(
  {
    layoutId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HomepageLayout",
      required: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived", "rolled_back"],
      default: "published",
      index: true,
    },
    snapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    publishedAt: {
      type: Date,
      default: null,
      index: true,
    },
    rollbackSourceVersion: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "homepage_layout_versions",
  }
);

versionSchema.index({ layoutId: 1, version: -1 }, { unique: true });

module.exports = {
  HomepageLayoutVersion:
    mongoose.models.HomepageLayoutVersion ||
    mongoose.model("HomepageLayoutVersion", versionSchema),
};
