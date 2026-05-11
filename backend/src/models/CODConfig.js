const mongoose = require("mongoose");

const codZoneRuleSchema = new mongoose.Schema(
  {
    zone: { type: String, trim: true, required: true },
    states: { type: [String], default: [] },
    postalCodes: { type: [String], default: [] },
    feeType: { type: String, enum: ["FIXED", "PERCENTAGE"], default: "FIXED" },
    feeValue: { type: Number, min: 0, default: 0 },
    freeAboveValue: { type: Number, min: 0, default: 0 },
    isRemote: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const codConfigSchema = new mongoose.Schema(
  {
    isEnabled: { type: Boolean, default: true },
    maxOrderValue: { type: Number, min: 0, default: 50000 },
    minOrderValue: { type: Number, min: 0, default: 0 },
    freeCodAboveValue: { type: Number, min: 0, default: 0 },
    defaultFeeType: { type: String, enum: ["FIXED", "PERCENTAGE"], default: "FIXED" },
    defaultFeeValue: { type: Number, min: 0, default: 0 },
    vendorHoldDays: { type: Number, min: 0, default: 3 },
    maxRiskScore: { type: Number, min: 0, max: 100, default: 60 },
    restrictedPostalCodes: { type: [String], default: [] },
    restrictedStates: { type: [String], default: [] },
    restrictedVendorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Vendor" }],
    restrictedProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    disabledForRemoteZones: { type: Boolean, default: true },
    zoneRules: { type: [codZoneRuleSchema], default: [] },
    notes: { type: String, trim: true, maxlength: 1000 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    collection: "cod_configs",
  }
);

codConfigSchema.index({ updatedAt: -1 });

module.exports = mongoose.models.CODConfig || mongoose.model("CODConfig", codConfigSchema);
