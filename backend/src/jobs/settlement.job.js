const Queue = require("bull");
const redis = require("redis");
const cron = require("node-cron");
const { logger } = require("../utils/logger");
const settlementService = require("../services/settlement.service");

/**
 * Settlement Job Scheduler
 *
 * Implements TWO scheduling modes:
 * 1. Bull Queue (Production): Redis-backed queue with job persistence, retries, and clustering support
 * 2. Node-Cron (Fallback): Simple in-process scheduler for development
 *
 * Supports:
 * - Configurable schedule (ENV: SETTLEMENT_JOB_SCHEDULE)
 * - Batch processing
 * - Retry logic with exponential backoff
 * - Failure notifications
 * - Manual trigger via HTTP endpoint
 */

let settlementQueue = null;
let cronTask = null;

/**
 * Initialize Bull Queue
 * @returns {Queue.Queue} Bull queue instance
 */
function initializeBullQueue() {
  if (process.env.REDIS_DISABLED === "true") {
    logger.info("Bull Queue disabled for settlement jobs; using cron fallback");
    return null;
  }
  const redisConfig = {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  try {
    const queue = new Queue("settlement", redisConfig);

    // Process jobs from the queue
    queue.process(async (job) => {
      logger.info("🔄 Processing settlement job from Bull queue", {
        jobId: job.id,
        data: job.data,
      });

      try {
        const startTime = Date.now();
        const result = await settlementService.processEligibleSettlements({
          batchSize: job.data.batchSize || 50,
          maxRetries: job.data.maxRetries || 3,
          vendorId: job.data.vendorId || null,
        });

        const duration = Date.now() - startTime;

        logger.info("✅ Settlement job completed successfully", {
          jobId: job.id,
          result,
          duration: `${(duration / 1000).toFixed(2)}s`,
        });

        return {
          success: true,
          ...result,
          queueJobId: job.id,
        };
      } catch (error) {
        logger.error("❌ Settlement job failed", {
          jobId: job.id,
          error: error?.message || String(error),
          stack: error?.stack,
        });

        throw error;
      }
    });

    // Event handlers
    queue.on("completed", (job, result) => {
      logger.info("📊 Settlement job completed", {
        jobId: job.id,
        processedOrders: result.processedOrders,
        settledAmount: result.settledAmount,
      });
    });

    queue.on("failed", (job, err) => {
      logger.error("⚠️ Settlement job failed after retries", {
        jobId: job.id,
        attempt: job.attemptsMade,
        error: err?.message,
      });
    });

    queue.on("error", (err) => {
      logger.error("💥 Bull queue error", {
        error: err?.message,
        code: err?.code,
      });
    });

    logger.info("✅ Bull Queue initialized for settlement jobs", {
      redisHost: redisConfig.host,
      redisPort: redisConfig.port,
    });

    return queue;
  } catch (error) {
    logger.error("⚠️ Failed to initialize Bull Queue, falling back to node-cron", {
      error: error?.message,
    });
    return null;
  }
}

/**
 * Initialize Node-Cron Scheduler (Fallback)
 */
function initializeCronScheduler() {
  const schedule = process.env.SETTLEMENT_JOB_SCHEDULE || "0 2 * * *"; // Default: 2 AM daily

  try {
    cronTask = cron.schedule(schedule, async () => {
      logger.info("🔄 Cron settlement job triggered", {
        schedule,
        timestamp: new Date().toISOString(),
      });

      try {
        const result = await settlementService.processEligibleSettlements({
          batchSize: Number(process.env.SETTLEMENT_BATCH_SIZE || 50),
          maxRetries: Number(process.env.SETTLEMENT_MAX_RETRIES || 3),
        });

        logger.info("✅ Cron settlement job completed", {
          processedOrders: result.processedOrders,
          settledAmount: result.settledAmount,
        });
      } catch (error) {
        logger.error("❌ Cron settlement job failed", {
          error: error?.message,
        });
      }
    });

    logger.info("✅ Node-Cron scheduler initialized for settlement jobs", {
      schedule,
      description: "Settlement job will run on this cron schedule",
    });

    return cronTask;
  } catch (error) {
    logger.error("💥 Failed to initialize Node-Cron scheduler", {
      error: error?.message,
    });
    throw error;
  }
}

/**
 * Initialize settlement scheduler
 *
 * Chooses scheduling mode based on environment:
 * - SETTLEMENT_SCHEDULER_MODE=bull → Bull Queue (production)
 * - SETTLEMENT_SCHEDULER_MODE=cron → Node-Cron (development/fallback)
 * - Default → Try Bull, fallback to Cron
 *
 * @returns {Object} Scheduler status
 */
async function initializeSettlementScheduler() {
  const mode = (process.env.SETTLEMENT_SCHEDULER_MODE || "auto").toLowerCase();

  logger.info("🚀 Initializing Settlement Scheduler", {
    mode,
    schedule: process.env.SETTLEMENT_JOB_SCHEDULE || "0 2 * * * (daily at 2 AM)",
  });

  if (mode === "cron" || mode === "development") {
    // Force node-cron mode
    initializeCronScheduler();
    return {
      mode: "cron",
      status: "initialized",
      message: "Using Node-Cron scheduler",
    };
  }

  // Try Bull first, fallback to Cron
  settlementQueue = initializeBullQueue();

  if (settlementQueue) {
    // Also schedule with cron for manual triggers
    if (process.env.SETTLEMENT_ENABLE_CRON_FALLBACK !== "false") {
      initializeCronScheduler();
    }

    return {
      mode: "bull",
      status: "initialized",
      message: "Using Bull Queue scheduler with Redis",
    };
  }

  // Fallback to Cron
  initializeCronScheduler();
  return {
    mode: "cron",
    status: "initialized",
    message: "Bull Queue unavailable, using Node-Cron scheduler",
  };
}

/**
 * Queue a manual settlement job
 * Useful for admin endpoints to trigger settlement manually
 *
 * @param {Object} options - Job options
 * @returns {Promise<Object>} Job result or status
 */
async function queueSettlementJob(options = {}) {
  const {
    batchSize = 50,
    maxRetries = 3,
    vendorId = null,
    priority = "normal",
  } = options;

  if (!settlementQueue) {
    // If Bull not available, run synchronously
    logger.warn("⚠️ Bull Queue not available, running settlement synchronously", {
      options,
    });

    return await settlementService.processEligibleSettlements({
      batchSize,
      maxRetries,
      vendorId,
    });
  }

  // Add to Bull queue
  const job = await settlementQueue.add(
    {
      batchSize,
      maxRetries,
      vendorId,
    },
    {
      attempts: maxRetries,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: false,
      removeOnFail: false,
      priority: priority === "high" ? 10 : 1,
      jobId: `settlement-${Date.now()}`,
    }
  );

  logger.info("📋 Settlement job queued", {
    jobId: job.id,
    options,
  });

  return {
    queued: true,
    jobId: job.id,
    message: "Settlement job added to queue",
  };
}

/**
 * Get queue status
 * @returns {Promise<Object>} Queue status
 */
async function getQueueStatus() {
  if (!settlementQueue) {
    return {
      available: false,
      mode: "cron",
      message: "Bull Queue not available",
    };
  }

  const counts = await settlementQueue.getJobCounts();
  const workers = await settlementQueue.getWorkers();

  return {
    available: true,
    mode: "bull",
    jobCounts: counts,
    workers: workers.length,
    isPaused: settlementQueue.isPaused(),
  };
}

/**
 * Pause settlement jobs
 * @returns {Promise<void>}
 */
async function pauseSettlementJobs() {
  if (settlementQueue) {
    await settlementQueue.pause();
    logger.info("⏸️  Settlement queue paused");
  }
  if (cronTask) {
    cronTask.stop();
    logger.info("⏸️  Cron task paused");
  }
}

/**
 * Resume settlement jobs
 * @returns {Promise<void>}
 */
async function resumeSettlementJobs() {
  if (settlementQueue) {
    await settlementQueue.resume();
    logger.info("▶️  Settlement queue resumed");
  }
  if (cronTask) {
    cronTask.start();
    logger.info("▶️  Cron task resumed");
  }
}

/**
 * Clear all queued jobs (development only)
 * @returns {Promise<void>}
 */
async function clearQueue() {
  if (!settlementQueue) return;

  if (process.env.NODE_ENV === "production") {
    throw new Error("Cannot clear queue in production");
  }

  await settlementQueue.clean(0);
  logger.warn("🗑️  Settlement queue cleared (development only)");
}

/**
 * Get recent job history
 * @param {number} limit - Number of recent jobs to fetch
 * @returns {Promise<Array>} Recent jobs
 */
async function getRecentJobs(limit = 20) {
  if (!settlementQueue) return [];

  const completed = await settlementQueue.getCompleted(0, limit);
  const failed = await settlementQueue.getFailed(0, limit);

  return {
    completed: completed.map((job) => ({
      id: job.id,
      data: job.data,
      progress: job.progress(),
      finishedOn: job.finishedOn,
      result: job._result,
    })),
    failed: failed.map((job) => ({
      id: job.id,
      data: job.data,
      failedReason: job.failedReason,
      finishedOn: job.finishedOn,
    })),
  };
}

/**
 * Graceful shutdown
 * @returns {Promise<void>}
 */
async function shutdown() {
  logger.info("🛑 Shutting down settlement scheduler");

  if (cronTask) {
    cronTask.stop();
  }

  if (settlementQueue) {
    await settlementQueue.close();
  }

  logger.info("✅ Settlement scheduler shut down");
}

module.exports = {
  initializeSettlementScheduler,
  queueSettlementJob,
  getQueueStatus,
  pauseSettlementJobs,
  resumeSettlementJobs,
  clearQueue,
  getRecentJobs,
  shutdown,
};
