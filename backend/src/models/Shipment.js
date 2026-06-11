const mongoose = require("mongoose");

const shipmentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    orderGroupId: {
      type: String,
      trim: true,
      index: true,
    },
    shipmentId: { type: String, trim: true, index: true },
    paymentMethod: {
      type: String,
      enum: ["ONLINE", "COD"],
      default: "ONLINE",
      index: true,
    },
    prepaid: {
      type: Boolean,
      default: true,
      index: true,
    },
    shipmentStatus: {
      type: String,
      enum: ["PENDING", "READY", "PICKUP_REQUESTED", "SHIPPED", "DELIVERED", "FAILED", "CANCELLED", "RETURNED"],
      default: "PENDING",
      index: true,
    },
    shippingMode: {
      type: String,
      enum: ["SELF", "PLATFORM"],
      default: "SELF",
    },
    codAmountCollectable: { type: Number, min: 0, default: 0 },
    courierName: { type: String, trim: true, default: "" },
    trackingId: { type: String, trim: true, default: "" },
    trackingUrl: { type: String, trim: true, default: "" },
    logisticsProvider: { type: String, trim: true, default: "" },
    pickupBatchId: { type: String, trim: true, default: "" },
    shippingAddressSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: "shipments",
  }
);

shipmentSchema.index({ paymentMethod: 1, shipmentStatus: 1, createdAt: -1 });

module.exports = mongoose.models.Shipment || mongoose.model("Shipment", shipmentSchema);
