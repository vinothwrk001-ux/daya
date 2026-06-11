const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const shippingService = require("../services/shipping.service");
const orderRepo = require("../repositories/order.repository");
const inventoryService = require("../services/inventory.service");
const { logger } = require("../utils/logger");

const getShippingModesConfig = asyncHandler(async (req, res) => {
  const config = await shippingService.getShippingModesConfig();
  return ok(res, config.value, "Shipping modes configuration retrieved");
});

const saveShippingModesConfig = asyncHandler(async (req, res) => {
  const { selfShipping, platformShipping } = req.body;

  if (typeof selfShipping !== "boolean" || typeof platformShipping !== "boolean") {
    throw new AppError("Both selfShipping and platformShipping must be boolean", 400, "VALIDATION_ERROR");
  }

  const updated = await shippingService.updateShippingModesConfig({
    selfShipping,
    platformShipping,
    updatedBy: req.user?._id || req.user?.sub,
  });

  return ok(res, updated, "Shipping modes configuration updated");
});

const overrideShippingMode = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { shippingMode } = req.body;

  const order = await orderRepo.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404, "NOT_FOUND");
  }

  if (!["SELF", "PLATFORM"].includes(shippingMode)) {
    throw new AppError("Invalid shipping mode", 400, "VALIDATION_ERROR");
  }

  order.shippingMode = shippingMode;
  if (shippingMode === "SELF" && !String(order.shippingStatus || "").includes("SHIPPED")) {
    order.shippingStatus = "NOT_SHIPPED";
    order.pickupStatus = "NOT_REQUESTED";
  } else if (shippingMode === "PLATFORM" && !["READY_FOR_PICKUP", "PICKUP_SCHEDULED"].includes(order.shippingStatus)) {
    order.shippingStatus = "READY_FOR_PICKUP";
    order.pickupStatus = "NOT_REQUESTED";
  }

  await order.save();

  return ok(res, order, "Shipping mode overridden");
});

const updateOrderShippingStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { shippingStatus, pickupStatus, trackingId, courierName, trackingUrl } = req.body;

  const order = await orderRepo.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404, "NOT_FOUND");
  }

  if (shippingStatus && !["NOT_SHIPPED", "READY_FOR_PICKUP", "PICKUP_SCHEDULED", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"].includes(shippingStatus)) {
    throw new AppError("Invalid shipping status", 400, "VALIDATION_ERROR");
  }

  if (pickupStatus && !["NOT_REQUESTED", "REQUESTED", "SCHEDULED", "COMPLETED", "FAILED"].includes(pickupStatus)) {
    throw new AppError("Invalid pickup status", 400, "VALIDATION_ERROR");
  }

  if (shippingStatus) order.shippingStatus = shippingStatus;
  if (pickupStatus) order.pickupStatus = pickupStatus;
  if (trackingId) order.trackingId = trackingId;
  if (courierName) order.courierName = courierName;
  if (trackingUrl) order.trackingUrl = trackingUrl;

  const lifecycle = shippingService.applyShippingLifecycle({
    orderStatus: order.status,
    shippingMode: order.shippingMode,
    shippingStatus: order.shippingStatus,
    pickupStatus: order.pickupStatus,
  });

  order.status = lifecycle.status;
  if (order.shippingStatus === "SHIPPED" && !order.inventoryCommittedAt) {
    await inventoryService.commitOrderInventory(order, {
      shipmentId: order.shipmentId || undefined,
      performedBy: req.user?._id || req.user?.sub,
    });
  }
  if (order.shippingStatus === "DELIVERED") {
    order.deliveredAt = order.deliveredAt || new Date();
  }

  order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
  order.timeline.push({
    status: order.status,
    note: `Shipping status updated by admin: ${shippingStatus || order.shippingStatus}`,
    changedAt: new Date(),
  });

  await order.save();

  return ok(res, order, "Shipping status updated");
});

const getOrderTracking = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await orderRepo.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404, "NOT_FOUND");
  }

  const tracking = {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    shippingMode: order.shippingMode,
    shippingStatus: order.shippingStatus,
    pickupStatus: order.pickupStatus,
    courierName: order.courierName,
    trackingId: order.trackingId,
    trackingUrl: order.trackingUrl,
    shipmentId: order.shipmentId,
    deliveryStatus: order.deliveryStatus,
    deliveredAt: order.deliveredAt,
    timeline: order.timeline || [],
  };

  return ok(res, tracking, "Tracking information retrieved");
});

const handleShiprocketWebhook = asyncHandler(async (req, res) => {
  const event = req.body;

  if (!event || !event.shipment_id) {
    return ok(res, { received: true }, "Webhook received");
  }

  try {
    const updated = await shippingService.processShiprocketWebhook(event);
    return ok(res, { processed: true, orderId: updated?._id }, "Webhook processed");
  } catch (error) {
    logger.webhook("Shiprocket webhook processing failed", {
      source: "shipping.controller",
      event: "shiprocket_webhook_failed",
      error,
    });
    return ok(res, { received: true, error: error.message }, "Webhook received with error");
  }
});

module.exports = {
  getShippingModesConfig,
  saveShippingModesConfig,
  overrideShippingMode,
  updateOrderShippingStatus,
  getOrderTracking,
  handleShiprocketWebhook,
};
