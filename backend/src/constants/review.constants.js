module.exports = {
  REVIEW_STATUS: ["pending", "approved", "rejected", "hidden", "deleted"],
  REVIEW_RECOMMENDATION: ["yes", "no", null],
  REVIEW_REPORT_REASONS: [
    "inappropriate",
    "spam",
    "fake",
    "offensive",
    "other"
  ],
  REVIEW_REPORT_STATUS: ["open", "reviewed", "dismissed", "actioned"],
  REVIEW_VOTE_TYPES: ["helpful", "not_helpful"]
};
