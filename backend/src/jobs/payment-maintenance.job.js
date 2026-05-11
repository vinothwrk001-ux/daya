const cron = require("node-cron");
const { PaymentSession } = require("../models/PaymentSession");
const { Payment } = require("../models/Payment");
const { Refund } = require("../models/Refund");
const { logger } = require("../utils/logger");

let cronTask = null;

async function runMaintenance() {
  const now = new Date();
  const [expiredSessions, stuckPayments, pendingRefunds] = await Promise.all([
    PaymentSession.updateMany(
      {
        status: { $in: ["CREATED", "PENDING", "VERIFIED"] },
        expiresAt: { $lte: now },
      },
      {
        $set: {
          status: "EXPIRED",
          expiredAt: now,
        },
      }
    ),
    Payment.find({
      status: { $in: ["FAILED", "REFUND_PENDING"] },
      createdAt: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    })
      .select("_id status razorpayOrderId razorpayPaymentId fulfillmentStatus createdAt")
      .lean(),
    Refund.find({
      status: "PENDING",
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    })
      .select("_id refundId amount paymentId orderId createdAt")
      .lean(),
  ]);

  logger.info("Payment maintenance run completed", {
    source: "payment-maintenance.job",
    expiredSessionsUpdated: expiredSessions.modifiedCount || 0,
    stuckPayments: stuckPayments.length,
    pendingRefunds: pendingRefunds.length,
  });
}

async function initializePaymentMaintenanceJobs() {
  if (cronTask) {
    return { scheduled: true };
  }

  const schedule = process.env.PAYMENT_MAINTENANCE_CRON || "*/15 * * * *";
  cronTask = cron.schedule(schedule, async () => {
    try {
      await runMaintenance();
    } catch (error) {
      logger.error("Payment maintenance job failed", {
        source: "payment-maintenance.job",
        message: error.message,
      });
    }
  });

  return { scheduled: true, schedule };
}

async function shutdownPaymentMaintenanceJobs() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}

module.exports = {
  initializePaymentMaintenanceJobs,
  shutdownPaymentMaintenanceJobs,
  runMaintenance,
};
