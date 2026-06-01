const mongoose = require("mongoose");

const securityAuditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: String,
      trim: true,
      index: true,
    },
    actorRole: {
      type: String,
      trim: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    module: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    route: {
      type: String,
      trim: true,
      default: "",
    },
    payloadHash: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILURE", "BLOCKED"],
      required: true,
      index: true,
    },
    reason: {
      type: String,
      trim: true,
      default: "",
    },
    environment: {
      type: String,
      trim: true,
      default: "development",
      index: true,
    },
    ipAddress: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    device: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    browser: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, collection: "security_audit_logs" }
);

securityAuditLogSchema.index({ createdAt: -1, action: 1 });
securityAuditLogSchema.index({ module: 1, status: 1, createdAt: -1 });

module.exports =
  mongoose.models.SecurityAuditLog ||
  mongoose.model("SecurityAuditLog", securityAuditLogSchema);
