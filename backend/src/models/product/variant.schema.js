const mongoose = require("mongoose");
const variantOptionSchema = require("./variantOption.schema");
const imageSchema = require("./image.schema");

const variantSchema = new mongoose.Schema(
  {
    variantId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      default: "",
    },
    attributes: {
      type: Map,
      of: String,
      default: {},
    },
    options: {
      type: [variantOptionSchema],
      default: [],
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    discountPrice: {
      type: Number,
      min: 0,
    },
    weight: {
      value: {
        type: Number,
        min: 0,
      },
      unit: {
        type: String,
        enum: ["kg"],
        default: "kg",
      },
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    reservedStock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    threshold: {
      type: Number,
      required: true,
      min: 0,
      default: 10,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    images: {
      type: [imageSchema],
      default: [],
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

module.exports = variantSchema;
