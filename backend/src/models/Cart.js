const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 }, // snapshot (unit price at time of add)
    image: { type: String, default: "" },
    variantId: { type: String, trim: true, default: "" },
    variantSku: { type: String, trim: true, default: "" },
    variantTitle: { type: String, trim: true, default: "" },
    variantAttributes: {
      type: Map,
      of: String,
      default: {},
    },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    items: { type: [cartItemSchema], default: [] },
    totalAmount: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, default: "INR", enum: ["USD", "EUR", "INR", "GBP"] },
  },
  { timestamps: true }
);

cartSchema.index({ userId: 1, updatedAt: -1 });

module.exports = {
  Cart: mongoose.model("Cart", cartSchema),
};

