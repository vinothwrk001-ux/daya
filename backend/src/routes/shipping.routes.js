const express = require("express");
const { authRequired, requireRole } = require("../middleware/auth");
const shippingController = require("../controllers/shipping.controller");
const { validate } = require("../middleware/validate");
const { body } = require("express-validator");

const router = express.Router();

/**
 * ==================== ADMIN ROUTES ====================
 */

// Get platform shipping modes configuration
router.get("/admin/modes", authRequired, requireRole("admin"), shippingController.getShippingModesConfig);

// Update platform shipping modes configuration (feature flags)
router.patch(
  "/admin/modes",
  authRequired,
  requireRole("admin"),
  validate([
    body("selfShipping")
      .isBoolean()
      .withMessage("selfShipping must be boolean"),
    body("platformShipping")
      .isBoolean()
      .withMessage("platformShipping must be boolean"),
  ]),
  shippingController.saveShippingModesConfig
);

// Override shipping mode for an order
router.patch(
  "/admin/orders/:orderId/mode",
  authRequired,
  requireRole("admin"),
  validate([
    body("shippingMode")
      .isIn(["SELF", "PLATFORM"])
      .withMessage("Invalid shipping mode"),
  ]),
  shippingController.overrideShippingMode
);

// Update order shipping status
router.patch(
  "/admin/orders/:orderId/status",
  authRequired,
  requireRole("admin"),
  validate([
    body("shippingStatus")
      .optional()
      .isIn(["NOT_SHIPPED", "READY_FOR_PICKUP", "PICKUP_SCHEDULED", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"])
      .withMessage("Invalid shipping status"),
    body("pickupStatus")
      .optional()
      .isIn(["NOT_REQUESTED", "REQUESTED", "SCHEDULED", "COMPLETED", "FAILED"])
      .withMessage("Invalid pickup status"),
    body("trackingId")
      .optional()
      .trim(),
    body("courierName")
      .optional()
      .trim(),
  ]),
  shippingController.updateOrderShippingStatus
);

/**
 * ==================== PUBLIC/USER ROUTES ====================
 */

// Get order tracking (user accessible)
router.get("/orders/:orderId/tracking", authRequired, shippingController.getOrderTracking);

/**
 * ==================== WEBHOOKS ====================
 */

// Shiprocket webhook handler (no auth, signature verification recommended)
router.post("/webhooks/shiprocket", shippingController.handleShiprocketWebhook);

module.exports = router;
