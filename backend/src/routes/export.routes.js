const express = require("express");
const { authRequired, requireRole } = require("../middleware/auth");
const { requireApprovedVendor } = require("../middleware/vendorApproval");
const exportController = require("../controllers/export.controller");

const router = express.Router();

router.get(
  "/",
  authRequired,
  requireRole("admin", "super_admin", "support_admin", "finance_admin", "vendor"),
  requireApprovedVendor,
  exportController.downloadReport
);

module.exports = router;
