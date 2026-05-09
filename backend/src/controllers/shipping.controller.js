const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const shippingService = require("../services/shipping.service");
const logisticsService = require("../services/logistics.service");
const orderService = require("../services/order.service");
const vendorRepo = require("../repositories/vendor.repository");
const orderRepo = require("../repositories/order.repository");
const inventoryService = require("../services/inventory.service");

/**
 * ==================== VENDOR SHIPPING ENDPOINTS ====================
 */

/**
 * Get available shipping modes for a vendor
 * GET /api/vendor/shipping/modes
 */
const getVendorShippingModes = asyncHandler(async (req, res) => {
  const vendor = await vendorRepo.findByUserId(req.user.sub);
  if (!vendor) {
    throw new AppError("Vendor not found", 404, "NOT_FOUND");
  }

  const modes = await shippingService.resolveVendorShippingModes(vendor);
  return ok(res, modes, "Shipping modes retrieved");
});

/**
 * Submit self-shipping tracking for an order
 * PATCH /api/vendor/orders/:orderId/shipping/self
 * Body: { trackingId, courierName, trackingUrl? }
 */
const submitSelfShipping = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { trackingId, courierName, trackingUrl } = req.body;

  // Get order and validate vendor ownership
  const order = await orderRepo.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404, "NOT_FOUND");
  }

  if (order.sellerId.toString() !== req.user.sub) {
    throw new AppError("Unauthorized: Order does not belong to this vendor", 403, "FORBIDDEN");
  }

  // Validate shipping mode is allowed and enabled
  const vendor = await vendorRepo.findByUserId(req.user.sub);
  if (!vendor) {
    throw new AppError("Vendor not found", 404, "NOT_FOUND");
  }

  const modeValidation = await shippingService.assertVendorCanUseShippingMode(vendor, "SELF");

  // Update order with self-shipping info
  const updatedOrder = await shippingService.submitSelfShipping(order, {
    trackingId,
    courierName,
    trackingUrl,
    vendorId: vendor._id,
  });

  return ok(res, updatedOrder, "Self-shipping submitted successfully");
});

/**
 * Create platform shipment for an order
 * PATCH /api/vendor/orders/:orderId/shipping/platform
 * Body: { shippingMode, etc }
 */
const requestPlatformShipping = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  // Get order and validate vendor ownership
  const order = await orderRepo.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404, "NOT_FOUND");
  }

  if (order.sellerId.toString() !== req.user.sub) {
    throw new AppError("Unauthorized: Order does not belong to this vendor", 403, "FORBIDDEN");
  }

  // Validate shipping mode is allowed and enabled
  const vendor = await vendorRepo.findByUserId(req.user.sub);
  if (!vendor) {
    throw new AppError("Vendor not found", 404, "NOT_FOUND");
  }

  await shippingService.assertVendorCanUseShippingMode(vendor, "PLATFORM");

  // Request platform shipment via logistics service
  const updatedOrder = await shippingService.requestPlatformShipping(order, vendor);

  return ok(res, updatedOrder, "Platform shipment created successfully");
});

/**
 * Get vendor's shipping settings
 * GET /api/vendor/shipping/settings
 */
const getVendorShippingSettings = asyncHandler(async (req, res) => {
  const vendor = await vendorRepo.findByUserId(req.user.sub);
  if (!vendor) {
    throw new AppError("Vendor not found", 404, "NOT_FOUND");
  }

  const settings = {
    allowedShippingModes: vendor.shippingSettings?.allowedShippingModes || ["SELF"],
    defaultShippingMode: vendor.shippingSettings?.defaultShippingMode || "SELF",
    preferredPickupLocation: vendor.shippingSettings?.preferredPickupLocation || "Primary",
    platformShippingEnabledAt: vendor.shippingSettings?.platformShippingEnabledAt,
    selfShippingEnabledAt: vendor.shippingSettings?.selfShippingEnabledAt,
  };

  return ok(res, settings, "Shipping settings retrieved");
});

/**
 * Update vendor shipping default mode
 * PATCH /api/vendor/shipping/settings
 * Body: { defaultShippingMode: "SELF" | "PLATFORM" }
 */
const updateVendorShippingSettings = asyncHandler(async (req, res) => {
  const { defaultShippingMode } = req.body;

  const vendor = await vendorRepo.findByUserId(req.user.sub);
  if (!vendor) {
    throw new AppError("Vendor not found", 404, "NOT_FOUND");
  }

  // Validate mode is allowed for vendor
  const modeValidation = await shippingService.assertVendorCanUseShippingMode(vendor, defaultShippingMode);

  vendor.shippingSettings = vendor.shippingSettings || {};
  vendor.shippingSettings.defaultShippingMode = modeValidation.mode;

  await vendor.save();

  return ok(res, vendor.shippingSettings, "Shipping settings updated");
});

/**
 * ==================== ADMIN SHIPPING ENDPOINTS ====================
 */

/**
 * Get platform shipping modes configuration
 * GET /api/admin/shipping/modes
 */
const getShippingModesConfig = asyncHandler(async (req, res) => {
  const config = await shippingService.getShippingModesConfig();
  return ok(res, config.value, "Shipping modes configuration retrieved");
});

/**
 * Update platform shipping modes configuration (feature flag)
 * PATCH /api/admin/shipping/modes
 * Body: { selfShipping: true/false, platformShipping: true/false }
 */
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

/**
 * Override order shipping mode (admin only)
 * PATCH /api/admin/orders/:orderId/shipping/mode
 * Body: { shippingMode: "SELF" | "PLATFORM" }
 */
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
  if (shippingMode === "SELF" && !order.shippingStatus.includes("SHIPPED")) {
    order.shippingStatus = "NOT_SHIPPED";
    order.pickupStatus = "NOT_REQUESTED";
  } else if (shippingMode === "PLATFORM" && !["READY_FOR_PICKUP", "PICKUP_SCHEDULED"].includes(order.shippingStatus)) {
    order.shippingStatus = "READY_FOR_PICKUP";
    order.pickupStatus = "NOT_REQUESTED";
  }

  await order.save();

  return ok(res, order, "Shipping mode overridden");
});

/**
 * Update order shipping status (admin override)
 * PATCH /api/admin/orders/:orderId/shipping/status
 * Body: { shippingStatus: "...", pickupStatus?: "...", trackingId?: "..." }
 */
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

  // Update order
  if (shippingStatus) order.shippingStatus = shippingStatus;
  if (pickupStatus) order.pickupStatus = pickupStatus;
  if (trackingId) order.trackingId = trackingId;
  if (courierName) order.courierName = courierName;
  if (trackingUrl) order.trackingUrl = trackingUrl;

  // Apply order status lifecycle
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

  // Add to timeline
  if (order.timeline) {
    order.timeline.push({
      status: order.status,
      note: `Shipping status updated by admin: ${shippingStatus}`,
      changedAt: new Date(),
    });
  }

  await order.save();

  return ok(res, order, "Shipping status updated");
});

/**
 * Get shipping modes for a specific vendor (admin view)
 * GET /api/admin/vendors/:vendorId/shipping
 */
const getVendorShippingModesAdmin = asyncHandler(async (req, res) => {
  const { vendorId } = req.params;

  const vendor = await vendorRepo.findById(vendorId);
  if (!vendor) {
    throw new AppError("Vendor not found", 404, "NOT_FOUND");
  }

  const modes = await shippingService.resolveVendorShippingModes(vendor);
  return ok(res, modes, "Vendor shipping modes retrieved");
});

/**
 * Update vendor's allowed shipping modes (admin control)
 * PATCH /api/admin/vendors/:vendorId/shipping
 * Body: { allowedShippingModes: ["SELF", "PLATFORM"], defaultShippingMode: "SELF" }
 */
const updateVendorShippingModesAdmin = asyncHandler(async (req, res) => {
  const { vendorId } = req.params;
  const { allowedShippingModes, defaultShippingMode } = req.body;

  const vendor = await vendorRepo.findById(vendorId);
  if (!vendor) {
    throw new AppError("Vendor not found", 404, "NOT_FOUND");
  }

  vendor.shippingSettings = vendor.shippingSettings || {};

  const payload = {};
  if (allowedShippingModes !== undefined) {
    payload.allowedShippingModes = allowedShippingModes;
  }
  if (defaultShippingMode !== undefined) {
    payload.defaultShippingMode = defaultShippingMode;
  }

  const modes = await shippingService.resolveVendorShippingModes(vendor);
  const updated = shippingService.buildVendorShippingSettingsPayload(payload, modes);

  Object.assign(vendor.shippingSettings, updated);
  await vendor.save();

  return ok(res, vendor.shippingSettings, "Vendor shipping modes updated");
});

/**
 * ==================== TRACKING & WEBHOOKS ====================
 */

/**
 * Get order tracking information (user accessible)
 * GET /api/orders/:orderId/tracking
 */
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

/**
 * Handle Shiprocket webhook events
 * POST /api/webhooks/shiprocket
 */
const handleShiprocketWebhook = asyncHandler(async (req, res) => {
  const event = req.body;

  if (!event || !event.shipment_id) {
    return ok(res, { received: true }, "Webhook received");
  }

  try {
    const updated = await shippingService.processShiprocketWebhook(event);
    return ok(res, { processed: true, orderId: updated?._id }, "Webhook processed");
  } catch (error) {
    // Log error but don't fail webhook (Shiprocket expects 200)
    console.error("Shiprocket webhook processing error:", error.message);
    return ok(res, { received: true, error: error.message }, "Webhook received with error");
  }
});

module.exports = {
  // Vendor endpoints
  getVendorShippingModes,
  submitSelfShipping,
  requestPlatformShipping,
  getVendorShippingSettings,
  updateVendorShippingSettings,

  // Admin endpoints
  getShippingModesConfig,
  saveShippingModesConfig,
  overrideShippingMode,
  updateOrderShippingStatus,
  getVendorShippingModesAdmin,
  updateVendorShippingModesAdmin,

  // Tracking & webhooks
  getOrderTracking,
  handleShiprocketWebhook,
};
