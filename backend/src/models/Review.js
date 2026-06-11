const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 160 },
    comment: { type: String, trim: true, maxlength: 2000 },
    platformResponse: {
      message: { type: String, trim: true, maxlength: 1200 },
      respondedAt: { type: Date },
    },
  },
  { timestamps: true }
);

reviewSchema.index({ productId: 1, createdAt: -1 });

module.exports = {
  Review: mongoose.model("Review", reviewSchema),
};
