const mongoose = require("mongoose");

const paymentGatewayConfigSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["RAZORPAY"],
      required: true,
      unique: true,
      default: "RAZORPAY",
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    gatewayFeePercentage: {
      type: Number,
      min: 0,
      default: 0,
    },
    gatewayFeeFixed: {
      type: Number,
      min: 0,
      default: 0,
    },
    prepaidDiscountPercentage: {
      type: Number,
      min: 0,
      default: 0,
    },
    prepaidDiscountFixed: {
      type: Number,
      min: 0,
      default: 0,
    },
    sessionTimeoutMinutes: {
      type: Number,
      min: 5,
      default: 15,
    },
    webhookSecretConfigured: {
      type: Boolean,
      default: false,
    },
    webhookUrl: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
    collection: "payment_gateway_configs",
  }
);

module.exports =
  mongoose.models.PaymentGatewayConfig ||
  mongoose.model("PaymentGatewayConfig", paymentGatewayConfigSchema);
