const express = require("express");
const webhookController = require("../controllers/webhook.controller");
const twilioWebhookController = require("../controllers/twilio-webhook.controller");

const router = express.Router();

// No auth for webhooks
router.post("/razorpay", webhookController.razorpayWebhook);
router.post("/shiprocket", webhookController.shiprocketWebhook);
router.post("/logistics", webhookController.shiprocketWebhook);
router.post("/twilio/whatsapp", twilioWebhookController.twilioWhatsAppWebhook);

module.exports = router;
