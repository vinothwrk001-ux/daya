const codService = require("../services/cod.service");
const { logger } = require("../utils/logger");

async function runCodAnalyticsAggregation({ days = 30 } = {}) {
  const analytics = await codService.getAnalytics({ days });
  logger.info("COD analytics aggregation completed", analytics);
  return analytics;
}

module.exports = {
  runCodAnalyticsAggregation,
};
