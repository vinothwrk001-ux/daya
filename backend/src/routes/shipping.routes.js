const express = require("express");
const { authRequired, requireRole } = require("../middleware/auth");
const { requireApprovedVendor } = require("../middleware/vendorApproval");
const shippingController = require("../controllers/shipping.controller");
const { validate } = require("../middleware/validate");
const { body } = require("express-validator");

const router = express.Router();
const vendorAuth = [authRequired, requireRole("vendor"), requireApprovedVendor];

/**
 * ==================== VENDOR ROUTES ====================
 */

// Get available shipping modes for current vendor
router.get("/vendor/modes", vendorAuth, shippingController.getVendorShippingModes);

// Get vendor shipping settings
router.get("/vendor/settings", vendorAuth, shippingController.getVendorShippingSettings);

// Update vendor shipping default mode
router.patch(
  "/vendor/settings",
  vendorAuth,
  validate([
    body("defaultShippingMode")
      .optional()
      .isIn(["SELF", "PLATFORM"])
      .withMessage("Invalid shipping mode"),
  ]),
  shippingController.updateVendorShippingSettings
);

// Submit self-shipping tracking
router.patch(
  "/vendor/orders/:orderId/self",
  vendorAuth,
  validate([
    body("trackingId")
      .trim()
      .notEmpty()
      .withMessage("Tracking ID is required")
      .matches(/^[A-Z0-9][A-Z0-9\-_/.]{5,39}$/i)
      .withMessage("Invalid tracking ID format"),
    body("courierName")
      .trim()
      .notEmpty()
      .withMessage("Courier name is required")
      .isLength({ min: 2, max: 80 })
      .withMessage("Courier name must be 2-80 characters"),
    body("trackingUrl")
      .optional()
      .trim()
      .isURL()
      .withMessage("Invalid tracking URL"),
  ]),
  shippingController.submitSelfShipping
);

// Request platform pickup
router.patch(
  "/vendor/orders/:orderId/platform",
  vendorAuth,
  shippingController.requestPlatformShipping
);

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

// Get vendor shipping modes (admin view)
router.get("/admin/vendors/:vendorId", authRequired, requireRole("admin"), shippingController.getVendorShippingModesAdmin);

// Update vendor allowed shipping modes (admin control)
router.patch(
  "/admin/vendors/:vendorId",
  authRequired,
  requireRole("admin"),
  validate([
    body("allowedShippingModes")
      .optional()
      .isArray()
      .withMessage("allowedShippingModes must be array")
      .custom((arr) => {
        if (arr && arr.every((mode) => ["SELF", "PLATFORM"].includes(mode))) {
          return true;
        }
        throw new Error("Invalid shipping modes");
      }),
    body("defaultShippingMode")
      .optional()
      .isIn(["SELF", "PLATFORM"])
      .withMessage("Invalid default shipping mode"),
  ]),
  shippingController.updateVendorShippingModesAdmin
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
