const mongoose = require("mongoose");

const versionSnapshotSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    customNotes: { type: String, trim: true, default: "" },
    footerText: { type: String, trim: true, default: "" },
    billingLabel: { type: String, trim: true, default: "Bill To" },
    sellerLabel: { type: String, trim: true, default: "Sold By" },
    gstLabel: { type: String, trim: true, default: "GST" },
    organizationOverrides: {
      organizationName: { type: String, trim: true, default: "" },
      legalCompanyName: { type: String, trim: true, default: "" },
      gstNumber: { type: String, trim: true, default: "" },
      supportEmail: { type: String, trim: true, default: "" },
      supportPhone: { type: String, trim: true, default: "" },
      billingAddress: { type: String, trim: true, default: "" },
      registeredAddress: { type: String, trim: true, default: "" },
    },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const invoiceMetadataSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true, index: true },
    invoiceNumber: { type: String, trim: true, required: true, index: true },
    customNotes: { type: String, trim: true, default: "" },
    footerText: { type: String, trim: true, default: "" },
    billingLabel: { type: String, trim: true, default: "Bill To" },
    sellerLabel: { type: String, trim: true, default: "Sold By" },
    gstLabel: { type: String, trim: true, default: "GST" },
    organizationOverrides: {
      organizationName: { type: String, trim: true, default: "" },
      legalCompanyName: { type: String, trim: true, default: "" },
      gstNumber: { type: String, trim: true, default: "" },
      supportEmail: { type: String, trim: true, default: "" },
      supportPhone: { type: String, trim: true, default: "" },
      billingAddress: { type: String, trim: true, default: "" },
      registeredAddress: { type: String, trim: true, default: "" },
    },
    generatedAt: { type: Date, default: Date.now },
    generatedBy: { type: String, trim: true, default: "" },
    version: { type: Number, default: 1, min: 1 },
    versions: { type: [versionSnapshotSchema], default: [] },
  },
  {
    timestamps: true,
    collection: "invoice_metadata",
  }
);

module.exports =
  mongoose.models.InvoiceMetadata ||
  mongoose.model("InvoiceMetadata", invoiceMetadataSchema);
