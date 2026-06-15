const mongoose = require("mongoose");

const CHECKOUT_SESSION_STATUS = ["ACTIVE", "COMPLETED", "EXPIRED", "CANCELLED"];

const checkoutSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    guestToken: {
      type: String,
      trim: true,
      index: true,
      default: null,
    },
    mode: {
      type: String,
      enum: ["BUY_NOW"],
      default: "BUY_NOW",
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    variantId: { type: String, trim: true, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    productName: { type: String, trim: true, default: "" },
    productImage: { type: String, trim: true, default: "" },
    variantSku: { type: String, trim: true, default: "" },
    variantTitle: { type: String, trim: true, default: "" },
    variantAttributes: {
      type: Map,
      of: String,
      default: {},
    },
    currency: { type: String, default: "INR", enum: ["USD", "EUR", "INR", "GBP"] },
    status: {
      type: String,
      enum: CHECKOUT_SESSION_STATUS,
      default: "ACTIVE",
      index: true,
    },
    orderGroupId: { type: String, trim: true, default: "" },
    expiresAt: { type: Date, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: "checkout_sessions",
  }
);

checkoutSessionSchema.index({ userId: 1, status: 1, createdAt: -1 });
checkoutSessionSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    name: "checkout_session_ttl",
  }
);

module.exports = {
  CheckoutSession:
    mongoose.models.CheckoutSession || mongoose.model("CheckoutSession", checkoutSessionSchema),
  CHECKOUT_SESSION_STATUS,
};
