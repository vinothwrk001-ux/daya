const mongoose = require("mongoose");

const invoiceAuditLogSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", index: true },
    metadataId: { type: mongoose.Schema.Types.ObjectId, ref: "InvoiceMetadata", index: true },
    actorId: { type: String, trim: true, default: "" },
    actorRole: { type: String, trim: true, default: "" },
    action: { type: String, trim: true, required: true },
    changes: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, trim: true, default: "" },
    userAgent: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,
    collection: "invoice_audit_logs",
  }
);

module.exports =
  mongoose.models.InvoiceAuditLog ||
  mongoose.model("InvoiceAuditLog", invoiceAuditLogSchema);
