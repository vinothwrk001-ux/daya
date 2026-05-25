const mongoose = require("mongoose");
const { COMMISSION_STATES } = require("../shared/constants");

const influencerWalletSchema = new mongoose.Schema(
  {
    influencerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InfluencerProfile",
      required: true,
      unique: true,
      index: true,
    },
    availableBalance: { type: Number, min: 0, default: 0 },
    pendingBalance: { type: Number, min: 0, default: 0 },
    totalEarnings: { type: Number, min: 0, default: 0 },
    reversedAmount: { type: Number, min: 0, default: 0 },
    withdrawnBalance: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ["active", "inactive", "suspended"], default: "active", index: true },
  },
  {
    timestamps: true,
    collection: "influencer_wallets",
  }
);

const influencerLedgerSchema = new mongoose.Schema(
  {
    influencerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InfluencerProfile",
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["CREDIT", "DEBIT"],
      required: true,
    },
    amount: { type: Number, min: 0, required: true },
    source: {
      type: String,
      enum: ["COMMISSION", "REVERSAL"],
      required: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    balanceAfter: { type: Number, min: 0, required: true },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "influencer_ledgers",
  }
);

influencerLedgerSchema.index({ influencerId: 1, createdAt: -1 });
influencerLedgerSchema.index({ orderId: 1, source: 1 });

const commissionRecordSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    influencerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InfluencerProfile",
      required: true,
      index: true,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    reelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reel",
      required: true,
      index: true,
    },
    trackingSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrackingSession",
      required: true,
      index: true,
    },
    state: {
      type: String,
      enum: COMMISSION_STATES,
      default: "HOLD",
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    holdUntil: { type: Date, required: true, index: true },
    settledAt: { type: Date },
    reversedAt: { type: Date },
    gross: { type: Number, min: 0, required: true },
    platformFee: { type: Number, min: 0, required: true },
    influencerShare: { type: Number, min: 0, required: true },
    vendorNet: { type: Number, min: 0, required: true },
    commissionPercent: { type: Number, min: 0, max: 50, required: true },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "commission_records",
  }
);

module.exports = {
  InfluencerWallet:
    mongoose.models.InfluencerWallet ||
    mongoose.model("InfluencerWallet", influencerWalletSchema),
  InfluencerLedger:
    mongoose.models.InfluencerLedger ||
    mongoose.model("InfluencerLedger", influencerLedgerSchema),
  CommissionRecord:
    mongoose.models.CommissionRecord ||
    mongoose.model("CommissionRecord", commissionRecordSchema),
};
