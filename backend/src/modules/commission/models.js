const mongoose = require("mongoose");
const { COMMISSION_STATES } = require("../shared/constants");

const RULE_TYPES = [
  "global",
  "category",
  "product",
  "campaign",
  "influencer",
  "traffic_source",
  "performance",
  "affiliate",
  "custom_formula",
];

const COMMISSION_METHODS = [
  "percentage",
  "fixed",
  "hybrid",
  "tiered",
  "performance_bonus",
  "revenue_share",
  "custom_formula",
];

const RULE_STATUSES = ["draft", "pending_approval", "active", "inactive", "expired", "rejected", "archived"];
const LEDGER_STATES = ["PENDING", "APPROVED", "SETTLED", "PAID", "REVERSED"];
const LEDGER_ENTRY_TYPES = ["COMMISSION", "PERFORMANCE_BONUS", "CAMPAIGN_BONUS", "MANUAL_ADJUSTMENT", "REVERSAL", "PENALTY", "REFUND_ADJUSTMENT"];
const TRAFFIC_SOURCES = ["reels", "posts", "stories", "livestream", "storefront", "collection", "affiliate_link", "campaign_landing_page", "creator_feed"];

const moneyField = { type: Number, min: 0, default: 0 };

const commissionRuleConditionSchema = new mongoose.Schema(
  {
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerCommissionRule", required: true, index: true },
    field: { type: String, required: true, trim: true, maxlength: 120 },
    operator: {
      type: String,
      enum: ["eq", "ne", "in", "nin", "gt", "gte", "lt", "lte", "exists", "between"],
      default: "eq",
    },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    valueTo: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true, collection: "commission_rule_conditions" }
);

const commissionRuleVersionSchema = new mongoose.Schema(
  {
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerCommissionRule", required: true, index: true },
    version: { type: Number, required: true, min: 1 },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, enum: RULE_STATUSES, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    changeReason: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  { timestamps: true, collection: "commission_rule_versions" }
);

commissionRuleVersionSchema.index({ ruleId: 1, version: -1 }, { unique: true });

const commissionRuleSchema = new mongoose.Schema(
  {
    ruleName: { type: String, required: true, trim: true, maxlength: 180 },
    ruleCode: { type: String, required: true, trim: true, uppercase: true, maxlength: 80, unique: true, index: true },
    ruleType: { type: String, enum: RULE_TYPES, required: true, index: true },
    priority: { type: Number, min: 0, default: 0, index: true },
    commissionMethod: { type: String, enum: COMMISSION_METHODS, required: true, index: true },
    commissionValue: moneyField,
    fixedAmount: moneyField,
    revenueSharePercent: { type: Number, min: 0, max: 100, default: 0 },
    tiers: { type: [mongoose.Schema.Types.Mixed], default: [] },
    bonuses: { type: [mongoose.Schema.Types.Mixed], default: [] },
    customFormula: { type: String, trim: true, maxlength: 2000, default: "" },
    effectiveDate: { type: Date, required: true, index: true },
    expiryDate: { type: Date, index: true },
    status: { type: String, enum: RULE_STATUSES, default: "draft", index: true },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    version: { type: Number, min: 1, default: 1 },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", index: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", index: true },
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", index: true },
    affiliateId: { type: mongoose.Schema.Types.ObjectId, ref: "AffiliateLink", index: true },
    trafficSource: { type: String, enum: TRAFFIC_SOURCES, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "influencer_commission_rules" }
);

commissionRuleSchema.index({ status: 1, ruleType: 1, priority: -1, effectiveDate: 1, expiryDate: 1 });
commissionRuleSchema.index({ productId: 1, campaignId: 1, influencerId: 1, categoryId: 1, trafficSource: 1 });

const commissionSnapshotSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true, index: true },
    orderNumber: { type: String, trim: true, index: true },
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", required: true, index: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", index: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", index: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", index: true },
    appliedRuleId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerCommissionRule", required: true, index: true },
    appliedRuleVersion: { type: Number, required: true, min: 1 },
    trafficSource: { type: String, trim: true, index: true },
    commissionPercent: { type: Number, min: 0, max: 100, default: 0 },
    commissionAmount: moneyField,
    bonusAmount: moneyField,
    finalEarnings: moneyField,
    eligibleRevenue: moneyField,
    grossSale: moneyField,
    refunds: moneyField,
    discounts: moneyField,
    platformAdjustments: moneyField,
    calculation: { type: mongoose.Schema.Types.Mixed, default: {} },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true, collection: "commission_snapshots" }
);

const commissionLedgerSchema = new mongoose.Schema(
  {
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", index: true },
    snapshotId: { type: mongoose.Schema.Types.ObjectId, ref: "CommissionSnapshot", index: true },
    settlementId: { type: mongoose.Schema.Types.ObjectId, ref: "CommissionSettlement", index: true },
    payoutBatchId: { type: mongoose.Schema.Types.ObjectId, ref: "CommissionPayoutBatch", index: true },
    entryType: { type: String, enum: LEDGER_ENTRY_TYPES, required: true, index: true },
    direction: { type: String, enum: ["CREDIT", "DEBIT"], required: true },
    amount: { type: Number, min: 0, required: true },
    state: { type: String, enum: LEDGER_STATES, default: "PENDING", index: true },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    reference: { type: String, trim: true, maxlength: 160, default: "" },
    reason: { type: String, trim: true, maxlength: 1000, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "commission_ledgers" }
);

commissionLedgerSchema.index({ influencerId: 1, state: 1, createdAt: -1 });
commissionLedgerSchema.index({ orderId: 1, entryType: 1 });

const commissionAdjustmentSchema = new mongoose.Schema(
  {
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", required: true, index: true },
    ledgerId: { type: mongoose.Schema.Types.ObjectId, ref: "CommissionLedger", index: true },
    amount: { type: Number, min: 0, required: true },
    direction: { type: String, enum: ["CREDIT", "DEBIT"], required: true },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING", index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
  },
  { timestamps: true, collection: "commission_adjustments" }
);

const commissionReversalSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", required: true, index: true },
    snapshotId: { type: mongoose.Schema.Types.ObjectId, ref: "CommissionSnapshot", index: true },
    ledgerId: { type: mongoose.Schema.Types.ObjectId, ref: "CommissionLedger", index: true },
    amount: { type: Number, min: 0, required: true },
    reason: { type: String, enum: ["REFUND", "RETURN", "CHARGEBACK", "FRAUD", "CAMPAIGN_VIOLATION", "MANUAL"], required: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "commission_reversals" }
);

const commissionSettlementSchema = new mongoose.Schema(
  {
    cycle: { type: String, enum: ["daily", "weekly", "bi_weekly", "monthly"], required: true, index: true },
    status: { type: String, enum: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "QUEUED_FOR_PAYOUT", "SETTLED", "CANCELLED"], default: "DRAFT", index: true },
    periodStart: { type: Date, required: true, index: true },
    periodEnd: { type: Date, required: true, index: true },
    totalAmount: moneyField,
    entryCount: { type: Number, min: 0, default: 0 },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "commission_settlements" }
);

const commissionPayoutBatchSchema = new mongoose.Schema(
  {
    settlementId: { type: mongoose.Schema.Types.ObjectId, ref: "CommissionSettlement", index: true },
    status: { type: String, enum: ["DRAFT", "READY", "PROCESSING", "PAID", "FAILED", "CANCELLED"], default: "DRAFT", index: true },
    totalAmount: moneyField,
    influencerCount: { type: Number, min: 0, default: 0 },
    entries: { type: [mongoose.Schema.Types.Mixed], default: [] },
    gateway: { type: String, trim: true, maxlength: 80, default: "manual" },
    releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    releasedAt: { type: Date },
  },
  { timestamps: true, collection: "commission_payout_batches" }
);

const commissionAuditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true, index: true },
    entityType: { type: String, required: true, trim: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    userRole: { type: String, trim: true, maxlength: 80, default: "" },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    reason: { type: String, trim: true, maxlength: 1000, default: "" },
    ipAddress: { type: String, trim: true, maxlength: 80, default: "" },
    userAgent: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true, collection: "commission_audit_logs" }
);

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
      index: true,
    },
    reelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reel",
      index: true,
    },
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InfluencerPost",
      index: true,
    },
    storefrontId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InfluencerStorefront",
      index: true,
    },
    collectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InfluencerCollection",
      index: true,
    },
    surface: { type: String, trim: true, index: true },
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
  InfluencerCommissionRule:
    mongoose.models.InfluencerCommissionRule ||
    mongoose.model("InfluencerCommissionRule", commissionRuleSchema),
  CommissionRuleVersion:
    mongoose.models.CommissionRuleVersion ||
    mongoose.model("CommissionRuleVersion", commissionRuleVersionSchema),
  CommissionRuleCondition:
    mongoose.models.CommissionRuleCondition ||
    mongoose.model("CommissionRuleCondition", commissionRuleConditionSchema),
  CommissionSnapshot:
    mongoose.models.CommissionSnapshot ||
    mongoose.model("CommissionSnapshot", commissionSnapshotSchema),
  CommissionLedger:
    mongoose.models.CommissionLedger ||
    mongoose.model("CommissionLedger", commissionLedgerSchema),
  CommissionAdjustment:
    mongoose.models.CommissionAdjustment ||
    mongoose.model("CommissionAdjustment", commissionAdjustmentSchema),
  CommissionReversal:
    mongoose.models.CommissionReversal ||
    mongoose.model("CommissionReversal", commissionReversalSchema),
  CommissionSettlement:
    mongoose.models.CommissionSettlement ||
    mongoose.model("CommissionSettlement", commissionSettlementSchema),
  CommissionPayoutBatch:
    mongoose.models.CommissionPayoutBatch ||
    mongoose.model("CommissionPayoutBatch", commissionPayoutBatchSchema),
  CommissionAuditLog:
    mongoose.models.CommissionAuditLog ||
    mongoose.model("CommissionAuditLog", commissionAuditLogSchema),
  RULE_TYPES,
  COMMISSION_METHODS,
  RULE_STATUSES,
  LEDGER_STATES,
  LEDGER_ENTRY_TYPES,
  TRAFFIC_SOURCES,
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
