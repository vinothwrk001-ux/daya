const cron = require("node-cron");
const { logger } = require("../utils/logger");
const whatsappNotificationService = require("../services/whatsapp-notification.service");

let retryTask = null;

function getRetryCronExpression() {
  return String(process.env.WHATSAPP_RETRY_CRON || "*/1 * * * *").trim();
}

async function initializeWhatsAppRetryJobs() {
  if (process.env.WHATSAPP_RETRY_DISABLED === "true") {
    logger.info("WhatsApp retry jobs disabled");
    return { enabled: false };
  }

  const cronExpression = getRetryCronExpression();
  retryTask = cron.schedule(cronExpression, async () => {
    try {
      const processed = await whatsappNotificationService.processDueRetries();
      if (processed > 0) {
        logger.info("Processed WhatsApp retry jobs", { processed });
      }
    } catch (error) {
      logger.error("WhatsApp retry job failed", { error: error?.message });
    }
  });

  logger.info("WhatsApp retry jobs initialized", { cronExpression });
  return { enabled: true, cronExpression };
}

async function shutdownWhatsAppRetryJobs() {
  if (retryTask) {
    retryTask.stop();
    retryTask = null;
  }
}

module.exports = {
  initializeWhatsAppRetryJobs,
  shutdownWhatsAppRetryJobs,
};
