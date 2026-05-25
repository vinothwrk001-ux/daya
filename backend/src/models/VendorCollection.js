const mongoose = require("mongoose");

const vendorCollectionSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    imageUrl: { type: String, trim: true, maxlength: 500, default: "" },
    type: {
      type: String,
      enum: ["FEATURED", "SEASONAL", "CATEGORY", "CUSTOM"],
      default: "CUSTOM",
      index: true,
    },
    category: { type: String, trim: true, maxlength: 120, default: "" },
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

vendorCollectionSchema.index({ vendorId: 1, slug: 1 }, { unique: true });
vendorCollectionSchema.index({ vendorId: 1, isActive: 1, sortOrder: 1 });

module.exports = {
  VendorCollection:
    mongoose.models.VendorCollection || mongoose.model("VendorCollection", vendorCollectionSchema),
};
