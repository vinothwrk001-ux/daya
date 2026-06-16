const { asyncHandler } = require("../utils/asyncHandler");
const { ok } = require("../utils/apiResponse");
const whatsappNotificationService = require("../services/whatsapp-notification.service");

const listWhatsAppLogs = asyncHandler(async (req, res) => {
  const result = await whatsappNotificationService.listWhatsAppLogs({
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 20),
    status: req.query.status,
    messageType: req.query.messageType,
    search: req.query.search,
    orderId: req.query.orderId,
  });
  return ok(res, result, "WhatsApp logs loaded");
});

const retryWhatsAppLog = asyncHandler(async (req, res) => {
  const log = await whatsappNotificationService.retryWhatsAppLog(req.params.id, {
    actor: req.user,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  if (!log) {
    return ok(res, null, "WhatsApp log not found");
  }
  return ok(res, log, "WhatsApp notification retried");
});

module.exports = {
  listWhatsAppLogs,
  retryWhatsAppLog,
};
