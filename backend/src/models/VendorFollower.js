const mongoose = require("mongoose");

const vendorFollowerSchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },
    notificationEnabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    followedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    source: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "storefront",
    },
  },
  { timestamps: true }
);

vendorFollowerSchema.index({ vendorId: 1, customerId: 1 }, { unique: true });
vendorFollowerSchema.index({ customerId: 1, followedAt: -1 });

module.exports = {
  VendorFollower:
    mongoose.models.VendorFollower || mongoose.model("VendorFollower", vendorFollowerSchema),
};
