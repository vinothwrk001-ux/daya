const mongoose = require("mongoose");

const REFUND_STATUS = ["PENDING", "PROCESSING", "PROCESSED", "FAILED", "REJECTED"];

const refundSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      index: true,
    },
    refundId: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
      unique: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
      unique: true,
    },
    amount: { type: Number, required: true, min: 0 },
    deductionAmount: { type: Number, min: 0, default: 0 },
    grossAmount: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: REFUND_STATUS,
      default: "PENDING",
      index: true,
    },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    gateway: {
      type: String,
      enum: ["RAZORPAY", "MANUAL", "WALLET", ""],
      default: "",
    },
    refundMethod: {
      type: String,
      enum: ["RAZORPAY", "MANUAL", "WALLET", ""],
      default: "",
      index: true,
    },
    recommendedRefundMethod: {
      type: String,
      enum: ["RAZORPAY", "MANUAL", "WALLET", ""],
      default: "",
    },
    refundType: {
      type: String,
      enum: ["CANCELLATION", "RETURN", "ADJUSTMENT"],
      default: "CANCELLATION",
      index: true,
    },
    requestedByRole: {
      type: String,
      enum: ["user", "admin", "super_admin", "support_admin", "finance_admin", "staff", "system"],
      default: "system",
    },
    requestedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["ONLINE", "COD"],
      default: "ONLINE",
    },
    attemptCount: { type: Number, min: 0, default: 0 },
    lastAttemptAt: { type: Date },
    retryable: { type: Boolean, default: true },
    retryHistory: {
      type: [
        {
          attemptedAt: { type: Date, default: Date.now },
          status: { type: String, trim: true, default: "" },
          note: { type: String, trim: true, default: "" },
        },
      ],
      default: [],
    },
    approval: {
      status: {
        type: String,
        enum: ["AUTO_APPROVED", "PENDING_REVIEW", "APPROVED", "REJECTED"],
        default: "AUTO_APPROVED",
      },
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      approvedAt: { type: Date },
      rejectionReason: { type: String, trim: true, default: "" },
    },
    breakdown: {
      subtotal: { type: Number, min: 0, default: 0 },
      shipping: { type: Number, min: 0, default: 0 },
      taxes: { type: Number, min: 0, default: 0 },
      couponDiscount: { type: Number, min: 0, default: 0 },
      platformFee: { type: Number, min: 0, default: 0 },
      gatewayFee: { type: Number, min: 0, default: 0 },
      cancellationDeduction: { type: Number, min: 0, default: 0 },
      shippingDeduction: { type: Number, min: 0, default: 0 },
      refundAmount: { type: Number, min: 0, default: 0 },
      lineItems: {
        type: [mongoose.Schema.Types.Mixed],
        default: [],
      },
      deductions: {
        type: [mongoose.Schema.Types.Mixed],
        default: [],
      },
    },
    financeSnapshot: {
      walletTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: "WalletTransaction" },
    },
    manualDetails: {
      transactionReference: { type: String, trim: true, default: "" },
      bankReference: { type: String, trim: true, default: "" },
      notes: { type: String, trim: true, default: "" },
      processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      processedAt: { type: Date },
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    notes: { type: String, trim: true, maxlength: 500 },
    failureReason: { type: String, trim: true, maxlength: 500 },
    processedAt: { type: Date },
    failedAt: { type: Date },
  },
  { timestamps: true }
);

refundSchema.index({ createdAt: -1 });
refundSchema.index({ orderId: 1, refundType: 1, createdAt: -1 });
refundSchema.index({ status: 1, refundMethod: 1, createdAt: -1 });

module.exports = {
  Refund: mongoose.models.Refund || mongoose.model("Refund", refundSchema),
  REFUND_STATUS,
};
