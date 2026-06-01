const { logger } = require("../utils/logger");
require("../config/env");

const { connectDb } = require("../config/db");
const ShippingConfig = require("../models/ShippingConfig");

async function main() {
  await connectDb();

  const payload = {
    state: "Tamil Nadu",
    zone: "LOCAL",
    baseWeight: 1,
    basePrice: 50,
    pricePerKg: 20,
    minWeight: 0.1,
    maxWeight: 5,
    freeShippingThreshold: 500,
    minOrderValue: 0,
    isActive: true,
    notes: "Sample local shipping rule seeded from script",
    sortOrder: 0,
  };

  const existing = await ShippingConfig.findOne({
    state: payload.state,
    zone: payload.zone,
    minWeight: payload.minWeight,
    maxWeight: payload.maxWeight,
  });

  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    logger.info("Shipping rule updated:", { value: existing._id.toString() });
    process.exit(0);
  }

  const created = await ShippingConfig.create(payload);
  logger.info("Shipping rule created:", { value: created._id.toString() });
  process.exit(0);
}

main().catch((error) => {
  logger.error("script_error", { error: error });
  process.exit(1);
});
