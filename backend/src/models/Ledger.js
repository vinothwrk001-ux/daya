const mongoose = require("mongoose");

const LEDGER_TYPES = ["CREDIT", "DEBIT"];
const LEDGER_SOURCES = [
  "ORDER",
  "PAYOUT",
  "REFUND",
  "PAYOUT_REQUEST",
  "PAYOUT_REJECTION",
  "COD_SETTLEMENT",
  "COD_REVERSAL",
  "COD_FEE",
  "GATEWAY_FEE",
  "REFUND_REVERSAL",
];

const ledgerSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: LEDGER_TYPES,
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    source: {
      type: String,
      enum: LEDGER_SOURCES,
      required: true,
      index: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      index: true,
    },
    balanceAfter: { type: Number, required: true, min: 0 },
    walletSnapshot: {
      totalEarnings: { type: Number, required: true, min: 0 },
      availableBalance: { type: Number, required: true, min: 0 },
      pendingBalance: { type: Number, required: true, min: 0 },
      withdrawnAmount: { type: Number, required: true, min: 0 },
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    codFee: { type: Number, min: 0, default: 0 },
    gatewayFee: { type: Number, min: 0, default: 0 },
    refundRef: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    settlementRef: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
  },
  { timestamps: true }
);

ledgerSchema.index({ vendorId: 1, createdAt: -1 });
ledgerSchema.index({ vendorId: 1, source: 1, createdAt: -1 });

module.exports = {
  Ledger: mongoose.model("Ledger", ledgerSchema),
  LEDGER_TYPES,
  LEDGER_SOURCES,
};
