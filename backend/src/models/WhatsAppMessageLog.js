const mongoose = require("mongoose");

const MESSAGE_TYPES = ["shipment", "delivered", "order_confirmation"];
const MESSAGE_STATUSES = ["Queued", "Sent", "Delivered", "Read", "Failed", "Retrying"];

const whatsAppMessageLogSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      required: true,
      index: true,
    },
    messageType: {
      type: String,
      enum: MESSAGE_TYPES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: MESSAGE_STATUSES,
      default: "Queued",
      index: true,
    },
    twilioSid: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    response: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    messageBody: {
      type: String,
      trim: true,
      default: "",
    },
    retryCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    maxRetries: {
      type: Number,
      min: 0,
      default: 5,
    },
    nextRetryAt: {
      type: Date,
      index: true,
    },
    lastError: {
      type: String,
      trim: true,
      default: "",
    },
    sentAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    readAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: "whatsapp_message_logs",
  }
);

whatsAppMessageLogSchema.index({ createdAt: -1 });
whatsAppMessageLogSchema.index({ status: 1, nextRetryAt: 1 });

module.exports = {
  WhatsAppMessageLog:
    mongoose.models.WhatsAppMessageLog || mongoose.model("WhatsAppMessageLog", whatsAppMessageLogSchema),
  WHATSAPP_MESSAGE_TYPES: MESSAGE_TYPES,
  WHATSAPP_MESSAGE_STATUSES: MESSAGE_STATUSES,
};
