const mongoose = require("mongoose");

const PAYMENT_METHODS = ["ONLINE", "COD"];
const PAYMENT_STATUS = [
  "CREATED",
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
];

const FULFILLMENT_STATUS = ["PENDING", "PROCESSING", "COMPLETED", "FAILED"];

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
    ],
    orderGroupId: {
      type: String,
      index: true,
      trim: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    method: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
      default: "ONLINE",
      index: true,
    },
    status: {
      type: String,
      enum: PAYMENT_STATUS,
      default: "CREATED",
      index: true,
    },
    fulfillmentStatus: {
      type: String,
      enum: FULFILLMENT_STATUS,
      default: "PENDING",
      index: true,
    },
    fulfillmentStartedAt: { type: Date },
    fulfilledAt: { type: Date },
    fulfillmentError: { type: String, trim: true, maxlength: 500 },
    receipt: {
      type: String,
      trim: true,
      index: true,
    },
    razorpayOrderId: { type: String, sparse: true, unique: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    idempotencyKey: {
      type: String,
      trim: true,
      index: true,
    },
    amountBreakdown: {
      subtotal: { type: Number, min: 0, default: 0 },
      shippingFee: { type: Number, min: 0, default: 0 },
      taxAmount: { type: Number, min: 0, default: 0 },
      totalAmount: { type: Number, min: 0, default: 0 },
      paymentMethod: {
        type: String,
        enum: PAYMENT_METHODS,
        default: "ONLINE",
      },
    },
    cartId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cart",
    },
    cartSnapshot: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    shippingAddress: {
      type: mongoose.Schema.Types.Mixed,
    },
    trackingToken: {
      type: String,
      trim: true,
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    webhookEvents: {
      type: [String],
      default: [],
    },
    lastWebhookAt: { type: Date },
    fraudChecks: {
      priceValidated: { type: Boolean, default: true },
      duplicateAttemptCount: { type: Number, min: 0, default: 0 },
      riskScore: { type: Number, min: 0, max: 100, default: 0 },
      flaggedReasons: {
        type: [String],
        default: [],
      },
    },
    refundedAmount: { type: Number, min: 0, default: 0 },
    refundStatus: {
      type: String,
      enum: ["NONE", "PENDING", "PARTIAL", "FULL"],
      default: "NONE",
    },
    paidAt: { type: Date },
    failedAt: { type: Date },
  },
  { timestamps: true }
);

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ method: 1, status: 1, createdAt: -1 });
paymentSchema.index({ orderGroupId: 1, createdAt: -1 });

module.exports = {
  Payment: mongoose.model("Payment", paymentSchema),
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  FULFILLMENT_STATUS,
};
