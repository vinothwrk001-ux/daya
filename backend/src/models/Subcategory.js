const mongoose = require("mongoose");
const { generateSlug } = require("../utils/slug");

const SUBCATEGORY_STATUS = ["active", "disabled"];

const subcategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: SUBCATEGORY_STATUS,
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

subcategorySchema.pre("validate", function setSubcategorySlug() {
  if (!this.slug && this.name) {
    this.slug = generateSlug(this.name);
  } else if (this.slug) {
    this.slug = generateSlug(this.slug);
  }
});

subcategorySchema.index({ categoryId: 1, name: 1 }, { unique: true });
subcategorySchema.index({ categoryId: 1, code: 1 }, { unique: true });
subcategorySchema.index({ categoryId: 1, slug: 1 }, { unique: true, sparse: true });
subcategorySchema.index({ categoryId: 1, status: 1, name: 1 });

module.exports = {
  SUBCATEGORY_STATUS,
  Subcategory: mongoose.models.Subcategory || mongoose.model("Subcategory", subcategorySchema),
};
