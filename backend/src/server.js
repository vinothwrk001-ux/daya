require("./config/env");

const http = require("http");
const { createApp } = require("./app");
const { connectDb } = require("./config/db");
const { logger } = require("./utils/logger");
const { ensurePaymentIndexes } = require("./models/Payment");
const { ensurePredefinedStaffRoles } = require("./modules/staff/services/staff-role-bootstrap.service");
const { ensureDefaultPricingCategories } = require("./services/pricing-category.service");
const { initializeEventBus, shutdownEventBus } = require("./modules/events/event-bus");
const {
  initializePaymentMaintenanceJobs,
  shutdownPaymentMaintenanceJobs,
} = require("./jobs/payment-maintenance.job");
const {
  initializeWhatsAppRetryJobs,
  shutdownWhatsAppRetryJobs,
} = require("./jobs/whatsapp-retry.job");
const { initializeRecommendationJobs } = require("./modules/recommendation/job");
const paymentService = require("./services/payment.service");

async function start() {
  const app = createApp();
  const server = http.createServer(app);
  const port = Number(process.env.PORT || 5000);
  
  server.listen(port, () => {
    logger.info(`API listening on port ${port}`);
  });

  await connectDb();

  await ensurePaymentIndexes();
  await ensurePredefinedStaffRoles();
  await ensureDefaultPricingCategories();

  // Run the external network calls in the background so they don't block startup
  paymentService.validateRazorpayConfiguration({
    verifyCredentials: process.env.NODE_ENV !== "test",
  }).then(razorpayHealth => logger.info("Razorpay configuration validated", razorpayHealth))
    .catch(err => logger.error("Razorpay validation failed", err));

  initializeEventBus();

  try {
    const paymentJobs = await initializePaymentMaintenanceJobs();
    logger.info("Payment maintenance jobs initialized", paymentJobs);
  } catch (error) {
    logger.error("Failed to initialize payment maintenance jobs", {
      error: error?.message,
    });
  }

  try {
    await initializeRecommendationJobs();
  } catch (error) {
    logger.error("Failed to initialize recommendation jobs", {
      error: error?.message,
    });
  }

  try {
    const whatsappJobs = await initializeWhatsAppRetryJobs();
    logger.info("WhatsApp retry jobs initialized", whatsappJobs);
  } catch (error) {
    logger.error("Failed to initialize WhatsApp retry jobs", {
      error: error?.message,
    });
  }

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    logger.info("SIGTERM received, shutting down gracefully");
    server.close(async () => {
      await shutdownPaymentMaintenanceJobs();
      await shutdownWhatsAppRetryJobs();
      await shutdownEventBus();
      process.exit(0);
    });
  });

  process.on("SIGINT", async () => {
    logger.info("SIGINT received, shutting down gracefully");
    server.close(async () => {
      await shutdownPaymentMaintenanceJobs();
      await shutdownWhatsAppRetryJobs();
      await shutdownEventBus();
      process.exit(0);
    });
  });
}

start().catch((err) => {
  console.error("CRITICAL FATAL STARTUP ERROR:", err);
  logger.error("Fatal startup error", {
    source: "server",
    event: "startup_failed",
    error: err,
  });
  // Wait briefly for winston to flush before exiting
  setTimeout(() => process.exit(1), 1000);
});

