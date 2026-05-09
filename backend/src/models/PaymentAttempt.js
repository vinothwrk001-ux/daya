const mongoose = require("mongoose");

const PAYMENT_ATTEMPT_STATUS = ["CREATED", "FAILED", "SUCCESS", "VERIFIED"];

const paymentAttemptSchema = new mongoose.Schema(
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
      trim: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    status: {
      type: String,
      enum: PAYMENT_ATTEMPT_STATUS,
      required: true,
      index: true,
    },
    stage: {
      type: String,
      trim: true,
      default: "",
    },
    message: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    requestPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    responsePayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, collection: "payment_attempts" }
);

paymentAttemptSchema.index({ razorpayOrderId: 1, createdAt: -1 });
paymentAttemptSchema.index({ razorpayPaymentId: 1, createdAt: -1 });

module.exports = {
  PaymentAttempt:
    mongoose.models.PaymentAttempt || mongoose.model("PaymentAttempt", paymentAttemptSchema),
  PAYMENT_ATTEMPT_STATUS,
};
