const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const invoiceService = require("../services/invoice.service");

function getMeta(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  };
}

const getSettings = asyncHandler(async (req, res) => ok(res, await invoiceService.getSettings(), "Invoice settings loaded"));
const updateSettings = asyncHandler(async (req, res) =>
  ok(res, await invoiceService.updateSettings(req.body || {}, req.files || {}, req.user, getMeta(req)), "Invoice settings updated")
);
const listAdminInvoices = asyncHandler(async (req, res) => ok(res, await invoiceService.listAdminInvoices(req.query), "Invoices loaded"));
const getAdminInvoice = asyncHandler(async (req, res) => ok(res, await invoiceService.getAdminInvoice(req.params.orderId), "Invoice loaded"));
const updateInvoiceMetadata = asyncHandler(async (req, res) =>
  ok(res, await invoiceService.updateInvoiceMetadata(req.params.orderId, req.body || {}, req.user, getMeta(req)), "Invoice metadata updated")
);
const getInvoiceAuditHistory = asyncHandler(async (req, res) =>
  ok(res, await invoiceService.getInvoiceAuditHistory(req.params.orderId), "Invoice audit history loaded")
);
const listVendorInvoices = asyncHandler(async (req, res) => ok(res, await invoiceService.listVendorInvoices(req.user.sub, req.query), "Vendor invoices loaded"));
const getVendorInvoice = asyncHandler(async (req, res) => ok(res, await invoiceService.getVendorInvoice(req.user.sub, req.params.orderId), "Vendor invoice loaded"));
const getUserInvoice = asyncHandler(async (req, res) => ok(res, await invoiceService.getUserInvoicePreview(req.user.sub, req.params.orderId), "Invoice loaded"));

async function sendPdf(res, promise) {
  const invoice = await promise;
  res.setHeader("Content-Type", invoice.contentType || "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${invoice.filename}"`);
  return res.send(invoice.content);
}

const downloadAdminInvoice = asyncHandler(async (req, res) => sendPdf(res, invoiceService.downloadAdminInvoice(req.params.orderId)));
const downloadVendorInvoice = asyncHandler(async (req, res) => sendPdf(res, invoiceService.downloadVendorInvoice(req.user.sub, req.params.orderId)));
const downloadUserInvoice = asyncHandler(async (req, res) => sendPdf(res, invoiceService.downloadUserInvoice(req.user.sub, req.params.orderId)));

module.exports = {
  getSettings,
  updateSettings,
  listAdminInvoices,
  getAdminInvoice,
  updateInvoiceMetadata,
  getInvoiceAuditHistory,
  listVendorInvoices,
  getVendorInvoice,
  getUserInvoice,
  downloadAdminInvoice,
  downloadVendorInvoice,
  downloadUserInvoice,
};
