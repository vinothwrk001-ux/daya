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
      enum: ["COMMISSION", "REVERSAL", "WITHDRAWAL", "WITHDRAWAL_REVERSAL", "BONUS", "REFERRAL", "ADJUSTMENT", "CAMPAIGN"],
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

const influencerPayoutAccountSchema = new mongoose.Schema(
  {
    influencerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InfluencerProfile",
      required: true,
      index: true,
    },
    accountHolderName: { type: String, trim: true, maxlength: 160, default: "" },
    accountNumberEncrypted: { type: String, maxlength: 500, default: "" },
    ifscCode: { type: String, trim: true, maxlength: 20, default: "" },
    bankName: { type: String, trim: true, maxlength: 160, default: "" },
    upiIdEncrypted: { type: String, maxlength: 500, default: "" },
    paypalEmail: { type: String, trim: true, maxlength: 160, default: "" },
    paymentMethod: {
      type: String,
      enum: ["bank_transfer", "upi", "paypal", "stripe_connect", "wise", "manual"],
      default: "bank_transfer",
      index: true,
    },
    isDefault: { type: Boolean, default: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    isVerified: { type: Boolean, default: false, index: true },
    verificationStatus: {
      type: String,
      enum: ["PENDING", "VERIFIED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    verifiedAt: { type: Date },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectionReason: { type: String, trim: true, maxlength: 500, default: "" },
    version: { type: Number, default: 1 },
    previousVersions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    updateReason: { type: String, trim: true, maxlength: 500, default: "" },
  },
  {
    timestamps: true,
    collection: "influencer_payout_accounts",
  }
);

influencerPayoutAccountSchema.index({ influencerId: 1, isActive: 1, createdAt: -1 });
influencerPayoutAccountSchema.index({ influencerId: 1, isDefault: 1 });

const influencerWithdrawalRequestSchema = new mongoose.Schema(
  {
    influencerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InfluencerProfile",
      required: true,
      index: true,
    },
    payoutAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InfluencerPayoutAccount",
      index: true,
    },
    amount: { type: Number, min: 0, required: true },
    paymentMethod: {
      type: String,
      enum: ["bank_transfer", "upi", "paypal", "stripe_connect", "wise", "manual"],
      default: "bank_transfer",
    },
    status: {
      type: String,
      enum: ["DRAFT", "PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "PROCESSING", "PAID", "FAILED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    requestedAt: { type: Date, default: Date.now, index: true },
    expectedProcessingAt: { type: Date },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    processedAt: { type: Date },
    referenceNumber: { type: String, trim: true, maxlength: 120, default: "" },
    remarks: { type: String, trim: true, maxlength: 1000, default: "" },
    adminNote: { type: String, trim: true, maxlength: 1000, default: "" },
    rejectionReason: { type: String, trim: true, maxlength: 1000, default: "" },
    gatewayResponse: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: "influencer_withdrawal_requests",
  }
);

influencerWithdrawalRequestSchema.index({ influencerId: 1, status: 1, requestedAt: -1 });

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
  InfluencerPayoutAccount:
    mongoose.models.InfluencerPayoutAccount ||
    mongoose.model("InfluencerPayoutAccount", influencerPayoutAccountSchema),
  InfluencerWithdrawalRequest:
    mongoose.models.InfluencerWithdrawalRequest ||
    mongoose.model("InfluencerWithdrawalRequest", influencerWithdrawalRequestSchema),
};
