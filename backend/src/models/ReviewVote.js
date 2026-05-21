const mongoose = require("mongoose");

const REVIEW_VOTE_TYPES = ["helpful", "not_helpful"];

const reviewVoteSchema = new mongoose.Schema(
  {
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductReview",
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    voteType: {
      type: String,
      enum: REVIEW_VOTE_TYPES,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "review_votes",
  }
);

reviewVoteSchema.index({ reviewId: 1, customerId: 1 }, { unique: true });

module.exports = {
  ReviewVote: mongoose.models.ReviewVote || mongoose.model("ReviewVote", reviewVoteSchema),
  REVIEW_VOTE_TYPES,
};
