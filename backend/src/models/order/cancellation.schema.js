const mongoose = require("mongoose");
const { CANCELLATION_WORKFLOW_STATUS } = require("../../constants/order.constants");

const cancellationSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: CANCELLATION_WORKFLOW_STATUS,
      default: "NONE",
      index: true,
    },
    reason: { type: String, trim: true, default: "" },
    requestedAt: { type: Date },
    requestedByRole: { type: String, trim: true, default: "" },
    requestedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    approvedByRole: { type: String, trim: true, default: "" },
    approvedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectedAt: { type: Date },
    rejectedReason: { type: String, trim: true, default: "" },
    currentStageKey: { type: String, trim: true, default: "" },
    policyId: { type: mongoose.Schema.Types.ObjectId, ref: "CancellationPolicy" },
    autoApproved: { type: Boolean, default: false },
    preview: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    idempotencyKey: { type: String, trim: true, default: "" },
    cancellationProcessedAt: { type: Date },
    inventoryRestored: { type: Boolean, default: false },
    inventoryRestoredAt: { type: Date },
    shipmentCancellationAttemptedAt: { type: Date },
    shipmentCancelledAt: { type: Date },
  },
  { _id: false }
);

module.exports = cancellationSchema;
