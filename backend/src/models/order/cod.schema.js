const mongoose = require("mongoose");

const codSchema = new mongoose.Schema(
  {
    isEligible: { type: Boolean, default: false },
    ineligibleReasons: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["pending_cod", "confirmed", "collected", "failed", "cancelled"],
      default: "pending_cod",
    },
    collectedAt: { type: Date },
    collectedBy: { type: String, trim: true, default: "" },
    collectedReference: { type: String, trim: true, default: "" },
    holdUntil: { type: Date },
    lastAuditAt: { type: Date },
  },
  { _id: false }
);

module.exports = codSchema;
