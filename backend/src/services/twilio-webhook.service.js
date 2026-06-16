const { AppError } = require("../utils/AppError");
const { verifyTwilioWebhookSignature } = require("../services/whatsapp.service");
const whatsappNotificationService = require("../services/whatsapp-notification.service");
const { logger } = require("../utils/logger");

async function handleTwilioWhatsAppWebhook(req) {
  const isValid = verifyTwilioWebhookSignature(req);
  if (!isValid) {
    throw new AppError("Invalid Twilio webhook signature", 403, "INVALID_SIGNATURE");
  }

  const payload = req.body || {};
  const messageSid = payload.MessageSid || payload.SmsSid;
  const messageStatus = payload.MessageStatus || payload.SmsStatus;

  const updated = await whatsappNotificationService.applyTwilioStatusUpdate({
    twilioSid: messageSid,
    messageStatus,
    rawPayload: payload,
  });

  logger.webhook("Twilio WhatsApp webhook processed", {
    messageSid,
    messageStatus,
    matchedLog: updated ? String(updated._id) : null,
  });

  return {
    ok: true,
    matched: Boolean(updated),
  };
}

module.exports = {
  handleTwilioWhatsAppWebhook,
};
