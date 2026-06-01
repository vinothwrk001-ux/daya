const express = require("express");
const { adminWorkspaceAuthRequired, requireWorkspacePermission } = require("../middleware/adminAccess");
const { authRequired } = require("../middleware/auth");
const systemController = require("../controllers/system.controller");

const router = express.Router();

router.get(
  "/payment-health",
  adminWorkspaceAuthRequired,
  requireWorkspacePermission("settings.read"),
  systemController.getPaymentHealth
);

router.post(
  "/private-files/sign",
  authRequired,
  systemController.signPrivateFileUrl
);

router.get(
  "/private-files/access/:token",
  systemController.accessPrivateFile
);

module.exports = router;
