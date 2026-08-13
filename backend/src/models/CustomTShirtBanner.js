const mongoose = require("mongoose");

const customTShirtBannerSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 160 },
    imageUrl: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    displayOrder: { type: Number, default: 0, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, collection: "custom_tshirt_banners" }
);

module.exports = mongoose.model("CustomTShirtBanner", customTShirtBannerSchema);
