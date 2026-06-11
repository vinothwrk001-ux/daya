const PlatformConfig = require("../models/PlatformConfig");

const DEFAULT_PLATFORM_FEE_PERCENTAGE = 10;

function normalizePercentage(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return DEFAULT_PLATFORM_FEE_PERCENTAGE;
  }
  return numeric;
}

async function getPlatformFeePercentage() {
  const config = await PlatformConfig.findOne({ key: "platform_fee_percentage" }).select("value").lean();
  return normalizePercentage(config?.value);
}

module.exports = {
  DEFAULT_PLATFORM_FEE_PERCENTAGE,
  getPlatformFeePercentage,
};
