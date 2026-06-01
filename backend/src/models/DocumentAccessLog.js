const mongoose = require("mongoose");

const documentAccessLogSchema = new mongoose.Schema(
  {
    documentId: { type: mongoose.Schema.Types.ObjectId, index: true },
    documentType: { type: String, trim: true, default: "" },
    ownerType: { type: String, trim: true, default: "", index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, index: true },
    requesterId: { type: String, trim: true, default: "", index: true },
    requesterRole: { type: String, trim: true, default: "", index: true },
    action: {
      type: String,
      enum: ["DOWNLOAD", "VIEW", "PREVIEW", "FAILED_ACCESS"],
      required: true,
      index: true,
    },
    outcome: {
      type: String,
      enum: ["ALLOWED", "DENIED"],
      required: true,
      index: true,
    },
    reason: { type: String, trim: true, default: "" },
    ipAddress: { type: String, trim: true, default: "" },
    userAgent: { type: String, trim: true, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "document_access_logs" }
);

documentAccessLogSchema.index({ requesterId: 1, action: 1, createdAt: -1 });
documentAccessLogSchema.index({ documentId: 1, createdAt: -1 });
documentAccessLogSchema.index({ outcome: 1, createdAt: -1 });

module.exports =
  mongoose.models.DocumentAccessLog ||
  mongoose.model("DocumentAccessLog", documentAccessLogSchema);
