const mongoose = require("mongoose");

const assetVariantSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: "" },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    size: { type: Number, default: 0 },
  },
  { _id: false }
);

const brandingAssetSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: "" },
    webpUrl: { type: String, trim: true, default: "" },
    thumbnailUrl: { type: String, trim: true, default: "" },
    originalName: { type: String, trim: true, default: "" },
    mimeType: { type: String, trim: true, default: "" },
    size: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    checksum: { type: String, trim: true, default: "" },
    altText: { type: String, trim: true, default: "" },
    storageProvider: { type: String, trim: true, default: "local" },
    variants: {
      original: { type: assetVariantSchema, default: () => ({}) },
      webp: { type: assetVariantSchema, default: () => ({}) },
      thumbnail: { type: assetVariantSchema, default: () => ({}) },
    },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const footerLinkSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: "" },
    href: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const footerSectionSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    links: { type: [footerLinkSchema], default: () => [] },
  },
  { _id: false }
);

const companyBrandingSchema = new mongoose.Schema(
  {
    tenantType: {
      type: String,
      trim: true,
      default: "platform",
      index: true,
    },
    tenantKey: {
      type: String,
      trim: true,
      default: "default",
      index: true,
    },
    companyName: { type: String, trim: true, default: "" },
    legalCompanyName: { type: String, trim: true, default: "" },
    tagline: { type: String, trim: true, default: "" },
    supportEmail: { type: String, trim: true, lowercase: true, default: "" },
    supportPhone: { type: String, trim: true, default: "" },
    websiteUrl: { type: String, trim: true, default: "" },
    primaryLogo: { type: brandingAssetSchema, default: () => ({}) },
    darkLogo: { type: brandingAssetSchema, default: () => ({}) },
    mobileLogo: { type: brandingAssetSchema, default: () => ({}) },
    favicon: { type: brandingAssetSchema, default: () => ({}) },
    emailLogo: { type: brandingAssetSchema, default: () => ({}) },
    invoiceLogo: { type: brandingAssetSchema, default: () => ({}) },
    brandColors: {
      primaryColor: { type: String, trim: true, default: "#0f172a" },
      secondaryColor: { type: String, trim: true, default: "#1e293b" },
      accentColor: { type: String, trim: true, default: "#f97316" },
      successColor: { type: String, trim: true, default: "#16a34a" },
      warningColor: { type: String, trim: true, default: "#f59e0b" },
      dangerColor: { type: String, trim: true, default: "#dc2626" },
    },
    seoBranding: {
      organizationName: { type: String, trim: true, default: "" },
      organizationLogo: { type: brandingAssetSchema, default: () => ({}) },
      organizationUrl: { type: String, trim: true, default: "" },
    },
    footer: {
      enabled: { type: Boolean, default: true },
      theme: { type: String, trim: true, default: "dark" },
      backgroundColor: { type: String, trim: true, default: "#0f172a" },
      textColor: { type: String, trim: true, default: "#e2e8f0" },
      linkColor: { type: String, trim: true, default: "#60a5fa" },
      sections: { type: [footerSectionSchema], default: () => [] },
      socialLinks: { type: [footerLinkSchema], default: () => [] },
      legalLinks: { type: [footerLinkSchema], default: () => [] },
      copyrightText: { type: String, trim: true, default: "" },
    },
    version: { type: Number, default: 1, min: 1 },
    createdBy: { type: String, trim: true, default: "" },
    updatedBy: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,
    collection: "company_branding",
  }
);

companyBrandingSchema.index({ tenantType: 1, tenantKey: 1 }, { unique: true });
companyBrandingSchema.index({ updatedAt: -1 });

module.exports =
  mongoose.models.CompanyBranding ||
  mongoose.model("CompanyBranding", companyBrandingSchema);
