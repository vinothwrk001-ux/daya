const express = require("express");
const router = express.Router();
const configController = require("../controllers/config.controller");
const { authRequired, requireRole } = require("../middleware/auth");

// All configuration routes require admin authentication.
// Platform default initialization is CLI-only: npm run bootstrap:platform.
router.use(authRequired);
router.use(requireRole("admin", "super_admin", "support_admin", "finance_admin"));

/**
 * GET /api/config
 * Get all platform configurations
 */
router.get("/", configController.getAllConfigs);

/**
 * PATCH /api/config/batch/update
 * Batch update multiple configurations
 */
router.patch("/batch/update", configController.batchUpdateConfigs);

/**
 * GET /api/config/category/:category
 * Get configurations by category
 */
router.get("/category/:category", configController.getConfigsByCategory);

/**
 * GET /api/config/:key
 * Get configuration by key
 */
router.get("/:key", configController.getConfigByKey);

/**
 * PATCH /api/config/:key
 * Update single configuration
 */
router.patch("/:key", configController.updateConfig);

module.exports = router;
