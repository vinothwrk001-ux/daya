require("./config/env");

const http = require("http");
const { createApp } = require("./app");
const { connectDb } = require("./config/db");
const { logger } = require("./utils/logger");
const { ensurePaymentIndexes } = require("./models/Payment");
const { ensurePredefinedStaffRoles } = require("./modules/staff/services/role.service");
const { ensureDefaultPricingCategories } = require("./services/pricing-category.service");
const { initializeEventBus, shutdownEventBus } = require("./modules/events/event-bus");
const {
  initializePaymentMaintenanceJobs,
  shutdownPaymentMaintenanceJobs,
} = require("./jobs/payment-maintenance.job");
const { initializeRecommendationJobs } = require("./modules/recommendation/job");
const paymentService = require("./services/payment.service");

async function start() {
  await connectDb();
  await ensurePaymentIndexes();
  await ensurePredefinedStaffRoles();
  await ensureDefaultPricingCategories();

  const razorpayHealth = await paymentService.validateRazorpayConfiguration({
    verifyCredentials: process.env.NODE_ENV !== "test",
  });
  logger.info("Razorpay configuration validated", razorpayHealth);

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

  const app = createApp();
  const server = http.createServer(app);

  const port = Number(process.env.PORT || 5000);
  server.listen(port, () => {
    logger.info(`API listening on port ${port}`);
  });

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    logger.info("SIGTERM received, shutting down gracefully");
    server.close(async () => {
      await shutdownPaymentMaintenanceJobs();
      await shutdownEventBus();
      process.exit(0);
    });
  });

  process.on("SIGINT", async () => {
    logger.info("SIGINT received, shutting down gracefully");
    server.close(async () => {
      await shutdownPaymentMaintenanceJobs();
      await shutdownEventBus();
      process.exit(0);
    });
  });
}

start().catch((err) => {
  logger.error("Fatal startup error", {
    source: "server",
    event: "startup_failed",
    error: err,
  });
  process.exit(1);
});

