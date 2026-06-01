const express = require("express");
const { adminWorkspaceAuthRequired, requireWorkspacePermission } = require("../middleware/adminAccess");
const { authRequired } = require("../middleware/auth");
const { AppError } = require("../utils/AppError");
const { logger } = require("../utils/logger");
const settlementService = require("../services/settlement.service");
const settlementMetricsService = require("../services/settlement-metrics.service");
const {
  queueSettlementJob,
  getQueueStatus,
  pauseSettlementJobs,
  resumeSettlementJobs,
  getRecentJobs,
  clearQueue,
} = require("../jobs/settlement.job");

const router = express.Router();

// All routes require authentication and admin access
router.use(authRequired);
router.use(adminWorkspaceAuthRequired);

/**
 * POST /admin/settlement/run
 * Manually trigger settlement job
 */
router.post("/settlement/run", requireWorkspacePermission("settlements.settle"), async (req, res, next) => {
  try {
    const { batchSize = 50, vendorId = null, priority = "normal" } = req.body;

    logger.info("📋 Settlement job triggered manually", {
      adminId: req.user._id,
      batchSize,
      vendorId,
      priority,
    });

    const result = await queueSettlementJob({
      batchSize,
      vendorId,
      priority,
    });

    res.json({
      success: true,
      message: "Settlement job queued successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/settlement/status
 * Get settlement queue and system status
 */
router.get("/settlement/status", requireWorkspacePermission("settlements.read"), async (req, res, next) => {
  try {
    const queueStatus = await getQueueStatus();
    const systemStats = await settlementMetricsService.getSettlementStatistics(30);

    res.json({
      success: true,
      data: {
        queue: queueStatus,
        statistics: systemStats,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/settlement/metrics
 * Get settlement metrics and history
 */
router.get("/settlement/metrics", requireWorkspacePermission("settlements.read"), async (req, res, next) => {
  try {
    const { days = 30, limit = 10 } = req.query;

    const metrics = await settlementMetricsService.getLatestMetrics(
      Math.min(Number(limit), 100)
    );
    const stats = await settlementMetricsService.getSettlementStatistics(
      Number(days)
    );
    const failures = await settlementMetricsService.getRecentFailures(7);
    const errors = await settlementMetricsService.getErrorBreakdown(7);

    res.json({
      success: true,
      data: {
        recentJobs: metrics,
        statistics: stats,
        recentFailures: failures.slice(0, 50),
        errorBreakdown: errors,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/settlement/job/:jobId
 * Get detailed information about a specific job
 */
router.get("/settlement/job/:jobId", requireWorkspacePermission("settlements.read"), async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const job = await settlementMetricsService.getJobDetails(jobId);

    if (!job) {
      throw new AppError("Settlement job not found", 404, "JOB_NOT_FOUND");
    }

    res.json({
      success: true,
      data: job,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/settlement/vendor/:vendorId
 * Get settlement status for a specific vendor
 */
router.get("/settlement/vendor/:vendorId", requireWorkspacePermission("settlements.read"), async (req, res, next) => {
  try {
    const { vendorId } = req.params;

    const status = await settlementService.getVendorSettlementStatus(vendorId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/settlement/verify
 * Verify settlement integrity for orders
 */
router.post("/settlement/verify", requireWorkspacePermission("settlements.read"), async (req, res, next) => {
  try {
    const { orderIds = [] } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      throw new AppError(
        "orderIds must be a non-empty array",
        400,
        "INVALID_INPUT"
      );
    }

    if (orderIds.length > 100) {
      throw new AppError(
        "Cannot verify more than 100 orders at once",
        400,
        "LIMIT_EXCEEDED"
      );
    }

    const verification = await settlementService.verifySettlementBatch(
      orderIds
    );

    res.json({
      success: true,
      data: verification,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/settlement/pause
 * Pause settlement jobs (emergency stop)
 */
router.post("/settlement/pause", requireWorkspacePermission("settlements.hold"), async (req, res, next) => {
  try {
    logger.warn("⏸️  Settlement jobs paused by admin", {
      adminId: req.user._id,
    });

    await pauseSettlementJobs();

    res.json({
      success: true,
      message: "Settlement jobs paused successfully",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/settlement/resume
 * Resume settlement jobs
 */
router.post("/settlement/resume", requireWorkspacePermission("settlements.release"), async (req, res, next) => {
  try {
    logger.info("▶️  Settlement jobs resumed by admin", {
      adminId: req.user._id,
    });

    await resumeSettlementJobs();

    res.json({
      success: true,
      message: "Settlement jobs resumed successfully",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/settlement/queue
 * Get queue jobs (Bull queue only)
 */
router.get("/settlement/queue", requireWorkspacePermission("settlements.read"), async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;

    const jobs = await getRecentJobs(Math.min(Number(limit), 100));

    res.json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /admin/settlement/queue (development only)
 * Clear all queued jobs
 */
router.delete("/settlement/queue", requireWorkspacePermission("settlements.reverse"), async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === "production") {
      throw new AppError(
        "Cannot clear queue in production",
        403,
        "FORBIDDEN"
      );
    }

    logger.warn("🗑️  Settlement queue cleared by admin", {
      adminId: req.user._id,
    });

    await clearQueue();

    res.json({
      success: true,
      message: "Settlement queue cleared",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/settlement/cleanup-metrics
 * Clean old metrics (keep last N days)
 */
router.post("/settlement/cleanup-metrics", requireWorkspacePermission("settlements.reverse"), async (req, res, next) => {
  try {
    const { daysToKeep = 90 } = req.body;

    if (!Number.isInteger(daysToKeep) || daysToKeep < 1) {
      throw new AppError(
        "daysToKeep must be a positive integer",
        400,
        "INVALID_INPUT"
      );
    }

    logger.info("🗑️  Cleaning old settlement metrics", {
      adminId: req.user._id,
      daysToKeep,
    });

    const result = await settlementMetricsService.cleanOldMetrics(daysToKeep);

    res.json({
      success: true,
      message: "Old metrics cleaned",
      data: {
        deletedCount: result.deletedCount,
        keptFromDays: daysToKeep,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
