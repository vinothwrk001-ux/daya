const mongoose = require("mongoose");
const { REFUND_WORKFLOW_STATUS } = require("../../constants/order.constants");

const refundSummarySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: REFUND_WORKFLOW_STATUS,
      default: "NONE",
      index: true,
    },
    method: {
      type: String,
      enum: ["RAZORPAY", "MANUAL", "WALLET", ""],
      default: "",
    },
    amount: { type: Number, min: 0, default: 0 },
    deductionAmount: { type: Number, min: 0, default: 0 },
    grossAmount: { type: Number, min: 0, default: 0 },
    pendingSince: { type: Date },
    processedAt: { type: Date },
    failedAt: { type: Date },
    lastAttemptAt: { type: Date },
    failureReason: { type: String, trim: true, default: "" },
    retryCount: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

module.exports = refundSummarySchema;
