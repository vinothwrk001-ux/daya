require("../config/env");

const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const { logger } = require("../utils/logger");
const { bootstrapPlatformDefaults } = require("../services/platform-bootstrap.service");

async function main() {
  await connectDb();
  const result = await bootstrapPlatformDefaults({
    actor: {
      id: process.env.BOOTSTRAP_EXECUTED_BY || "cli",
      role: "system",
    },
    serverId: process.env.SERVER_ID,
  });

  logger.info("Platform bootstrap completed", {
    created: result.created.map((config) => config.key),
    skipped: result.skipped,
  });
}

main()
  .catch((error) => {
    logger.error("Platform bootstrap failed", {
      error: error.message,
      code: error.code,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
