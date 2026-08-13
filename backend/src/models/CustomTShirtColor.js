const mongoose = require("mongoose");

const customTShirtColorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    hex: { type: String, required: true, trim: true },
    border: { type: Boolean, default: false },
    availableInGsm: [{ type: String, enum: ["180", "220"] }],
    isActive: { type: Boolean, default: true, index: true },
    displayOrder: { type: Number, default: 0, index: true },
  },
  { timestamps: true, collection: "custom_tshirt_colors" }
);

module.exports = mongoose.model("CustomTShirtColor", customTShirtColorSchema);
