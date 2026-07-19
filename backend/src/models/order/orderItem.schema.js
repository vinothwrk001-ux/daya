const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    productName: { type: String, trim: true, default: "" },
    productNumber: { type: String, trim: true, default: "" },
    sku: { type: String, trim: true, default: "" },
    name: { type: String, trim: true, default: "" },
    price: { type: Number, required: true, min: 0, default: 0 },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    image: { type: String },
    variantId: { type: String, trim: true, default: "" },
    variantSku: { type: String, trim: true, default: "" },
    variantTitle: { type: String, trim: true, default: "" },
    variantAttributes: {
      type: Map,
      of: String,
      default: {},
    },
    weight: {
      value: { type: Number, min: 0 },
      unit: { type: String, trim: true, default: "kg" },
    },
  },
  { _id: false }
);

module.exports = orderItemSchema;
