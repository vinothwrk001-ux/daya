const mongoose = require("mongoose");

const systemBootstrapSchema = new mongoose.Schema(
  {
    bootstrapKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      default: "platform-default-config",
      index: true,
    },
    bootstrapCompleted: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    bootstrapVersion: {
      type: String,
      required: true,
      trim: true,
      default: "1.0.0",
    },
    bootstrapExecutedAt: {
      type: Date,
    },
    bootstrapExecutedBy: {
      type: String,
      trim: true,
      default: "cli",
    },
    environment: {
      type: String,
      trim: true,
      default: "development",
      index: true,
    },
    serverId: {
      type: String,
      trim: true,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, collection: "system_bootstrap" }
);

systemBootstrapSchema.index({ bootstrapCompleted: 1, bootstrapExecutedAt: -1 });

module.exports =
  mongoose.models.SystemBootstrap ||
  mongoose.model("SystemBootstrap", systemBootstrapSchema);
