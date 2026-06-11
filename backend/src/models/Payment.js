const mongoose = require("mongoose");

const PAYMENT_METHODS = ["ONLINE", "COD"];
const PAYMENT_STATUS = [
  "CREATED",
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "FAILED",
  "REFUND_PENDING",
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
    paymentSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentSession",
      index: true,
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
    razorpayOrderId: { type: String, trim: true },
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
      codFee: { type: Number, min: 0, default: 0 },
      gatewayFee: { type: Number, min: 0, default: 0 },
      prepaidDiscount: { type: Number, min: 0, default: 0 },
      taxAmount: { type: Number, min: 0, default: 0 },
      totalAmount: { type: Number, min: 0, default: 0 },
      paymentMethod: {
        type: String,
        enum: PAYMENT_METHODS,
        default: "ONLINE",
      },
    },
    codDetails: {
      status: {
        type: String,
        enum: ["pending_cod", "confirmed", "collected", "failed", "cancelled"],
        default: "pending_cod",
      },
      collectedAt: { type: Date },
      collectedAmount: { type: Number, min: 0, default: 0 },
      collectedBy: { type: String, trim: true, default: "" },
      collectionReference: { type: String, trim: true, default: "" },
      eligibilitySnapshot: {
        codAvailable: { type: Boolean, default: false },
        reasons: { type: [String], default: [] },
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
    gatewayFeeAmount: { type: Number, min: 0, default: 0 },
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
paymentSchema.index(
  { razorpayOrderId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      method: "ONLINE",
      razorpayOrderId: { $type: "string" },
    },
  }
);
paymentSchema.index(
  { razorpayPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      method: "ONLINE",
      razorpayPaymentId: { $type: "string" },
    },
  }
);

paymentSchema.pre("validate", function normalizeGatewayFields() {
  if (this.razorpayOrderId !== undefined && this.razorpayOrderId !== null) {
    const normalizedOrderId = String(this.razorpayOrderId).trim();
    this.razorpayOrderId = normalizedOrderId || undefined;
  }

  if (this.razorpayPaymentId !== undefined && this.razorpayPaymentId !== null) {
    const normalizedPaymentId = String(this.razorpayPaymentId).trim();
    this.razorpayPaymentId = normalizedPaymentId || undefined;
  }

  if (this.razorpaySignature !== undefined && this.razorpaySignature !== null) {
    const normalizedSignature = String(this.razorpaySignature).trim();
    this.razorpaySignature = normalizedSignature || undefined;
  }

  if (this.method === "COD") {
    this.razorpayOrderId = undefined;
    this.razorpayPaymentId = undefined;
    this.razorpaySignature = undefined;
  }
});

async function ensurePaymentIndexes() {
  const PaymentModel = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);
  const indexes = await PaymentModel.collection.indexes();
  const razorpayOrderIndex = indexes.find((index) => index.name === "razorpayOrderId_1");

  const hasExpectedPartialIndex = Boolean(
    razorpayOrderIndex?.unique &&
      razorpayOrderIndex?.partialFilterExpression?.method === "ONLINE" &&
      razorpayOrderIndex?.partialFilterExpression?.razorpayOrderId?.$type === "string"
  );

  if (!hasExpectedPartialIndex && razorpayOrderIndex) {
    await PaymentModel.collection.dropIndex("razorpayOrderId_1").catch(() => {});
  }

  await PaymentModel.syncIndexes();
}

module.exports = {
  Payment: mongoose.model("Payment", paymentSchema),
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  FULFILLMENT_STATUS,
  ensurePaymentIndexes,
};
