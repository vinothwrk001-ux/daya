const mongoose = require("mongoose");

const fraudAlertSchema = new mongoose.Schema(
  {
    alertType: {
      type: String,
      enum: [
        "SELF_ATTRIBUTION",
        "REPEATED_CLICKS",
        "CONVERSION_SPIKE",
        "DUPLICATE_WITHDRAWAL",
        "ABNORMAL_COMMISSION",
        "BLACKLISTED_ACCOUNT",
        "KYC_MISMATCH",
        "SUSPICIOUS_TRACKING",
      ],
      required: true,
      index: true,
    },
    severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "LOW", index: true },
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", index: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", index: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", index: true },
    trackingSessionId: { type: mongoose.Schema.Types.ObjectId, ref: "TrackingSession", index: true },
    evidence: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["OPEN", "UNDER_REVIEW", "SAFE", "ESCALATED", "RESOLVED"], default: "OPEN", index: true },
    notes: { type: String, trim: true, maxlength: 2000, default: "" },
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "influencer_commerce_fraud_alerts" }
);

const reportScheduleSchema = new mongoose.Schema(
  {
    reportType: {
      type: String,
      enum: ["campaigns", "influencers", "vendors", "revenue", "commissions", "settlements", "withdrawals", "content", "conversions", "fraud"],
      required: true,
      index: true,
    },
    frequency: { type: String, enum: ["daily", "weekly", "monthly"], required: true, index: true },
    format: { type: String, enum: ["csv", "excel", "pdf"], default: "csv" },
    recipients: { type: [String], default: [] },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
    enabled: { type: Boolean, default: true, index: true },
    lastRunAt: { type: Date },
    nextRunAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  },
  { timestamps: true, collection: "influencer_commerce_report_schedules" }
);

fraudAlertSchema.index({ status: 1, severity: 1, createdAt: -1 });
reportScheduleSchema.index({ enabled: 1, nextRunAt: 1 });

module.exports = {
  InfluencerCommerceFraudAlert:
    mongoose.models.InfluencerCommerceFraudAlert ||
    mongoose.model("InfluencerCommerceFraudAlert", fraudAlertSchema),
  InfluencerCommerceReportSchedule:
    mongoose.models.InfluencerCommerceReportSchedule ||
    mongoose.model("InfluencerCommerceReportSchedule", reportScheduleSchema),
};
