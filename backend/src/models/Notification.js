const mongoose = require("mongoose");

const NOTIFICATION_ROLES = ["ADMIN", "STAFF"];
const NOTIFICATION_MODULES = ["MANAGEMENT", "FINANCE", "GROWTH", "MARKETING", "WORKSPACE"];
const NOTIFICATION_SUBMODULES = [
  "ORDERS",
  "DELIVERY",
  "PRODUCTS",
  "INVENTORY",
  "RETURNS",
  "PAYMENTS",
  "REVIEWS",
  "USERS",
  "SETTINGS",
  "SUPPORT",
];
const NOTIFICATION_TYPES = [
  "ORDER_CREATED",
  "ORDER_STATUS_CHANGED",
  "ORDER_CANCELLED",
  "RETURN_REQUEST",
  "RETURN_STATUS_CHANGED",
  "REFUND_INITIATED",
  "REFUND_COMPLETED",
  "REFUND_FAILED",
  "INVENTORY_ALERT",
  "PRODUCT_UPDATED",
  "SYSTEM_ALERT",
];

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: NOTIFICATION_ROLES,
      required: true,
      index: true,
    },
    module: {
      type: String,
      enum: NOTIFICATION_MODULES,
      required: true,
      index: true,
    },
    subModule: {
      type: String,
      enum: NOTIFICATION_SUBMODULES,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    referenceId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, role: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, role: 1, module: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, role: 1, subModule: 1, isRead: 1, createdAt: -1 });

module.exports = {
  Notification: mongoose.model("Notification", notificationSchema),
  NOTIFICATION_ROLES,
  NOTIFICATION_MODULES,
  NOTIFICATION_SUBMODULES,
  NOTIFICATION_TYPES,
};
