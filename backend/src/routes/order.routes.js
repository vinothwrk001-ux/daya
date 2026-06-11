const express = require("express");
const { authRequired, requireRole } = require("../middleware/auth");
const { requireApprovedVendor } = require("../middleware/vendorApproval");
const orderController = require("../controllers/order.controller");

const router = express.Router();

router.use(authRequired);

// User flows
router.post("/create", orderController.create);
router.get("/user", orderController.listUser);

// Seller/Admin flows
router.get("/seller/me", requireRole("vendor", "admin"), requireApprovedVendor, orderController.listSeller);
router.patch("/:id/status", requireRole("vendor", "admin"), requireApprovedVendor, orderController.updateStatus);

// Per-order routes (keep after more specific prefixes)
router.get("/:id", orderController.getById);
router.get("/:id/track", orderController.track);
router.post("/:id/cancel", express.json(), orderController.cancel);
router.patch("/:id/cancel", orderController.cancel);
router.patch("/:id/return", orderController.requestReturn);

module.exports = router;

