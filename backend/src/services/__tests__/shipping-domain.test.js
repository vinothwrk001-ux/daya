const { logger } = require("../../utils/logger");
const assert = require("node:assert/strict");

const ShippingConfig = require("../../models/ShippingConfig");
const { calculateCartWeight } = require("../../utils/cartWeightCalculator");
const { resolveZoneFromMatrix } = require("../shipping-zone-config.service");

function runTest(name, fn) {
  try {
    fn();
    logger.info("script_output", { value: `PASS ${name}` });
  } catch (error) {
    logger.error("script_error", { error: `FAIL ${name}` });
    throw error;
  }
}

runTest("cart weight uses structured product weight and quantity", () => {
  const total = calculateCartWeight([
    { quantity: 2, product: { name: "Product A", weight: { value: 0.5, unit: "kg" } } },
    { quantity: 1, product: { name: "Product B", weight: { value: 1, unit: "kg" } } },
  ]);

  assert.equal(total, 2);
});

runTest("zone matrix resolves by city before defaulting", () => {
  const result = resolveZoneFromMatrix(
    {
      states: [
        {
          state: "Tamil Nadu",
          defaultZone: "REGIONAL",
          zones: {
            LOCAL: { cities: ["chennai"], districts: [], pincodes: [] },
            REGIONAL: { cities: ["salem"], districts: [], pincodes: [] },
            REMOTE: { cities: [], districts: ["nilgiris"], pincodes: ["643001"] },
          },
        },
      ],
    },
    {
      state: "Tamil Nadu",
      city: "Chennai",
      postalCode: "600001",
    }
  );

  assert.equal(result.zone, "LOCAL");
  assert.equal(result.matchedOn, "city");
});

runTest("shipping rule applies base price up to base weight", () => {
  const rule = new ShippingConfig({
    state: "Tamil Nadu",
    zone: "LOCAL",
    baseWeight: 1,
    basePrice: 50,
    pricePerKg: 20,
    minWeight: 0.1,
    maxWeight: 5,
  });

  assert.equal(rule.calculateCost(0.5), 50);
});

runTest("shipping rule applies per-kg pricing above base weight", () => {
  const rule = new ShippingConfig({
    state: "Tamil Nadu",
    zone: "LOCAL",
    baseWeight: 1,
    basePrice: 50,
    pricePerKg: 20,
    minWeight: 0.1,
    maxWeight: 5,
  });

  assert.equal(rule.calculateCost(3), 90);
});

runTest("cart weight preserves gram precision in kg values", () => {
  const total = calculateCartWeight([
    { quantity: 1, product: { name: "Product A", weight: { value: 0.1, unit: "kg" } } },
    { quantity: 1, product: { name: "Product B", weight: { value: 0.25, unit: "kg" } } },
  ]);

  assert.equal(total, 0.35);
});

logger.info("script_output", { value: "All shipping domain checks passed." });
