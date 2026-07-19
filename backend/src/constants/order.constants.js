module.exports = {
  ORDER_STATUS: [
    "Pending",
    "Placed",
    "Packed",
    "Shipped",
    "Out for Delivery",
    "Delivered",
    "Returned",
    "Cancelled"
  ],
  ORDER_STATUS_NORMALIZED: [
    "PLACED",
    "PACKED",
    "SHIPPED",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
    "RETURNED"
  ],
  SHIPPING_MODE: ["SELF", "PLATFORM"],
  SHIPPING_STATUS: [
    "NOT_SHIPPED",
    "READY_FOR_PICKUP",
    "PICKUP_SCHEDULED",
    "SHIPPED",
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "FAILED"
  ],
  PICKUP_STATUS: [
    "NOT_REQUESTED",
    "REQUESTED",
    "SCHEDULED",
    "COMPLETED",
    "FAILED"
  ],
  CANCELLATION_WORKFLOW_STATUS: [
    "NONE",
    "REQUESTED",
    "APPROVED",
    "REJECTED",
    "CANCELLED"
  ],
  REFUND_WORKFLOW_STATUS: [
    "NONE",
    "PENDING",
    "PROCESSING",
    "REFUNDED",
    "FAILED"
  ],
  ORDER_STAGES: [
    "PLACED",
    "CONFIRMED",
    "PACKED",
    "SHIPPED",
    "OUT_FOR_DELIVERY",
    "DELIVERED"
  ]
};
