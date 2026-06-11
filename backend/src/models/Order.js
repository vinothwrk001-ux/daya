const mongoose = require("mongoose");

// NOTE: Keep existing statuses for backward-compatibility with current UI and stored data.
// Admin APIs accept normalized uppercase statuses and map to these stored values.
const ORDER_STATUS = ["Pending", "Placed", "Packed", "Shipped", "Out for Delivery", "Delivered", "Returned", "Cancelled"];
const PAYMENT_STATUS = ["Pending", "Paid", "Failed", "Refunded", "Partially Refunded"];
const SHIPPING_MODE = ["SELF", "PLATFORM"];
const SHIPPING_STATUS = ["NOT_SHIPPED", "READY_FOR_PICKUP", "PICKUP_SCHEDULED", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"];
const PICKUP_STATUS = ["NOT_REQUESTED", "REQUESTED", "SCHEDULED", "COMPLETED", "FAILED"];

const ORDER_STATUS_NORMALIZED = ["PLACED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"];
const PAYMENT_STATUS_NORMALIZED = ["PENDING", "PAID", "FAILED"];
const CANCELLATION_WORKFLOW_STATUS = ["NONE", "REQUESTED", "APPROVED", "REJECTED", "CANCELLED"];
const REFUND_WORKFLOW_STATUS = ["NONE", "PENDING", "PROCESSING", "REFUNDED", "FAILED"];

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    image: { type: String },
    variantId: { type: String, trim: true, default: "" },
    variantSku: { type: String, trim: true, default: "" },
    variantTitle: { type: String, trim: true, default: "" },
    variantAttributes: {
      type: Map,
      of: String,
      default: {},
    },
    weight: {
      value: { type: Number, min: 0 },
      unit: { type: String, trim: true, default: "kg" },
    },
  },
  { _id: false }
);

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
      subtotal: { type: Number, min: 0, default: 0 },
      charges: {
        type: [mongoose.Schema.Types.Mixed],
        default: [],
      },
      chargesTotal: { type: Number, min: 0, default: 0 },
      total: { type: Number, min: 0, default: 0 },
      paymentMethod: {
        type: String,
        enum: ["ONLINE", "COD"],
        default: "ONLINE",
      },
      calculatedAt: { type: Date, default: Date.now },
    },
    priceBreakdown: {
      subtotal: { type: Number, min: 0, default: 0 },
      shippingFee: { type: Number, min: 0, default: 0 },
      codFee: { type: Number, min: 0, default: 0 },
      gatewayFee: { type: Number, min: 0, default: 0 },
      taxAmount: { type: Number, min: 0, default: 0 },
      discountAmount: { type: Number, min: 0, default: 0 },
      chargesTotal: { type: Number, min: 0, default: 0 },
      totalAmount: { type: Number, min: 0, default: 0 },
      currency: { type: String, default: "INR" },
      paymentMethod: {
        type: String,
        enum: ["ONLINE", "COD"],
        default: "ONLINE",
      },
      charges: {
        type: [mongoose.Schema.Types.Mixed],
        default: [],
      },
      calculatedAt: { type: Date, default: Date.now },
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
      enum: PAYMENT_STATUS,
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
      status: {
        type: String,
        enum: CANCELLATION_WORKFLOW_STATUS,
        default: "NONE",
        index: true,
      },
      reason: { type: String, trim: true, default: "" },
      requestedAt: { type: Date },
      requestedByRole: { type: String, trim: true, default: "" },
      requestedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      approvedAt: { type: Date },
      approvedByRole: { type: String, trim: true, default: "" },
      approvedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      rejectedAt: { type: Date },
      rejectedReason: { type: String, trim: true, default: "" },
      currentStageKey: { type: String, trim: true, default: "" },
      policyId: { type: mongoose.Schema.Types.ObjectId, ref: "CancellationPolicy" },
      autoApproved: { type: Boolean, default: false },
      preview: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
      idempotencyKey: { type: String, trim: true, default: "" },
      cancellationProcessedAt: { type: Date },
      inventoryRestored: { type: Boolean, default: false },
      inventoryRestoredAt: { type: Date },
      shipmentCancellationAttemptedAt: { type: Date },
      shipmentCancelledAt: { type: Date },
    },
    refundSummary: {
      status: {
        type: String,
        enum: REFUND_WORKFLOW_STATUS,
        default: "NONE",
        index: true,
      },
      method: {
        type: String,
        enum: ["RAZORPAY", "MANUAL", "WALLET", ""],
        default: "",
      },
      amount: { type: Number, min: 0, default: 0 },
      deductionAmount: { type: Number, min: 0, default: 0 },
      grossAmount: { type: Number, min: 0, default: 0 },
      pendingSince: { type: Date },
      processedAt: { type: Date },
      failedAt: { type: Date },
      lastAttemptAt: { type: Date },
      failureReason: { type: String, trim: true, default: "" },
      retryCount: { type: Number, min: 0, default: 0 },
    },
    shipmentRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shipment",
      index: true,
    },
    cod: {
      isEligible: { type: Boolean, default: false },
      ineligibleReasons: { type: [String], default: [] },
      status: {
        type: String,
        enum: ["pending_cod", "confirmed", "collected", "failed", "cancelled"],
        default: "pending_cod",
      },
      collectedAt: { type: Date },
      collectedBy: { type: String, trim: true, default: "" },
      collectedReference: { type: String, trim: true, default: "" },
      holdUntil: { type: Date },
      lastAuditAt: { type: Date },
    },
    returnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReturnRequest",
      index: true,
    },
    timeline: {
      type: [
        {
          status: { type: String, required: true },
          note: { type: String },
          timestamp: { type: Date, default: Date.now },
        },
      ],
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
  PAYMENT_STATUS,
  SHIPPING_MODE,
  SHIPPING_STATUS,
  PICKUP_STATUS,
  ORDER_STATUS_NORMALIZED,
  PAYMENT_STATUS_NORMALIZED,
  CANCELLATION_WORKFLOW_STATUS,
  REFUND_WORKFLOW_STATUS,
};
