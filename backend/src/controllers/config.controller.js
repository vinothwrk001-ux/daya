const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const PlatformConfig = require("../models/PlatformConfig");
const { AuditLog } = require("../models/AuditLog");
const { invalidateInfluencerCommerceConfigCache } = require("../services/influencer-commerce-config.service");

/**
 * Get all platform configurations grouped by category
 */
const getAllConfigs = asyncHandler(async (req, res) => {
  const configs = await PlatformConfig.find().lean();

  const grouped = {};
  configs.forEach((config) => {
    if (!grouped[config.category]) {
      grouped[config.category] = [];
    }
    grouped[config.category].push(config);
  });

  return ok(res, grouped, "Configurations retrieved");
});

/**
 * Get configuration by key
 */
const getConfigByKey = asyncHandler(async (req, res) => {
  const { key } = req.params;

  let config = await PlatformConfig.findOne({ key }).lean();
  if (!config && key === "influencer_commerce_enabled") {
    const created = await PlatformConfig.create({
      key: "influencer_commerce_enabled",
      value: true,
      description:
        "When false, influencer commerce, vendor influencer tools, storefront reels, and tracking attribution are disabled.",
      category: "feature",
      type: "boolean",
      isPublic: true,
      updatedBy: req.user?._id || req.user?.sub,
    });
    config = created.toObject();
  }

  if (!config) {
    throw new AppError("Configuration not found", 404, "NOT_FOUND");
  }

  return ok(res, config, "Configuration retrieved");
});

/**
 * Get configurations by category
 */
const getConfigsByCategory = asyncHandler(async (req, res) => {
  const { category } = req.params;

  const configs = await PlatformConfig.find({ category }).lean();

  return ok(res, configs, "Configurations retrieved");
});

/**
 * Update configuration
 */
const updateConfig = asyncHandler(async (req, res) => {
  const { key } = req.params;
  const { value, description } = req.body;

  if (value === undefined || value === null) {
    throw new AppError("Value is required", 400, "VALIDATION_ERROR");
  }

  const config = await PlatformConfig.findOne({ key });
  if (!config) {
    throw new AppError("Configuration not found", 404, "NOT_FOUND");
  }

  const oldValue = config.value;

  config.value = value;
  if (description) config.description = description;
  const actorRef = req.user?._id || req.user?.sub;
  if (actorRef) config.updatedBy = actorRef;

  await config.save();

  if (key === "influencer_commerce_enabled") {
    invalidateInfluencerCommerceConfigCache();
  }

  // Log the configuration change
  await AuditLog.create({
    actorId: actorRef,
    actorRole: req.user.role,
    action: "CONFIG_UPDATED",
    entityType: "PlatformConfig",
    entityId: config._id,
    metadata: {
      key,
      oldValue,
      newValue: value,
      category: config.category,
    },
    status: "SUCCESS",
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return ok(res, config, "Configuration updated successfully");
});

/**
 * Batch update configurations
 */
const batchUpdateConfigs = asyncHandler(async (req, res) => {
  const { updates } = req.body; // Array of { key, value }

  if (!Array.isArray(updates) || updates.length === 0) {
    throw new AppError("Updates array is required", 400, "VALIDATION_ERROR");
  }

  const results = [];

  for (const update of updates) {
    const { key, value } = update;

    const config = await PlatformConfig.findOne({ key });
    if (!config) continue;

    const oldValue = config.value;
    config.value = value;
    const batchActor = req.user?._id || req.user?.sub;
    if (batchActor) config.updatedBy = batchActor;

    await config.save();

    if (key === "influencer_commerce_enabled") {
      invalidateInfluencerCommerceConfigCache();
    }

    results.push({ key, updated: true });

    // Log each change
    await AuditLog.create({
      actorId: batchActor,
      actorRole: req.user.role,
      action: "CONFIG_UPDATED",
      entityType: "PlatformConfig",
      entityId: config._id,
      metadata: { key, oldValue, newValue: value },
      status: "SUCCESS",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });
  }

  return ok(res, results, "Batch update completed");
});

module.exports = {
  getAllConfigs,
  getConfigByKey,
  getConfigsByCategory,
  updateConfig,
  batchUpdateConfigs,
};
