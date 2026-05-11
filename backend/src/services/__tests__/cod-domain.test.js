const assert = require("node:assert/strict");

const codService = require("../cod.service");

function runTest(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`PASS ${name}`))
    .catch((error) => {
      console.error(`FAIL ${name}`);
      throw error;
    });
}

async function main() {
  await runTest("detects COD fee from pricing charges", async () => {
    const fee = codService.getCodFeeFromCharges([
      { key: "shipping_cost", amount: 50 },
      { key: "cod_fee", amount: 40 },
      { key: "platform_fee", amount: 10 },
    ]);
    assert.equal(fee, 40);
  });

  await runTest("builds immutable order price breakdown with cod fee", async () => {
    const breakdown = codService.buildOrderPriceBreakdown({
      pricingBreakdown: {
        charges: [
          { key: "shipping_cost", amount: 50 },
          { key: "cod_fee", amount: 40 },
          { key: "tax", amount: 20 },
        ],
        chargesTotal: 110,
        calculatedAt: "2026-05-11T00:00:00.000Z",
      },
      subtotal: 1000,
      shippingFee: 50,
      taxAmount: 20,
      totalAmount: 1110,
      paymentMethod: "COD",
    });

    assert.equal(breakdown.subtotal, 1000);
    assert.equal(breakdown.shippingFee, 50);
    assert.equal(breakdown.codFee, 40);
    assert.equal(breakdown.totalAmount, 1110);
    assert.equal(breakdown.paymentMethod, "COD");
  });

  await runTest("matches postal-code driven zone rules", async () => {
    const rule = codService.matchZoneRule(
      {
        zoneRules: [
          { zone: "remote", postalCodes: ["799001"], states: [], isActive: true },
          { zone: "metro", postalCodes: ["600001"], states: ["Tamil Nadu"], isActive: true },
        ],
      },
      { postalCode: "600001", state: "Tamil Nadu" }
    );
    assert.equal(rule.zone, "metro");
  });

  console.log("COD domain checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
