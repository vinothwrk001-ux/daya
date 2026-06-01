const express = require("express");
const { adminWorkspaceAuthRequired, requireWorkspacePermission } = require("../middleware/adminAccess");
const systemController = require("../controllers/system.controller");

const router = express.Router();

router.get(
  "/payment-health",
  adminWorkspaceAuthRequired,
  requireWorkspacePermission("settings.read"),
  systemController.getPaymentHealth
);

module.exports = router;
