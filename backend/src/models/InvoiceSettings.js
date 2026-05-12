const mongoose = require("mongoose");

const invoiceSettingsSchema = new mongoose.Schema(
  {
    organizationName: { type: String, trim: true, default: "" },
    legalCompanyName: { type: String, trim: true, default: "" },
    gstNumber: { type: String, trim: true, default: "" },
    cinNumber: { type: String, trim: true, default: "" },
    supportEmail: { type: String, trim: true, default: "" },
    supportPhone: { type: String, trim: true, default: "" },
    billingAddress: { type: String, trim: true, default: "" },
    registeredAddress: { type: String, trim: true, default: "" },
    taxLabel: { type: String, trim: true, default: "GST" },
    invoicePrefix: { type: String, trim: true, default: "INV" },
    footerNotes: { type: String, trim: true, default: "" },
    companyWebsite: { type: String, trim: true, default: "" },
    bankDetails: {
      accountName: { type: String, trim: true, default: "" },
      accountNumber: { type: String, trim: true, default: "" },
      ifscCode: { type: String, trim: true, default: "" },
      bankName: { type: String, trim: true, default: "" },
      branchName: { type: String, trim: true, default: "" },
      upiId: { type: String, trim: true, default: "" },
    },
    logoUrl: { type: String, trim: true, default: "" },
    logoAsset: {
      publicId: { type: String, trim: true, default: "" },
      originalName: { type: String, trim: true, default: "" },
    },
    signatureUrl: { type: String, trim: true, default: "" },
    signatureAsset: {
      publicId: { type: String, trim: true, default: "" },
      originalName: { type: String, trim: true, default: "" },
    },
    updatedBy: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,
    collection: "invoice_settings",
  }
);

module.exports =
  mongoose.models.InvoiceSettings ||
  mongoose.model("InvoiceSettings", invoiceSettingsSchema);
