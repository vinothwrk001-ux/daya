const mongoose = require("mongoose");

const ATTRIBUTE_TYPES = ["text", "number", "select", "multi-select", "boolean", "color"];
const VARIANT_DISPLAY_TYPES = ["button", "swatch", "image-swatch"];

const attributeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      match: /^[a-z][a-z0-9_]*$/,
    },
    type: {
      type: String,
      enum: ATTRIBUTE_TYPES,
      required: true,
      default: "text",
      index: true,
    },
    required: {
      type: Boolean,
      default: false,
    },
    options: {
      type: [String],
      default: [],
    },
    values: {
      type: [String],
      default: undefined,
    },
    moduleKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      match: /^[a-z][a-z0-9_]*$/,
      index: true,
    },
    group: {
      type: String,
      trim: true,
      default: "General",
      maxlength: 120,
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    appliesTo: {
      categoryIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      }],
      subCategoryIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subcategory",
      }],
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    template: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    isVariant: {
      type: Boolean,
      default: false,
      index: true,
    },
    useInFilters: {
      type: Boolean,
      default: false,
      index: true,
    },
    variantConfig: {
      displayType: {
        type: String,
        enum: VARIANT_DISPLAY_TYPES,
        default: "button",
      },
      affectsImage: {
        type: Boolean,
        default: false,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

attributeSchema.index(
  { key: 1, moduleKey: 1 },
  { unique: true }
);
attributeSchema.index({
  "appliesTo.categoryIds": 1,
  moduleKey: 1,
  order: 1,
});
attributeSchema.index({
  "appliesTo.subCategoryIds": 1,
});

module.exports = {
  ATTRIBUTE_TYPES,
  VARIANT_DISPLAY_TYPES,
  Attribute: mongoose.models.Attribute || mongoose.model("Attribute", attributeSchema),
};
