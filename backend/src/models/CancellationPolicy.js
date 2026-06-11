const mongoose = require("mongoose");

const ORDER_STAGES = ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
const PAYMENT_METHODS = ["COD", "RAZORPAY"];
const REFUND_METHODS = ["RAZORPAY", "MANUAL", "WALLET"];

const deductionSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      enum: ["CANCELLATION_CHARGE"],
      default: undefined,
    },
    type: {
      type: String,
      enum: ["FIXED", "PERCENTAGE", "SHIPPING", "GATEWAY_FEE", "PLATFORM_ADJUSTMENT"],
      required: true,
    },
    label: { type: String, trim: true, required: true },
    value: { type: Number, min: 0, default: 0 },
    enabled: { type: Boolean, default: true },
    capAmount: { type: Number, min: 0, default: null },
  },
  { _id: false }
);

const stageRuleSchema = new mongoose.Schema(
  {
    stage: {
      type: String,
      enum: ORDER_STAGES,
      required: true,
    },
    cancellationEnabled: { type: Boolean, default: true },
    refundEnabled: { type: Boolean, default: true },
    autoApproval: { type: Boolean, default: true },
    manualApproval: { type: Boolean, default: false },
    allowPartialRefund: { type: Boolean, default: true },
    refundSlaHours: { type: Number, min: 0, default: 72 },
    cancellationChargeType: {
      type: String,
      enum: ["NONE", "FIXED", "PERCENTAGE"],
      default: "NONE",
    },
    cancellationChargeValue: { type: Number, min: 0, default: 0 },
    deductions: {
      type: [deductionSchema],
      default: [],
    },
  },
  { _id: false }
);

const paymentMethodConfigSchema = new mongoose.Schema(
  {
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
    },
    cancellationEnabled: { type: Boolean, default: true },
    refundEnabled: { type: Boolean, default: true },
    autoRefundEnabled: { type: Boolean, default: false },
    manualRefundEnabled: { type: Boolean, default: true },
    walletRefundEnabled: { type: Boolean, default: false },
    allowedRefundMethods: {
      type: [String],
      enum: REFUND_METHODS,
      default: [],
    },
  },
  { _id: false }
);

const cancellationPolicySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    priority: {
      type: Number,
      default: 100,
      min: 0,
    },
    featureFlags: {
      codCancellationEnabled: { type: Boolean, default: true },
      razorpayCancellationEnabled: { type: Boolean, default: true },
      codRefundEnabled: { type: Boolean, default: false },
      razorpayRefundEnabled: { type: Boolean, default: true },
      manualRefundEnabled: { type: Boolean, default: true },
      walletRefundEnabled: { type: Boolean, default: true },
      autoRefundEnabled: { type: Boolean, default: true },
      partialRefundEnabled: { type: Boolean, default: true },
      stageBasedCancellationEnabled: { type: Boolean, default: true },
    },
    paymentMethodConfigs: {
      type: [paymentMethodConfigSchema],
      default: [
        {
          paymentMethod: "COD",
          cancellationEnabled: true,
          refundEnabled: false,
          autoRefundEnabled: false,
          manualRefundEnabled: true,
          walletRefundEnabled: true,
          allowedRefundMethods: ["MANUAL", "WALLET"],
        },
        {
          paymentMethod: "RAZORPAY",
          cancellationEnabled: true,
          refundEnabled: true,
          autoRefundEnabled: true,
          manualRefundEnabled: true,
          walletRefundEnabled: true,
          allowedRefundMethods: ["RAZORPAY", "MANUAL", "WALLET"],
        },
      ],
    },
    stages: {
      type: [stageRuleSchema],
      default: [
        { stage: "PLACED", cancellationEnabled: true, refundEnabled: true, autoApproval: true, manualApproval: false, allowPartialRefund: true, refundSlaHours: 24, cancellationChargeType: "NONE", cancellationChargeValue: 0, deductions: [] },
        { stage: "CONFIRMED", cancellationEnabled: true, refundEnabled: true, autoApproval: true, manualApproval: false, allowPartialRefund: true, refundSlaHours: 24, cancellationChargeType: "NONE", cancellationChargeValue: 0, deductions: [] },
        { stage: "PACKED", cancellationEnabled: true, refundEnabled: true, autoApproval: false, manualApproval: true, allowPartialRefund: true, refundSlaHours: 48, cancellationChargeType: "PERCENTAGE", cancellationChargeValue: 2, deductions: [{ code: "CANCELLATION_CHARGE", type: "PERCENTAGE", label: "Cancellation charge", value: 2, enabled: true }] },
        { stage: "SHIPPED", cancellationEnabled: true, refundEnabled: true, autoApproval: false, manualApproval: true, allowPartialRefund: true, refundSlaHours: 72, cancellationChargeType: "NONE", cancellationChargeValue: 0, deductions: [{ type: "SHIPPING", label: "Shipping recovery", value: 100, enabled: true }, { type: "GATEWAY_FEE", label: "Gateway recovery", value: 0, enabled: true }] },
        { stage: "OUT_FOR_DELIVERY", cancellationEnabled: true, refundEnabled: true, autoApproval: false, manualApproval: true, allowPartialRefund: true, refundSlaHours: 96, cancellationChargeType: "PERCENTAGE", cancellationChargeValue: 5, deductions: [{ code: "CANCELLATION_CHARGE", type: "PERCENTAGE", label: "Cancellation charge", value: 5, enabled: true }, { type: "SHIPPING", label: "Shipping recovery", value: 100, enabled: true }] },
        { stage: "DELIVERED", cancellationEnabled: false, refundEnabled: false, autoApproval: false, manualApproval: false, allowPartialRefund: false, refundSlaHours: 0, cancellationChargeType: "NONE", cancellationChargeValue: 0, deductions: [] },
      ],
    },
    defaultRefundMethod: {
      type: String,
      enum: REFUND_METHODS,
      default: "RAZORPAY",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "cancellation_policies",
  }
);

cancellationPolicySchema.index({ isActive: 1, priority: 1, updatedAt: -1 });

module.exports = {
  CancellationPolicy:
    mongoose.models.CancellationPolicy || mongoose.model("CancellationPolicy", cancellationPolicySchema),
  ORDER_STAGES,
  PAYMENT_METHODS,
  REFUND_METHODS,
};
