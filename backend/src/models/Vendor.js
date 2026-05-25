const mongoose = require("mongoose");

const VENDOR_STATUS = ["draft", "pending", "approved", "rejected"];
const SHIPPING_MODE = ["SELF", "PLATFORM"];

function buildVendorCodeFromId(id) {
  const raw = String(id || "").replace(/[^a-fA-F0-9]/g, "");
  const suffix = raw.slice(-8).toUpperCase().padStart(8, "0");
  return `VND-${suffix}`;
}

const pickupLocationSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 30 },
    addressLine1: { type: String, trim: true, maxlength: 240 },
    addressLine2: { type: String, trim: true, maxlength: 240, default: "" },
    city: { type: String, trim: true, maxlength: 120 },
    state: { type: String, trim: true, maxlength: 120 },
    pincode: { type: String, trim: true, maxlength: 20 },
    country: { type: String, trim: true, maxlength: 80, default: "India" },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false }
);

const vendorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    vendorCode: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
      index: true,
    },

    // Step 1
    companyName: { type: String, trim: true, maxlength: 160 },
    address: { type: String, trim: true, maxlength: 500 },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },

    // Step 2
    gstNumber: { type: String, trim: true, maxlength: 30 },
    noGst: { type: Boolean, default: false },
    documents: [
      {
        url: { type: String, required: true },
        publicId: { type: String },
        originalName: { type: String },
        mimeType: { type: String },
        size: { type: Number },
      },
    ],

    // Step 3 (DEPRECATED: Use VendorPayoutAccount instead)
    bankDetails: {
      accountNumber: { type: String, trim: true, maxlength: 40 },
      IFSC: { type: String, trim: true, maxlength: 20 },
      holderName: { type: String, trim: true, maxlength: 160 },
      accountType: { type: String, trim: true, maxlength: 30 },
    },
    razorpayContactId: { type: String, trim: true, maxlength: 80 },
    razorpayFundAccountId: { type: String, trim: true, maxlength: 80 },

    // Step 4
    shopName: { type: String, trim: true, maxlength: 160 },
    storeSlug: { type: String, trim: true, lowercase: true, sparse: true, index: true },
    storeDescription: { type: String, trim: true, maxlength: 1200 },
    supportEmail: { type: String, trim: true, lowercase: true, maxlength: 160 },
    supportPhone: { type: String, trim: true, maxlength: 30 },
    logoUrl: { type: String, trim: true, maxlength: 500 },
    bannerUrl: { type: String, trim: true, maxlength: 500 },
    isStoreVisible: { type: Boolean, default: true, index: true },
    isStoreFeatured: { type: Boolean, default: false, index: true },
    storeHiddenReason: { type: String, trim: true, maxlength: 500, default: "" },
    storeThemeColor: { type: String, trim: true, maxlength: 20, default: "#0f766e" },
    storeCategories: [{ type: String, trim: true, maxlength: 80 }],
    storeSeo: {
      metaTitle: { type: String, trim: true, maxlength: 70, default: "" },
      metaDescription: { type: String, trim: true, maxlength: 170, default: "" },
      metaKeywords: [{ type: String, trim: true, maxlength: 60 }],
      ogImage: { type: String, trim: true, maxlength: 500, default: "" },
    },
    storeAbout: {
      missionTitle: { type: String, trim: true, maxlength: 80, default: "" },
      missionText: { type: String, trim: true, maxlength: 160, default: "" },
      visionTitle: { type: String, trim: true, maxlength: 80, default: "" },
      visionText: { type: String, trim: true, maxlength: 160, default: "" },
      valueTitle: { type: String, trim: true, maxlength: 80, default: "" },
      valueText: { type: String, trim: true, maxlength: 160, default: "" },
    },
    storeSocialVisibility: {
      showExternalLinks: { type: Boolean, default: false },
      showSocialContacts: { type: Boolean, default: false },
      showDirectContact: { type: Boolean, default: false },
    },
    payoutSchedule: {
      type: String,
      enum: ["weekly", "biweekly", "monthly"],
      default: "weekly",
    },
    defaultCourier: { type: String, trim: true, maxlength: 80 },
    lowStockThreshold: { type: Number, min: 0, default: 10 },
    notificationPreferences: {
      emailOrders: { type: Boolean, default: true },
      emailPayouts: { type: Boolean, default: true },
      pushOrders: { type: Boolean, default: true },
      pushSystem: { type: Boolean, default: true },
    },
    pickupAddress: {
      type: pickupLocationSchema,
      default: null,
    },
    pickupLocations: {
      type: [pickupLocationSchema],
      default: [],
    },
    shippingSettings: {
      allowedShippingModes: {
        type: [{ type: String, enum: SHIPPING_MODE }],
        default: ["SELF", "PLATFORM"],
      },
      defaultShippingMode: {
        type: String,
        enum: SHIPPING_MODE,
        default: "SELF",
      },
      preferredPickupLocation: { type: String, trim: true, maxlength: 120, default: "Primary" },
      platformShippingEnabledAt: { type: Date },
      selfShippingEnabledAt: { type: Date },
    },
    shopImages: [
      {
        url: { type: String, required: true },
        publicId: { type: String },
        originalName: { type: String },
        mimeType: { type: String },
        size: { type: Number },
      },
    ],

    stepCompleted: { type: Number, default: 0, min: 0, max: 4, index: true },
    status: { type: String, enum: VENDOR_STATUS, default: "draft", index: true },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
    lastActiveAt: { type: Date },
  },
  { timestamps: true }
);

vendorSchema.pre("validate", function ensureVendorCode(next) {
  if (!this.vendorCode) {
    this.vendorCode = buildVendorCodeFromId(this._id);
  }
  next();
});

vendorSchema.index({ storeSlug: 1, status: 1, isStoreVisible: 1 });
vendorSchema.index({ isStoreFeatured: 1, status: 1, isStoreVisible: 1, createdAt: -1 });

module.exports = {
  Vendor: mongoose.model("Vendor", vendorSchema),
  VENDOR_STATUS,
  SHIPPING_MODE,
};
