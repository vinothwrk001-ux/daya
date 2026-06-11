const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const PlatformConfig = require("../models/PlatformConfig");

const DEFAULT_SHIPPING_MODES = {
  selfShipping: true,
  platformShipping: true,
};

function normalizeShippingModes(value = {}) {
  return {
    selfShipping: value?.selfShipping !== false,
    platformShipping: value?.platformShipping !== false,
  };
}

function normalizeUpdatedBy(updatedBy) {
  if (!updatedBy) return undefined;
  if (mongoose.Types.ObjectId.isValid(String(updatedBy))) {
    return new mongoose.Types.ObjectId(String(updatedBy));
  }
  return undefined;
}

async function ensureShippingModesConfig(updatedBy = null) {
  let config = await PlatformConfig.findOne({ key: "shipping_modes" });
  if (!config) {
    config = await PlatformConfig.create({
      key: "shipping_modes",
      value: DEFAULT_SHIPPING_MODES,
      description: "Controls which shipping modes are available.",
      category: "shipping",
      type: "object",
      updatedBy: normalizeUpdatedBy(updatedBy),
    });
  }
  return config;
}

async function getShippingModesConfig() {
  const config = await ensureShippingModesConfig();
  const value = normalizeShippingModes(config.value);
  return {
    key: config.key,
    value,
    description: config.description,
    updatedAt: config.updatedAt,
  };
}

async function updateShippingModesConfig({ selfShipping, platformShipping }, updatedBy) {
  if (typeof selfShipping !== "boolean" || typeof platformShipping !== "boolean") {
    throw new AppError("Both selfShipping and platformShipping must be boolean", 400, "VALIDATION_ERROR");
  }

  if (!selfShipping && !platformShipping) {
    throw new AppError("At least one shipping mode must be enabled", 400, "VALIDATION_ERROR");
  }

  const config = await ensureShippingModesConfig(updatedBy);
  const nextValue = normalizeShippingModes({ selfShipping, platformShipping });
  config.value = nextValue;
  config.updatedBy = normalizeUpdatedBy(updatedBy) || config.updatedBy;
  await config.save();
  return {
    key: config.key,
    value: nextValue,
    description: config.description,
    updatedAt: config.updatedAt,
  };
}

function resolveEnabledShippingModes(configValue = DEFAULT_SHIPPING_MODES) {
  const normalized = normalizeShippingModes(configValue);
  const modes = [];
  if (normalized.selfShipping) modes.push("SELF");
  if (normalized.platformShipping) modes.push("PLATFORM");
  return modes;
}

module.exports = {
  DEFAULT_SHIPPING_MODES,
  ensureShippingModesConfig,
  getShippingModesConfig,
  updateShippingModesConfig,
  normalizeShippingModes,
  resolveEnabledShippingModes,
};
