const express = require("express");
const { authRequired, requireRole } = require("../middleware/auth");
const exportController = require("../controllers/export.controller");

const router = express.Router();

router.get(
  "/",
  authRequired,
  requireRole("admin", "super_admin", "support_admin", "finance_admin"),
  exportController.downloadReport
);

module.exports = router;
