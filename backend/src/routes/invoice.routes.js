const express = require("express");
const { authRequired, requireRole } = require("../middleware/auth");
const { adminWorkspaceAuthRequired, requireWorkspacePermission } = require("../middleware/adminAccess");
const { upload } = require("../middleware/upload");
const { validate } = require("../middleware/validate");
const invoiceController = require("../controllers/invoice.controller");
const { invoiceSettingsSchema, invoiceMetadataSchema } = require("../utils/validators/invoice.validation");

const router = express.Router();

router.get("/settings", adminWorkspaceAuthRequired, requireWorkspacePermission("settings.read"), invoiceController.getSettings);
router.put(
  "/settings",
  adminWorkspaceAuthRequired,
  requireWorkspacePermission("settings.update"),
  upload.fields([{ name: "logo", maxCount: 1 }, { name: "signature", maxCount: 1 }]),
  validate(invoiceSettingsSchema),
  invoiceController.updateSettings
);

router.get("/admin/orders", adminWorkspaceAuthRequired, requireWorkspacePermission("orders.read"), invoiceController.listAdminInvoices);
router.get("/admin/orders/:orderId", adminWorkspaceAuthRequired, requireWorkspacePermission("orders.read"), invoiceController.getAdminInvoice);
router.put(
  "/admin/orders/:orderId/metadata",
  adminWorkspaceAuthRequired,
  requireWorkspacePermission("orders.update"),
  validate(invoiceMetadataSchema),
  invoiceController.updateInvoiceMetadata
);
router.get("/admin/orders/:orderId/audit", adminWorkspaceAuthRequired, requireWorkspacePermission("orders.read"), invoiceController.getInvoiceAuditHistory);
router.get("/admin/orders/:orderId/pdf", adminWorkspaceAuthRequired, requireWorkspacePermission("orders.read"), invoiceController.downloadAdminInvoice);

router.get("/user/orders/:orderId", authRequired, requireRole("user"), invoiceController.getUserInvoice);
router.get("/user/orders/:orderId/pdf", authRequired, requireRole("user"), invoiceController.downloadUserInvoice);

module.exports = router;
