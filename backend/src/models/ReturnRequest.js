const mongoose = require("mongoose");

const RETURN_REQUEST_STATUS = ["REQUESTED", "APPROVED", "REJECTED", "REFUNDED"];

const returnRequestSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: RETURN_REQUEST_STATUS,
      default: "REQUESTED",
      index: true,
    },
    resolutionNote: { type: String, trim: true, maxlength: 1000 },
    refundAmount: { type: Number, min: 0, default: 0 },
    requestedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

returnRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = {
  ReturnRequest: mongoose.model("ReturnRequest", returnRequestSchema),
  RETURN_REQUEST_STATUS,
};
