const mongoose = require("mongoose");

const vendorOrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
      index: true,
    },
    orderGroupId: {
      type: String,
      trim: true,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["ONLINE", "COD"],
      default: "ONLINE",
      index: true,
    },
    paymentStatus: {
      type: String,
      trim: true,
      default: "Pending",
    },
    subtotal: { type: Number, min: 0, default: 0 },
    totalAmount: { type: Number, min: 0, default: 0 },
    codAmount: { type: Number, min: 0, default: 0 },
    shipmentId: { type: String, trim: true, default: "" },
    settlementStatus: {
      type: String,
      enum: ["NOT_APPLICABLE", "PENDING_COLLECTION", "COLLECTED", "ON_HOLD", "SETTLED", "REVERSED", "CANCELLED"],
      default: "NOT_APPLICABLE",
      index: true,
    },
    vendorSettlementStatus: {
      type: String,
      enum: ["NOT_APPLICABLE", "PENDING_COLLECTION", "COLLECTED", "ON_HOLD", "SETTLED", "REVERSED", "CANCELLED"],
      default: "NOT_APPLICABLE",
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "vendor_orders",
  }
);

vendorOrderSchema.index({ vendorId: 1, settlementStatus: 1, createdAt: -1 });
vendorOrderSchema.index({ orderGroupId: 1, vendorId: 1 });

module.exports = mongoose.models.VendorOrder || mongoose.model("VendorOrder", vendorOrderSchema);
