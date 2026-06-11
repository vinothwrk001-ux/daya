const mongoose = require("mongoose");

const adminNotificationSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "product_approval",
        "order_alert",
        "payment_alert",
        "system_alert",
        "report",
      ],
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      trim: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
      index: true,
    },
    actionUrl: {
      type: String,
      trim: true,
    },
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    relatedEntityType: {
      type: String,
      enum: ["product", "order", "user", "payment"],
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Compound index for efficient queries
adminNotificationSchema.index({ adminId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("AdminNotification", adminNotificationSchema);
