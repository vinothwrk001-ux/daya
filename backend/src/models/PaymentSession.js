const mongoose = require("mongoose");

const PAYMENT_SESSION_STATUS = [
  "CREATED",
  "PENDING",
  "VERIFIED",
  "ORDER_CREATED",
  "FAILED",
  "EXPIRED",
  "REFUND_PENDING",
  "REFUNDED",
];

const paymentSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    paymentRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      index: true,
    },
    razorpayOrderId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    orderGroupId: {
      type: String,
      trim: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["ONLINE"],
      default: "ONLINE",
    },
    currency: {
      type: String,
      trim: true,
      default: "INR",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: PAYMENT_SESSION_STATUS,
      default: "CREATED",
      index: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      required: true,
      index: true,
    },
    cartSnapshot: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    checkoutSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    pricingBreakdown: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    shippingAddress: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    verificationAttempts: {
      type: Number,
      min: 0,
      default: 0,
    },
    lastVerificationAt: { type: Date },
    verifiedAt: { type: Date },
    orderCreatedAt: { type: Date },
    failedAt: { type: Date },
    expiredAt: { type: Date },
    expiresAt: {
      type: Date,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "payment_sessions",
  }
);

paymentSessionSchema.index(
  { userId: 1, status: 1, createdAt: -1 },
  { name: "payment_session_user_status_created_at" }
);
paymentSessionSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    name: "payment_session_ttl",
  }
);

module.exports = {
  PaymentSession:
    mongoose.models.PaymentSession || mongoose.model("PaymentSession", paymentSessionSchema),
  PAYMENT_SESSION_STATUS,
};
