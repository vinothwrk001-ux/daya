const express = require("express");
const vendorModuleController = require("../controllers/vendorModule.controller");
const {
  adminWorkspaceAuthRequired,
  requireLegacyAdminPermission,
} = require("../middleware/adminAccess");
const { authRequired, requireRole } = require("../middleware/auth");
const { requireApprovedVendor } = require("../middleware/vendorApproval");

const router = express.Router();

/**
 * 📍 /api/modules
 * Module Management Routes
 */

// Public vendor routes
router.get("/vendor/accessible", authRequired, requireRole("vendor"), requireApprovedVendor, vendorModuleController.getVendorAccessibleModules);
router.post("/vendor/check", authRequired, requireRole("vendor"), requireApprovedVendor, vendorModuleController.checkVendorModuleAccess);

// Admin routes
router.get(
  "/",
  adminWorkspaceAuthRequired,
  requireLegacyAdminPermission("dashboard:read"),
  vendorModuleController.getAllModules
);
router.get(
  "/stats/overview",
  adminWorkspaceAuthRequired,
  requireLegacyAdminPermission("dashboard:read"),
  vendorModuleController.getModuleStats
);
router.get(
  "/:key",
  adminWorkspaceAuthRequired,
  requireLegacyAdminPermission("dashboard:read"),
  vendorModuleController.getModuleByKey
);
router.patch(
  "/:key",
  adminWorkspaceAuthRequired,
  requireLegacyAdminPermission("dashboard:read"),
  vendorModuleController.updateVendorModuleSettings
);

// 🔥 CRITICAL: Vendor access control
router.patch(
  "/:key/vendor-access",
  adminWorkspaceAuthRequired,
  requireLegacyAdminPermission("dashboard:read"),
  vendorModuleController.updateModuleVendorAccess
);

// Global status update
router.patch(
  "/:key/status",
  adminWorkspaceAuthRequired,
  requireLegacyAdminPermission("dashboard:read"),
  vendorModuleController.updateModuleGlobalStatus
);

// Initialize modules (run once during setup)
router.post(
  "/init",
  adminWorkspaceAuthRequired,
  requireLegacyAdminPermission("dashboard:read"),
  vendorModuleController.initializeModules
);

module.exports = router;
