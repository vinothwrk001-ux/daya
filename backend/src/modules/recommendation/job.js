const Queue = require("bull");
const cron = require("node-cron");
const { logger } = require("../../utils/logger");
const recommendationService = require("./service");

let recommendationQueue = null;
let analyticsCronTask = null;
let rebuildCronTask = null;
let cacheRefreshCronTask = null;

async function runRecommendationJob(jobId, actor = { sub: "system", role: "system" }) {
  const job = await recommendationService.updateJob(jobId, {
    status: "running",
    progress: 0,
    started_at: new Date(),
    error_message: "",
  });
  if (!job) return { skipped: true };

  try {
    let result = {};
    if (job.job_type === "rebuild") {
      result = await recommendationService.rebuildAll(actor, (progress) =>
        recommendationService.updateJob(jobId, { progress })
      );
    } else if (job.job_type === "cache_clear") {
      await recommendationService.updateJob(jobId, { progress: 50 });
      result = await recommendationService.clearCache(actor);
    }

    await recommendationService.updateJob(jobId, {
      status: "completed",
      progress: 100,
      completed_at: new Date(),
      result,
    });
    return result;
  } catch (error) {
    await recommendationService.updateJob(jobId, {
      status: "failed",
      completed_at: new Date(),
      error_message: error?.message || "Recommendation job failed",
    });
    logger.error("Recommendation background job failed", { jobId, error: error?.message });
    throw error;
  }
}

function runInBackground(jobId, actor) {
  setImmediate(() => {
    runRecommendationJob(jobId, actor).catch(() => {});
  });
}

async function addQueueJob(data) {
  if (!recommendationQueue) return false;
  try {
    await Promise.race([
      recommendationQueue.add(data, { removeOnComplete: true, attempts: 2 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Queue add timeout")), 500)),
    ]);
    return true;
  } catch (error) {
    logger.warn("Recommendation queue unavailable; using local background runner", { error: error?.message });
    return false;
  }
}

function createQueue() {
  try {
    const queue = new Queue("recommendation-engine", {
      redis: {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: Number(process.env.REDIS_PORT || 6379),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
    });

    queue.process(async (job) => runRecommendationJob(job.data.jobId, job.data.actor || { sub: "system", role: "system" }));

    return queue;
  } catch {
    return null;
  }
}

async function enqueueRecommendationJob(jobType, actor) {
  const job = await recommendationService.createJob(jobType, actor);
  const queued = await addQueueJob({ type: jobType, jobId: String(job._id), actor });
  if (!queued) runInBackground(String(job._id), actor);
  return job;
}

async function initializeRecommendationJobs() {
  const settings = await recommendationService.getSettings();
  recommendationQueue = createQueue();

  rebuildCronTask = cron.schedule(settings.scheduling.rebuildCron || "0 */6 * * *", async () => {
    try {
      if (recommendationQueue) {
        await enqueueRecommendationJob("rebuild", { sub: "system", role: "system" });
      } else {
        const job = await recommendationService.createJob("rebuild", { sub: "system", role: "system" });
        runInBackground(String(job._id), { sub: "system", role: "system" });
      }
    } catch (error) {
      logger.error("Recommendation rebuild job failed", { error: error?.message });
    }
  });

  analyticsCronTask = cron.schedule(settings.scheduling.analyticsCron || "*/30 * * * *", async () => {
    try {
      await recommendationService.getAnalyticsSummary({ days: 30 });
    } catch (error) {
      logger.error("Recommendation analytics aggregation failed", { error: error?.message });
    }
  });

  cacheRefreshCronTask = cron.schedule(settings.scheduling.cacheRefreshCron || "0 * * * *", async () => {
    try {
      await recommendationService.getTrendingProducts({ skipCache: true });
    } catch (error) {
      logger.error("Recommendation cache refresh failed", { error: error?.message });
    }
  });

  logger.info("Recommendation jobs initialized", {
    queueEnabled: Boolean(recommendationQueue),
  });
}

module.exports = {
  initializeRecommendationJobs,
  enqueueRecommendationJob,
  runRecommendationJob,
};
