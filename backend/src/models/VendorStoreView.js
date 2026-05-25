const mongoose = require("mongoose");

const EVENT_TYPES = [
  "PAGE_VIEW",
  "UNIQUE_VISITOR",
  "PRODUCT_CLICK",
  "WISHLIST_ADD",
  "CART_ADD",
  "CONVERSION",
  "REVENUE",
  "STORE_CLICK",
  "FOLLOW",
  "UNFOLLOW",
];

const vendorStoreViewSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    sessionId: { type: String, trim: true, maxlength: 120, index: true, default: "" },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", index: true, default: null },
    eventType: { type: String, enum: EVENT_TYPES, required: true, index: true },
    path: { type: String, trim: true, maxlength: 240, default: "" },
    revenue: { type: Number, min: 0, default: 0 },
    quantity: { type: Number, min: 0, default: 0 },
    ipHash: { type: String, trim: true, maxlength: 128, default: "" },
    userAgentHash: { type: String, trim: true, maxlength: 128, default: "" },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

vendorStoreViewSchema.index({ vendorId: 1, eventType: 1, createdAt: -1 });
vendorStoreViewSchema.index({ vendorId: 1, sessionId: 1, eventType: 1, createdAt: -1 });

module.exports = {
  VendorStoreView:
    mongoose.models.VendorStoreView || mongoose.model("VendorStoreView", vendorStoreViewSchema),
  VENDOR_STORE_EVENT_TYPES: EVENT_TYPES,
};
