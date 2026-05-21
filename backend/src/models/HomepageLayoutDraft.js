const mongoose = require("mongoose");

const draftSchema = new mongoose.Schema(
  {
    layoutDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HomepageLayout",
      required: true,
      unique: true,
      index: true,
    },
    snapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "published", "archived"],
      default: "draft",
      index: true,
    },
    savedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "homepageLayoutDrafts",
  }
);

module.exports = {
  HomepageLayoutDraft:
    mongoose.models.HomepageLayoutDraft ||
    mongoose.model("HomepageLayoutDraft", draftSchema),
};
