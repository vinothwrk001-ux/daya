const mongoose = require("mongoose");

const WEBHOOK_STATUS = ["RECEIVED", "PROCESSED", "IGNORED", "FAILED"];

const webhookEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["RAZORPAY", "SHIPROCKET", "LOGISTICS"],
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    eventId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    providerEventId: { type: String, trim: true, index: true, default: "" },
    payloadHash: { type: String, trim: true, index: true, default: "" },
    receivedAt: { type: Date, default: Date.now, index: true },
    signatureVerified: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: WEBHOOK_STATUS,
      default: "RECEIVED",
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    relatedPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    errorMessage: { type: String, trim: true, maxlength: 500 },
    processedAt: { type: Date },
  },
  { timestamps: true }
);

webhookEventSchema.index({ provider: 1, createdAt: -1 });

module.exports = {
  WebhookEvent: mongoose.model("WebhookEvent", webhookEventSchema),
  WEBHOOK_STATUS,
};
