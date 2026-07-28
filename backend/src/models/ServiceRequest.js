const mongoose = require("mongoose");

const serviceRequestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    projectDetails: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "completed"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster querying in admin panel
serviceRequestSchema.index({ status: 1 });
serviceRequestSchema.index({ createdAt: -1 });

const ServiceRequest = mongoose.model("ServiceRequest", serviceRequestSchema);

module.exports = ServiceRequest;
