const mongoose = require("mongoose");
const {
  ORDER_STATUS,
  PAYMENT_STATUS,
  SHIPPING_MODE,
  SHIPPING_STATUS,
  PICKUP_STATUS,
  ORDER_STATUS_NORMALIZED,
  PAYMENT_STATUS_NORMALIZED,
  CANCELLATION_WORKFLOW_STATUS,
  REFUND_WORKFLOW_STATUS,
} = require("../../constants/order.constants");
const { PAYMENT_STATUS: SHARED_PAYMENT_STATUS } = require("../../constants/payment.constants");

const orderItemSchema = require("./orderItem.schema");
const cancellationSchema = require("./cancellation.schema");
const refundSummarySchema = require("./refund.schema");
const codSchema = require("./cod.schema");
const { pricingSnapshotSchema, priceBreakdownSchema } = require("./pricing.schema");
const timelineSchema = require("./timeline.schema");

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    invoiceNumber: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: function(arr) {
          return arr && arr.length > 0;
        },
        message: "Order must have at least one item",
      },
    },
    subtotal: { type: Number, required: true, min: 0, default: 0 },
    shippingFee: { type: Number, min: 0, default: 0 },
    platformFee: { type: Number, min: 0, default: 0 },
    taxAmount: { type: Number, min: 0, default: 0 },
    discountAmount: { type: Number, min: 0, default: 0 },
    chargesBreakdown: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    pricingSnapshot: {
      type: pricingSnapshotSchema,
      default: () => ({}),
    },
    priceBreakdown: {
      type: priceBreakdownSchema,
      default: () => ({}),
    },
    chargesTotal: { type: Number, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0, default: 0 },
    currency: {
      type: String,
      default: "INR",
      enum: ["USD", "EUR", "INR", "GBP"],
    },
    status: {
      type: String,
      enum: ORDER_STATUS,
      default: "Pending",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: SHARED_PAYMENT_STATUS,
      default: "Pending",
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["ONLINE", "COD"],
      default: "ONLINE",
    },
    codAmount: { type: Number, min: 0, default: 0 },
    paymentRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      index: true,
    },
    orderGroupId: {
      type: String,
      trim: true,
      index: true,
    },
    razorpayOrderId: { type: String, trim: true, index: true },
    razorpayPaymentId: { type: String, trim: true, index: true },
    paymentCapturedAt: { type: Date },
    fraudFlags: {
      type: [String],
      default: [],
    },
    deliveryPartner: { type: String, default: "Shiprocket" },
    shippingMode: {
      type: String,
      enum: SHIPPING_MODE,
      default: "SELF",
      index: true,
    },
    shippingStatus: {
      type: String,
      enum: SHIPPING_STATUS,
      default: "NOT_SHIPPED",
      index: true,
    },
    trackingId: { type: String, trim: true },
    trackingUrl: { type: String, trim: true },
    courierName: { type: String, trim: true },
    trackingAssignedAt: { type: Date },
    shippingDate: { type: Date },
    expectedDeliveryDate: { type: Date },
    shippingNotes: { type: String, trim: true },
    whatsappSent: { type: Boolean, default: false, index: true },
    whatsappSentAt: { type: Date },
    shipmentId: { type: String, trim: true, index: true },
    pickupScheduled: { type: Boolean, default: false, index: true },
    pickupBatchId: { type: String, trim: true, index: true },
    pickupRequestedAt: { type: Date },
    pickupScheduledAt: { type: Date },
    pickupCompletedAt: { type: Date },
    pickupStatus: {
      type: String,
      enum: PICKUP_STATUS,
      default: "NOT_REQUESTED",
      index: true,
    },
    logisticsProvider: { type: String, trim: true, default: "SHIPROCKET" },
    pickupAddressSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    shippingAddress: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    billingAddress: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    orderSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    snapshotVersion: {
      type: Number,
      default: 1,
      min: 1,
    },
    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
    cancelReason: { type: String, trim: true },
    inventoryReservedAt: { type: Date },
    inventoryReservationReleasedAt: { type: Date },
    inventoryCommittedAt: { type: Date },
    inventoryRestoredAt: { type: Date },
    notes: { type: String, trim: true },
    refundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Refund",
      index: true,
    },
    cancellation: {
      type: cancellationSchema,
      default: () => ({}),
    },
    refundSummary: {
      type: refundSummarySchema,
      default: () => ({}),
    },
    shipmentRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shipment",
      index: true,
    },
    cod: {
      type: codSchema,
      default: () => ({}),
    },
    returnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReturnRequest",
      index: true,
    },
    timeline: {
      type: [timelineSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "orders",
  }
);

// Indexes for common queries
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, paymentStatus: 1 });
orderSchema.index({ trackingId: 1 });
orderSchema.index({ isActive: 1, status: 1, createdAt: -1 });
orderSchema.index({ "cancellation.status": 1, createdAt: -1 });
orderSchema.index({ "refundSummary.status": 1, createdAt: -1 });

module.exports = {
  Order: mongoose.models.Order || mongoose.model("Order", orderSchema),
  ORDER_STATUS,
  PAYMENT_STATUS: SHARED_PAYMENT_STATUS,
  SHIPPING_MODE,
  SHIPPING_STATUS,
  PICKUP_STATUS,
  ORDER_STATUS_NORMALIZED,
  PAYMENT_STATUS_NORMALIZED,
  CANCELLATION_WORKFLOW_STATUS,
  REFUND_WORKFLOW_STATUS,
};
