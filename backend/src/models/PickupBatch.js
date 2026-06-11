const mongoose = require("mongoose");

const PICKUP_BATCH_STATUS = ["SCHEDULED"];

const pickupBatchSchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    shipmentIds: {
      type: [String],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "Pickup batch must contain at least one shipment",
      },
    },
    totalShipments: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: PICKUP_BATCH_STATUS,
      default: "SCHEDULED",
      index: true,
    },
    scheduledAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    pickupDate: { type: Date },
    courier: { type: String, trim: true, default: "" },
    idempotencyKey: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
      unique: true,
    },
    logisticsMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    scheduledByRole: {
      type: String,
      enum: ["ADMIN", "SYSTEM"],
      default: "ADMIN",
    },
    scheduledById: {
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  { timestamps: true }
);

pickupBatchSchema.index({ scheduledAt: -1 });
pickupBatchSchema.index({ status: 1, scheduledAt: -1 });

module.exports = {
  PickupBatch: mongoose.model("PickupBatch", pickupBatchSchema),
  PICKUP_BATCH_STATUS,
};
