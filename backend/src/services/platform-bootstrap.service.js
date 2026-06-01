const crypto = require("crypto");
const os = require("os");
const mongoose = require("mongoose");

const PlatformConfig = require("../models/PlatformConfig");
const SystemBootstrap = require("../models/SystemBootstrap");
const SecurityAuditLog = require("../models/SecurityAuditLog");
const { AppError } = require("../utils/AppError");

const BOOTSTRAP_KEY = "platform-default-config";
const BOOTSTRAP_VERSION = "1.0.0";

const DEFAULT_PLATFORM_CONFIGS = Object.freeze([
  {
    key: "commission_percentage",
    value: 10,
    description: "Platform commission percentage for sellers",
    category: "commission",
    type: "number",
  },
  {
    key: "min_vendor_earnings",
    value: 1000,
    description: "Minimum earning threshold for payout",
    category: "commission",
    type: "number",
  },
  {
    key: "payout_frequency_days",
    value: 14,
    description: "Payout frequency in days",
    category: "commission",
    type: "number",
  },
  {
    key: "auto_approve_vendors",
    value: false,
    description: "Automatically approve vendor applications",
    category: "feature",
    type: "boolean",
  },
  {
    key: "auto_approve_products",
    value: false,
    description: "Automatically approve product listings",
    category: "feature",
    type: "boolean",
  },
  {
    key: "enable_2fa",
    value: true,
    description: "Require 2FA for admin accounts",
    category: "security",
    type: "boolean",
  },
  {
    key: "max_login_attempts",
    value: 5,
    description: "Maximum login attempts before lockout",
    category: "security",
    type: "number",
  },
  {
    key: "email_notifications_enabled",
    value: true,
    description: "Enable email notifications",
    category: "email",
    type: "boolean",
  },
  {
    key: "shipping_modes",
    value: {
      selfShipping: true,
      platformShipping: true,
    },
    description: "Controls which shipping modes vendors can access",
    category: "shipping",
    type: "object",
  },
  {
    key: "influencer_commerce_enabled",
    value: true,
    description:
      "When false, influencer sign-in/register, storefront reels, influencer APIs, vendors' Influencer Commerce, and tracking attribution are disabled. Admin moderation routes stay available.",
    category: "feature",
    type: "boolean",
    isPublic: true,
  },
]);

function hashPayload(payload) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload || {}))
    .digest("hex");
}

async function writeSecurityAudit({
  action,
  status,
  reason = "",
  actor = {},
  environment = process.env.NODE_ENV || "development",
  metadata = {},
  deps = {},
}) {
  const SecurityAudit = deps.SecurityAuditLog || SecurityAuditLog;
  await SecurityAudit.create({
    actorId: actor.id || actor.sub || actor._id || "system",
    actorRole: actor.role || "system",
    action,
    module: "platform_bootstrap",
    route: "cli://platform-bootstrap",
    payloadHash: hashPayload(metadata),
    status,
    reason,
    environment,
    ipAddress: actor.ipAddress || "",
    userAgent: actor.userAgent || "",
    device: actor.device || "",
    browser: actor.browser || "",
    metadata,
  });
}

async function bootstrapPlatformDefaults(options = {}) {
  const deps = options.deps || {};
  const PlatformConfigModel = deps.PlatformConfig || PlatformConfig;
  const SystemBootstrapModel = deps.SystemBootstrap || SystemBootstrap;
  const environment = options.environment || process.env.NODE_ENV || "development";
  const actor = options.actor || { id: "cli", role: "system" };
  const serverId = options.serverId || process.env.SERVER_ID || os.hostname();
  const actorId = actor.id || actor.sub || actor._id || "";
  const objectActorId = mongoose.isValidObjectId(actorId) ? actorId : null;

  await writeSecurityAudit({
    action: "PLATFORM_BOOTSTRAP_ATTEMPT",
    status: "SUCCESS",
    actor,
    environment,
    metadata: { bootstrapKey: BOOTSTRAP_KEY, serverId },
    deps,
  });

  const existingLock = await SystemBootstrapModel.findOne({
    bootstrapKey: BOOTSTRAP_KEY,
    bootstrapCompleted: true,
  }).lean();

  if (existingLock) {
    await writeSecurityAudit({
      action: "PLATFORM_BOOTSTRAP_REINITIALIZATION_ATTEMPT",
      status: "BLOCKED",
      reason: "Bootstrap already completed",
      actor,
      environment,
      metadata: {
        bootstrapKey: BOOTSTRAP_KEY,
        bootstrapExecutedAt: existingLock.bootstrapExecutedAt,
      },
      deps,
    });
    throw new AppError("Platform bootstrap has already been completed", 409, "BOOTSTRAP_ALREADY_COMPLETED");
  }

  const created = [];
  const skipped = [];

  for (const defaultConfig of DEFAULT_PLATFORM_CONFIGS) {
    const exists = await PlatformConfigModel.findOne({ key: defaultConfig.key });
    if (exists) {
      skipped.push(defaultConfig.key);
      continue;
    }

    const config = await PlatformConfigModel.create({
      ...defaultConfig,
      ...(objectActorId ? { updatedBy: objectActorId } : {}),
    });
    created.push(config);
  }

  const lock = await SystemBootstrapModel.findOneAndUpdate(
    { bootstrapKey: BOOTSTRAP_KEY },
    {
      $set: {
        bootstrapCompleted: true,
        bootstrapVersion: BOOTSTRAP_VERSION,
        bootstrapExecutedAt: new Date(),
        bootstrapExecutedBy: actorId || "cli",
        environment,
        serverId,
        metadata: {
          createdKeys: created.map((config) => config.key),
          skippedKeys: skipped,
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await writeSecurityAudit({
    action: "PLATFORM_BOOTSTRAP_SUCCESS",
    status: "SUCCESS",
    actor,
    environment,
    metadata: {
      bootstrapId: lock._id,
      createdCount: created.length,
      skippedCount: skipped.length,
      createdKeys: created.map((config) => config.key),
      skippedKeys: skipped,
    },
    deps,
  });

  return {
    bootstrap: lock,
    created,
    skipped,
  };
}

module.exports = {
  BOOTSTRAP_KEY,
  BOOTSTRAP_VERSION,
  DEFAULT_PLATFORM_CONFIGS,
  bootstrapPlatformDefaults,
  hashPayload,
};
