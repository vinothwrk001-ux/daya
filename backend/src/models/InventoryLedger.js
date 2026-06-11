const mongoose = require("mongoose");

const TRANSACTION_TYPES = ["RESTOCK", "SALE", "RETURN", "MANUAL_ADJUSTMENT", "CANCELLATION", "RESERVED", "UNRESERVED"];
const TRANSACTION_STATUS = ["PENDING", "COMPLETED", "FAILED", "REVERSED"];

const inventoryLedgerSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    variantId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    variantSku: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    // Transaction Details
    transactionType: {
      type: String,
      enum: TRANSACTION_TYPES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: TRANSACTION_STATUS,
      default: "COMPLETED",
      index: true,
    },
    
    // Quantity Changes
    quantityChange: {
      type: Number,
      required: true,
    },
    stockBefore: {
      type: Number,
      required: true,
      min: 0,
    },
    stockAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    reservedBefore: {
      type: Number,
      default: 0,
      min: 0,
    },
    reservedAfter: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // Reference Information
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      index: true,
    },
    shipmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shipment",
      index: true,
    },
    returnId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    
    // Notes & Metadata
    reason: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    
    // User tracking
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
  },
  { timestamps: true }
);

// Compound indexes for common queries
inventoryLedgerSchema.index({ productId: 1, variantId: 1, createdAt: -1 });
inventoryLedgerSchema.index({ transactionType: 1, createdAt: -1 });
inventoryLedgerSchema.index({ orderId: 1, transactionType: 1 });

module.exports = {
  InventoryLedger: mongoose.model("InventoryLedger", inventoryLedgerSchema),
  TRANSACTION_TYPES,
  TRANSACTION_STATUS,
};
