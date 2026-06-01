const { logger } = require("../../utils/logger");
const assert = require("node:assert/strict");
const commissionRuleService = require("../commission-rule.service");

function runTest(name, fn) {
  try {
    fn();
    logger.info("script_output", { value: `PASS ${name}` });
  } catch (error) {
    logger.error("script_error", { error: `FAIL ${name}` });
    throw error;
  }
}

runTest("percentage commission computes expected net", () => {
  const result = commissionRuleService.calculateFromRule({
    subtotal: 1000,
    rule: {
      _id: "rule1",
      name: "Default 10%",
      appliesTo: "global",
      priority: 0,
      type: "percentage",
      value: 10,
    },
  });
  assert.equal(result.commissionAmount, 100);
  assert.equal(result.vendorNetAmount, 900);
});

runTest("fixed commission computes expected net", () => {
  const result = commissionRuleService.calculateFromRule({
    subtotal: 500,
    rule: {
      _id: "rule2",
      name: "Flat 50",
      appliesTo: "vendor",
      priority: 1,
      type: "fixed",
      value: 50,
    },
  });
  assert.equal(result.commissionAmount, 50);
  assert.equal(result.vendorNetAmount, 450);
});

runTest("commission cannot exceed subtotal", () => {
  assert.throws(
    () =>
      commissionRuleService.calculateFromRule({
        subtotal: 200,
        rule: {
          _id: "rule3",
          name: "Too high fixed",
          appliesTo: "product",
          priority: 5,
          type: "fixed",
          value: 500,
        },
      }),
    /cannot exceed item subtotal/i
  );
});

logger.info("script_output", { value: "All commission domain checks passed." });

