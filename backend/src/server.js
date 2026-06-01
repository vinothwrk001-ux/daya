require("./config/env");

const http = require("http");
const { createApp } = require("./app");
const { connectDb } = require("./config/db");
const { logger } = require("./utils/logger");
const { ensurePaymentIndexes } = require("./models/Payment");
const { ensurePredefinedStaffRoles } = require("./modules/staff/services/role.service");
const { initializeSettlementScheduler, shutdown } = require("./jobs/settlement.job");
const { ensureDefaultPricingCategories } = require("./services/pricing-category.service");
const { initializeEventBus, shutdownEventBus } = require("./modules/events/event-bus");
const { initializeInfluencerCommerceJobs, shutdownInfluencerCommerceJobs } = require("./jobs/influencer-commerce.job");
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

  // Initialize settlement scheduler
  try {
    const schedulerStatus = await initializeSettlementScheduler();
    logger.info("Settlement scheduler initialized", schedulerStatus);
  } catch (error) {
    logger.error("Failed to initialize settlement scheduler", {
      error: error?.message,
    });
    // Non-fatal error - app can continue without scheduler
  }

  try {
    const influencerJobs = await initializeInfluencerCommerceJobs();
    logger.info("Influencer commerce jobs initialized", influencerJobs);
  } catch (error) {
    logger.error("Failed to initialize influencer commerce jobs", {
      error: error?.message,
    });
  }

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
      await shutdown();
      await shutdownInfluencerCommerceJobs();
      await shutdownPaymentMaintenanceJobs();
      await shutdownEventBus();
      process.exit(0);
    });
  });

  process.on("SIGINT", async () => {
    logger.info("SIGINT received, shutting down gracefully");
    server.close(async () => {
      await shutdown();
      await shutdownInfluencerCommerceJobs();
      await shutdownPaymentMaintenanceJobs();
      await shutdownEventBus();
      process.exit(0);
    });
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal startup error", err);
  process.exit(1);
});

