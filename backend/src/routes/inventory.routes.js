const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventory.controller");
const { authRequired } = require("../middleware/auth");

/**
 * Product Inventory Routes
 */

// Get product inventory overview (all variants)
router.get("/product/:productId", authRequired, inventoryController.getProductInventory);

// Get specific variant inventory details
router.get("/product/:productId/variant/:variantId", authRequired, inventoryController.getVariantInventory);

// Get available stock for a variant
router.get("/product/:productId/variant/:variantId/available", authRequired, inventoryController.getAvailableStock);

// Get variant inventory ledger/history
router.get("/product/:productId/variant/:variantId/ledger", authRequired, inventoryController.getVariantLedger);

/**
 * Inventory Adjustment Routes
 */

// Manual stock adjustment
router.post("/product/:productId/variant/:variantId/adjust", authRequired, inventoryController.adjustStock);

// Update threshold
router.patch("/product/:productId/variant/:variantId/threshold", authRequired, inventoryController.updateThreshold);

/**
 * Export Routes (Protected)
 */

// Export product inventory as CSV
router.get("/product/:productId/export/csv", authRequired, inventoryController.exportInventoryCSV);

module.exports = router;
