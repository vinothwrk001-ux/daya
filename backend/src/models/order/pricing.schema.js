const mongoose = require("mongoose");

const pricingSnapshotSchema = new mongoose.Schema(
  {
    subtotal: { type: Number, min: 0, default: 0 },
    charges: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    chargesTotal: { type: Number, min: 0, default: 0 },
    total: { type: Number, min: 0, default: 0 },
    paymentMethod: {
      type: String,
      enum: ["ONLINE", "COD"],
      default: "ONLINE",
    },
    calculatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const priceBreakdownSchema = new mongoose.Schema(
  {
    subtotal: { type: Number, min: 0, default: 0 },
    shippingFee: { type: Number, min: 0, default: 0 },
    codFee: { type: Number, min: 0, default: 0 },
    gatewayFee: { type: Number, min: 0, default: 0 },
    taxAmount: { type: Number, min: 0, default: 0 },
    discountAmount: { type: Number, min: 0, default: 0 },
    chargesTotal: { type: Number, min: 0, default: 0 },
    totalAmount: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: "INR" },
    paymentMethod: {
      type: String,
      enum: ["ONLINE", "COD"],
      default: "ONLINE",
    },
    charges: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    calculatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

module.exports = {
  pricingSnapshotSchema,
  priceBreakdownSchema,
};
