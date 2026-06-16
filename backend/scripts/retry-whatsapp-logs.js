require("../src/config/env");
const { connectDb } = require("../src/config/db");
require("../src/models/Payment");
require("../src/models/User");
require("../src/models/Product");
const whatsappNotificationService = require("../src/services/whatsapp-notification.service");
const whatsappLogRepo = require("../src/repositories/whatsapp-message-log.repository");

async function main() {
  await connectDb();

  const retrying = await whatsappLogRepo.findPendingRetries(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
  const failed = await whatsappLogRepo.list({ status: "Retrying", limit: 20 });

  const logs = [...retrying, ...(failed.logs || [])];
  const unique = new Map(logs.map((log) => [String(log._id), log]));

  console.log(`Retrying ${unique.size} WhatsApp log(s)...`);

  for (const log of unique.values()) {
    await whatsappLogRepo.updateById(log._id, {
      $set: {
        status: "Queued",
        nextRetryAt: new Date(),
        lastError: "",
      },
    });
    const result = await whatsappNotificationService.dispatchLog(log._id, {});
    console.log({
      logId: String(log._id),
      phone: log.phone,
      status: result?.status,
      twilioSid: result?.twilioSid,
      lastError: result?.lastError,
    });
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
