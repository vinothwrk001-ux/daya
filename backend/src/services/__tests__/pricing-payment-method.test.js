const { logger } = require("../../utils/logger");
const assert = require("node:assert/strict");

const PricingRule = require("../../models/PricingRule");
const pricingCategoryService = require("../pricing-category.service");
const pricingService = require("../pricing.service");

function runTest(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      logger.info("script_output", { value: `PASS ${name}` });
    })
    .catch((error) => {
      logger.error("script_error", { error: `FAIL ${name}` });
      throw error;
    });
}

function createQueryStub(rules) {
  return {
    populate() {
      return this;
    },
    sort() {
      return this;
    },
    lean() {
      return Promise.resolve(rules);
    },
  };
}

const originalFind = PricingRule.find;
const originalEnsureDefaultPricingCategoriesIfNeeded =
  pricingCategoryService.ensureDefaultPricingCategoriesIfNeeded;

pricingCategoryService.ensureDefaultPricingCategoriesIfNeeded = async () => {};

const stubRules = [
  {
    _id: "rule_all",
    key: "platform_fee",
    displayName: "Platform Fee",
    category: "FEE",
    categoryId: null,
    type: "FIXED",
    value: 10,
    appliesTo: "ORDER",
    paymentMethod: "ALL",
    isActive: true,
    isArchived: false,
    sortOrder: 1,
    minOrderValue: 0,
    freeAboveValue: 0,
    maxCap: 0,
  },
  {
    _id: "rule_online",
    key: "gateway_fee",
    displayName: "Gateway Fee",
    category: "PAYMENT",
    categoryId: null,
    type: "FIXED",
    value: 5,
    appliesTo: "ORDER",
    paymentMethod: "ONLINE",
    isActive: true,
    isArchived: false,
    sortOrder: 2,
    minOrderValue: 0,
    freeAboveValue: 0,
    maxCap: 0,
  },
  {
    _id: "rule_cod",
    key: "cod_fee",
    displayName: "COD Fee",
    category: "PAYMENT",
    categoryId: null,
    type: "FIXED",
    value: 15,
    appliesTo: "ORDER",
    paymentMethod: "COD",
    isActive: true,
    isArchived: false,
    sortOrder: 3,
    minOrderValue: 0,
    freeAboveValue: 0,
    maxCap: 0,
  },
  {
    _id: "rule_legacy",
    key: "legacy_packaging",
    displayName: "Legacy Packaging",
    category: "FEE",
    categoryId: null,
    type: "FIXED",
    value: 3,
    appliesTo: "ORDER",
    isActive: true,
    isArchived: false,
    sortOrder: 4,
    minOrderValue: 0,
    freeAboveValue: 0,
    maxCap: 0,
  },
];

PricingRule.find = (query) => {
  const paymentMethods = new Set(
    Array.isArray(query?.$or)
      ? query.$or
          .map((condition) => {
            if (
              condition.paymentMethod &&
              typeof condition.paymentMethod === "object" &&
              condition.paymentMethod.$exists === false
            ) {
              return "__LEGACY__";
            }
            if (typeof condition.paymentMethod === "string") {
              return condition.paymentMethod;
            }
            return null;
          })
          .filter(Boolean)
      : []
  );

  const filteredRules = stubRules.filter((rule) => {
    const rulePaymentMethod = rule.paymentMethod || "__LEGACY__";
    return paymentMethods.size === 0 || paymentMethods.has(rulePaymentMethod);
  });

  return createQueryStub(filteredRules);
};

async function main() {
  await runTest("ONLINE payment applies online, all, and legacy pricing rules", async () => {
    const result = await pricingService.calculateOrderTotal(100, 1, "ONLINE");

    assert.equal(result.total, 118);
    assert.deepEqual(
      result.charges.map((charge) => charge.key),
      ["platform_fee", "gateway_fee", "legacy_packaging"]
    );
    assert.equal(result.paymentMethod, "ONLINE");
  });

  await runTest("COD payment applies cod, all, and legacy pricing rules", async () => {
    const result = await pricingService.calculateOrderTotal(100, 1, "COD");

    assert.equal(result.total, 128);
    assert.deepEqual(
      result.charges.map((charge) => charge.key),
      ["platform_fee", "cod_fee", "legacy_packaging"]
    );
    assert.equal(result.paymentMethod, "COD");
  });

  await runTest("missing payment method keeps backward-compatible all-plus-legacy behavior", async () => {
    const result = await pricingService.calculateOrderTotal(100, 1);

    assert.equal(result.total, 113);
    assert.deepEqual(
      result.charges.map((charge) => charge.key),
      ["platform_fee", "legacy_packaging"]
    );
    assert.equal(result.paymentMethod, "ALL");
  });

  logger.info("script_output", { value: "All pricing payment-method checks passed." });
}

process.on("exit", () => {
  PricingRule.find = originalFind;
  pricingCategoryService.ensureDefaultPricingCategoriesIfNeeded =
    originalEnsureDefaultPricingCategoriesIfNeeded;
});

main().catch((error) => {
  logger.error("script_error", { error: error });
  process.exitCode = 1;
});
