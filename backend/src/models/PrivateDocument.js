const mongoose = require("mongoose");

const privateDocumentSchema = new mongoose.Schema(
  {
    ownerType: {
      type: String,
      required: true,
      enum: ["customer", "admin", "staff", "system"],
      index: true,
    },
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, index: true },
    documentType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      trim: true,
      enum: ["kyc", "identity", "bank", "tax", "verification", "withdrawal", "finance", "contract", "compliance", "supporting"],
      default: "supporting",
      index: true,
    },
    storageKey: { type: String, required: true, trim: true },
    originalName: { type: String, trim: true, default: "" },
    mimeType: { type: String, required: true, trim: true },
    size: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: ["pending", "under_review", "verified", "rejected", "expired", "revoked"],
      default: "pending",
      index: true,
    },
    sourceModel: { type: String, trim: true, default: "" },
    sourceId: { type: mongoose.Schema.Types.ObjectId, index: true },
    accessRevokedAt: { type: Date },
    deletedAt: { type: Date, index: true },
  },
  { timestamps: true, collection: "private_documents" }
);

privateDocumentSchema.index({ ownerType: 1, ownerId: 1, category: 1, status: 1 });
privateDocumentSchema.index({ sourceModel: 1, sourceId: 1 }, { sparse: true });

module.exports =
  mongoose.models.PrivateDocument ||
  mongoose.model("PrivateDocument", privateDocumentSchema);
