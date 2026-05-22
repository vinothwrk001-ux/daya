const Queue = require("bull");
const cron = require("node-cron");
const { logger } = require("../../utils/logger");
const recommendationService = require("./service");

let recommendationQueue = null;
let analyticsCronTask = null;
let rebuildCronTask = null;
let cacheRefreshCronTask = null;

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

    queue.process(async (job) => {
      if (job.data.type === "rebuild") {
        return recommendationService.rebuildAll({ sub: "system", role: "system" });
      }
      if (job.data.type === "cache-clear") {
        return recommendationService.clearCache({ sub: "system", role: "system" });
      }
      return { skipped: true };
    });

    return queue;
  } catch {
    return null;
  }
}

async function initializeRecommendationJobs() {
  const settings = await recommendationService.getSettings();
  recommendationQueue = createQueue();

  rebuildCronTask = cron.schedule(settings.scheduling.rebuildCron || "0 */6 * * *", async () => {
    try {
      if (recommendationQueue) {
        await recommendationQueue.add({ type: "rebuild" }, { removeOnComplete: true, attempts: 2 });
      } else {
        await recommendationService.rebuildAll({ sub: "system", role: "system" });
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
};
