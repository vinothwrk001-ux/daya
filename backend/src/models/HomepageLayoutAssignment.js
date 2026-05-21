const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema(
  {
    layoutDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HomepageLayout",
      required: true,
      index: true,
    },
    layoutId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    assignedContainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HomepageContainer",
      required: true,
      index: true,
    },
    sortOrder: { type: Number, default: 0, index: true },
    desktop: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    tablet: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    mobile: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "homepageLayoutAssignments",
  }
);

assignmentSchema.index({ layoutDocumentId: 1, layoutId: 1 }, { unique: true });

module.exports = {
  HomepageLayoutAssignment:
    mongoose.models.HomepageLayoutAssignment ||
    mongoose.model("HomepageLayoutAssignment", assignmentSchema),
};
