const { AppError } = require("../utils/AppError");
const { ORDER_STATUS, SHIPPING_STATUS, PICKUP_STATUS } = require("../models/Order");
const { logger } = require("../utils/logger");
const {
  resolveEnabledShippingModes,
  getShippingModesConfig,
  updateShippingModesConfig,
} = require("./shipping-config.service");
const inventoryService = require("./inventory.service");
const Shipment = require("../models/Shipment");

const SHIPPING_MODE = ["SELF", "PLATFORM"];
const TRACKING_ID_PATTERN = /^[A-Z0-9][A-Z0-9\-_/.]{5,39}$/i;

function normalizeShippingMode(value, fallback = "PLATFORM") {
  const mode = String(value || fallback).trim().toUpperCase();
  return SHIPPING_MODE.includes(mode) ? mode : fallback;
}

function sanitizeAllowedModes(modes = []) {
  const normalized = Array.from(new Set((Array.isArray(modes) ? modes : []).map((item) => normalizeShippingMode(item, "")).filter(Boolean)));
  return normalized.length ? normalized : ["PLATFORM"];
}

function validateTrackingId(trackingId) {
  const value = String(trackingId || "").trim();
  if (!value || !TRACKING_ID_PATTERN.test(value)) {
    throw new AppError("Enter a valid tracking ID", 400, "INVALID_TRACKING_ID");
  }
  return value;
}

function validateCourierName(courierName) {
  const value = String(courierName || "").trim();
  if (!value || value.length < 2 || value.length > 80) {
    throw new AppError("Enter a valid courier name", 400, "INVALID_COURIER_NAME");
  }
  return value;
}

function applyShippingLifecycle({ orderStatus, shippingMode, shippingStatus, pickupStatus }) {
  const next = {
    status: orderStatus,
    shippingMode,
    shippingStatus,
    pickupStatus,
  };

  if (shippingStatus === "READY_FOR_PICKUP" && next.status === "Placed") {
    next.status = "Packed";
  }

  if (shippingStatus === "PICKUP_SCHEDULED" && next.status === "Placed") {
    next.status = "Packed";
  }

  if (shippingStatus === "SHIPPED" && !["Shipped", "Out for Delivery", "Delivered"].includes(next.status)) {
    next.status = "Shipped";
  }

  if (shippingStatus === "IN_TRANSIT" && !["Out for Delivery", "Delivered"].includes(next.status)) {
    next.status = "Out for Delivery";
  }

  if (shippingStatus === "OUT_FOR_DELIVERY") {
    next.status = "Out for Delivery";
  }

  if (shippingStatus === "DELIVERED") {
    next.status = "Delivered";
  }

  return next;
}

async function getPlatformShippingState() {
  const config = await getShippingModesConfig();
  return {
    config,
    enabledModes: resolveEnabledShippingModes(config.value),
  };
}

async function submitSelfShipping(order, { trackingId, courierName, trackingUrl, actorId = null }) {
  const validTrackingId = validateTrackingId(trackingId);
  const validCourierName = validateCourierName(courierName);

  if (order.shippingStatus === "SHIPPED" && order.trackingId) {
    throw new AppError("Tracking already submitted for this order", 400, "TRACKING_ALREADY_SUBMITTED");
  }

  order.shippingMode = "SELF";
  order.shippingStatus = "SHIPPED";
  order.pickupStatus = "NOT_REQUESTED";
  order.trackingId = validTrackingId;
  order.courierName = validCourierName;
  if (trackingUrl) {
    order.trackingUrl = String(trackingUrl).trim();
  }
  order.trackingAssignedAt = new Date();
  order.courierAssignedByRole = "ADMIN";
  order.courierAssignedById = actorId;

  const lifecycle = applyShippingLifecycle({
    orderStatus: order.status,
    shippingMode: order.shippingMode,
    shippingStatus: order.shippingStatus,
    pickupStatus: order.pickupStatus,
  });

  order.status = lifecycle.status;
  if (!order.inventoryCommittedAt) {
    await inventoryService.commitOrderInventory(order, {
      shipmentId: order.shipmentId || undefined,
      performedBy: actorId,
    });
  }

  order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
  order.timeline.push({
    status: order.status,
    note: `Tracking submitted. Tracking ID: ${validTrackingId}, Courier: ${validCourierName}`,
    changedAt: new Date(),
  });

  await order.save();
  await Shipment.findOneAndUpdate(
    { orderId: order._id },
    {
      $set: {
        shipmentId: order.shipmentId || validTrackingId,
        shipmentStatus: "SHIPPED",
        courierName: validCourierName,
        trackingId: validTrackingId,
        trackingUrl: order.trackingUrl || "",
        codAmountCollectable: order.paymentMethod === "COD" && order.cod?.status !== "collected" ? Number(order.totalAmount || 0) : 0,
      },
    }
  ).catch(() => {});
  return order;
}

async function requestPlatformShipping(order) {
  const logisticsService = require("./logistics.service");

  if (order.shipmentId || ["READY_FOR_PICKUP", "PICKUP_SCHEDULED", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.shippingStatus)) {
    throw new AppError("Shipment has already been created for this order", 400, "SHIPMENT_ALREADY_CREATED");
  }

  const shipmentPayload = {
    order_id: order.orderNumber,
    order_date: order.createdAt.toISOString().split("T")[0],
    pickup_location: "Primary",
    channel_id: 0,
    billing_customer_name: order.shippingAddress?.fullName || "Customer",
    billing_customer_phone: order.shippingAddress?.phone || "",
    billing_customer_email: order.userId?.email || "",
    billing_customer_address: order.shippingAddress?.line1 || "",
    billing_customer_address_2: order.shippingAddress?.line2 || "",
    billing_customer_city: order.shippingAddress?.city || "",
    billing_customer_state: order.shippingAddress?.state || "",
    billing_customer_country: order.shippingAddress?.country || "India",
    billing_customer_pincode: order.shippingAddress?.postalCode || "",
    shipping_is_billing: true,
    order_items: (order.items || []).map((item) => ({
      name: item.name,
      sku: item.variantSku || item.productId.toString(),
      units: item.quantity,
      selling_price: item.price,
    })),
    payment_method: order.paymentMethod === "COD" ? "COD" : "Prepaid",
    sub_total: order.subtotal,
    length: 10,
    breadth: 10,
    height: 10,
    weight: 0.5,
  };

  const shipmentData = await logisticsService.createPlatformShipment(shipmentPayload);

  order.shippingMode = "PLATFORM";
  order.shippingStatus = "READY_FOR_PICKUP";
  order.pickupStatus = "NOT_REQUESTED";
  order.pickupScheduled = false;
  order.pickupBatchId = "";
  order.shipmentId = shipmentData.shipmentId;
  order.trackingId = shipmentData.trackingId;
  order.courierName = shipmentData.courierName;
  order.trackingUrl = shipmentData.trackingUrl;
  order.logisticsProvider = shipmentData.provider;
  order.logisticsMetadata = shipmentData.raw || {};
  order.pickupRequestedAt = new Date();
  order.courierAssignedByRole = "SYSTEM";

  const lifecycle = applyShippingLifecycle({
    orderStatus: order.status,
    shippingMode: order.shippingMode,
    shippingStatus: order.shippingStatus,
    pickupStatus: order.pickupStatus,
  });

  order.status = lifecycle.status;
  order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
  order.timeline.push({
    status: order.status,
    note: `Platform shipment created. Shipment ID: ${shipmentData.shipmentId}`,
    changedAt: new Date(),
  });

  await order.save();
  await Shipment.findOneAndUpdate(
    { orderId: order._id },
    {
      $set: {
        shipmentId: shipmentData.shipmentId,
        shipmentStatus: "READY",
        courierName: shipmentData.courierName,
        trackingId: shipmentData.trackingId,
        trackingUrl: shipmentData.trackingUrl,
        logisticsProvider: shipmentData.provider,
        codAmountCollectable: order.paymentMethod === "COD" && order.cod?.status !== "collected" ? Number(order.totalAmount || 0) : 0,
        meta: shipmentData.raw || {},
      },
    }
  ).catch(() => {});
  return order;
}

async function processShiprocketWebhook(event) {
  const orderRepo = require("../repositories/order.repository");

  const shipmentId = event.shipment_id;
  if (!shipmentId) return null;

  const order = await orderRepo.findOne({ shipmentId: String(shipmentId) });
  if (!order) {
    logger.webhook("Shiprocket webhook shipment not found", {
      source: "shipping.service",
      event: "shiprocket_shipment_not_found",
      shipmentId: String(shipmentId),
    });
    return null;
  }

  const statusMapping = {
    pending: "PICKUP_SCHEDULED",
    ready_to_ship: "PICKUP_SCHEDULED",
    in_transit: "IN_TRANSIT",
    shipped: "SHIPPED",
    out_for_delivery: "OUT_FOR_DELIVERY",
    delivered: "DELIVERED",
    failed: "FAILED",
    rto_in_transit: "IN_TRANSIT",
    rto_delivered: "DELIVERED",
  };

  const shiprocketStatus = String(event.status || "").toLowerCase();
  const newShippingStatus = statusMapping[shiprocketStatus];

  if (newShippingStatus && newShippingStatus !== order.shippingStatus) {
    const previousShippingStatus = order.shippingStatus;
    order.shippingStatus = newShippingStatus;

    if (newShippingStatus === "PICKUP_SCHEDULED") {
      order.pickupScheduled = true;
      order.pickupStatus = "SCHEDULED";
      order.pickupScheduledAt = new Date();
    } else if (newShippingStatus === "SHIPPED") {
      order.pickupStatus = "COMPLETED";
      order.pickupCompletedAt = new Date();
      order.pickupScheduled = true;
    } else if (newShippingStatus === "FAILED") {
      order.pickupStatus = "FAILED";
    } else if (newShippingStatus === "DELIVERED") {
      order.pickupStatus = "COMPLETED";
      order.deliveredAt = new Date();
      order.pickupScheduled = true;
    }

    const lifecycle = applyShippingLifecycle({
      orderStatus: order.status,
      shippingMode: order.shippingMode,
      shippingStatus: order.shippingStatus,
      pickupStatus: order.pickupStatus,
    });

    order.status = lifecycle.status;
    if (newShippingStatus === "SHIPPED" && previousShippingStatus !== "SHIPPED" && !order.inventoryCommittedAt) {
      await inventoryService.commitOrderInventory(order, {
        shipmentId: order.shipmentId || shipmentId,
      });
    }

    order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
    order.timeline.push({
      status: order.status,
      note: `Shiprocket webhook: ${shiprocketStatus}`,
      changedAt: new Date(),
    });

    await order.save();
    await Shipment.findOneAndUpdate(
      { orderId: order._id },
      {
        $set: {
          shipmentId: order.shipmentId || String(shipmentId),
          shipmentStatus:
            newShippingStatus === "DELIVERED"
              ? "DELIVERED"
              : newShippingStatus === "FAILED"
                ? "FAILED"
                : newShippingStatus === "SHIPPED" || newShippingStatus === "IN_TRANSIT" || newShippingStatus === "OUT_FOR_DELIVERY"
                  ? "SHIPPED"
                  : "READY",
          trackingId: order.trackingId || "",
          trackingUrl: order.trackingUrl || "",
          courierName: order.courierName || "",
          logisticsProvider: order.logisticsProvider || "",
        },
      }
    ).catch(() => {});
  }

  return order;
}

module.exports = {
  ORDER_STATUS,
  SHIPPING_STATUS,
  PICKUP_STATUS,
  normalizeShippingMode,
  sanitizeAllowedModes,
  validateTrackingId,
  validateCourierName,
  applyShippingLifecycle,
  getPlatformShippingState,
  submitSelfShipping,
  requestPlatformShipping,
  processShiprocketWebhook,
  getShippingModesConfig,
  updateShippingModesConfig,
};
