const mongoose = require("mongoose");

const platformConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: ["platform_fee", "feature", "payment", "security", "email", "shipping", "general"],
      default: "general",
      index: true,
    },
    type: {
      type: String,
      enum: ["string", "number", "boolean", "object", "array"],
      default: "string",
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    requiresRestart: {
      type: Boolean,
      default: false,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Indexes for efficient querying
platformConfigSchema.index({ category: 1, key: 1 });
platformConfigSchema.index({ updatedAt: -1 });

module.exports = mongoose.model("PlatformConfig", platformConfigSchema);
