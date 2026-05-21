const mongoose = require("mongoose");

const REVIEW_REPORT_REASONS = [
  "spam",
  "fake_review",
  "abusive_content",
  "wrong_information",
  "harassment",
  "other",
];

const REVIEW_REPORT_STATUS = ["open", "reviewed", "dismissed", "actioned"];

const reviewReportSchema = new mongoose.Schema(
  {
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductReview",
      required: true,
      index: true,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: REVIEW_REPORT_REASONS,
      required: true,
      index: true,
    },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    status: { type: String, enum: REVIEW_REPORT_STATUS, default: "open", index: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "review_reports",
  }
);

reviewReportSchema.index({ reviewId: 1, reportedBy: 1 }, { unique: true });
reviewReportSchema.index({ status: 1, createdAt: -1 });

module.exports = {
  ReviewReport: mongoose.models.ReviewReport || mongoose.model("ReviewReport", reviewReportSchema),
  REVIEW_REPORT_REASONS,
  REVIEW_REPORT_STATUS,
};
