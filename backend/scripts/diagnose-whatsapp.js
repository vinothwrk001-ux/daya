require("../src/config/env");
const { connectDb } = require("../src/config/db");
const { WhatsAppMessageLog } = require("../src/models/WhatsAppMessageLog");
const { formatWhatsAppRecipient, getWhatsAppFromNumber } = require("../src/services/whatsapp.service");

async function main() {
  await connectDb();

  const from = process.env.TWILIO_WHATSAPP_NUMBER;
  let formattedFrom = "";
  try {
    formattedFrom = getWhatsAppFromNumber();
  } catch (error) {
    formattedFrom = `ERROR: ${error.message}`;
  }

  const logs = await WhatsAppMessageLog.find({}).sort({ createdAt: -1 }).limit(5).lean();

  console.log("TWILIO_WHATSAPP_NUMBER (raw):", from || "(missing)");
  console.log("Formatted FROM:", formattedFrom);
  console.log("TWILIO_ORDER_SHIPPED_CONTENT_SID:", process.env.TWILIO_ORDER_SHIPPED_CONTENT_SID ? "set" : "not set");
  console.log("TWILIO_WHATSAPP_SANDBOX:", process.env.TWILIO_WHATSAPP_SANDBOX || "not set");
  console.log("\nRecent WhatsApp logs:");

  if (!logs.length) {
    console.log("  (none)");
  } else {
    for (const log of logs) {
      console.log({
        id: String(log._id),
        phone: log.phone,
        formattedTo: formatWhatsAppRecipient(log.phone),
        status: log.status,
        retryCount: log.retryCount,
        lastError: log.lastError,
        twilioSid: log.twilioSid,
        createdAt: log.createdAt,
      });
    }
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
