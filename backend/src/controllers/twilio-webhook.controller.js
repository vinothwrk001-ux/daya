const { asyncHandler } = require("../utils/asyncHandler");
const { ok } = require("../utils/apiResponse");
const { handleTwilioWhatsAppWebhook } = require("../services/twilio-webhook.service");

const twilioWhatsAppWebhook = asyncHandler(async (req, res) => {
  const result = await handleTwilioWhatsAppWebhook(req);
  return ok(res, result, "Twilio webhook processed");
});

module.exports = {
  twilioWhatsAppWebhook,
};
