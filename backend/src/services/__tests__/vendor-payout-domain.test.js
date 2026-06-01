const { logger } = require("../../utils/logger");
const assert = require("node:assert/strict");

const {
  applyOrderCredit,
  applyPayoutPayment,
  applyPayoutRejection,
  applyPayoutRequest,
  assertPayoutRequestAllowed,
  assertVerifiedPayoutAccount,
  doesLedgerMatchWallet,
} = require("../vendorFinance.rules");

function runTest(name, fn) {
  try {
    fn();
    logger.info("script_output", { value: `PASS ${name}` });
  } catch (error) {
    logger.error("script_error", { error: `FAIL ${name}` });
    throw error;
  }
}

runTest("cannot request more than available balance", () => {
  assert.throws(
    () =>
      assertPayoutRequestAllowed({
        wallet: { availableBalance: 300 },
        amount: 500,
        minimumAmount: 100,
        hasPendingRequest: false,
      }),
    /exceeds available balance/i
  );
});

runTest("cannot payout to unverified account", () => {
  assert.throws(
    () => assertVerifiedPayoutAccount({ isActive: true, isVerified: false }),
    /not verified/i
  );
});

runTest("reject restores balance correctly", () => {
  const afterRequest = applyPayoutRequest(
    { totalEarnings: 1000, availableBalance: 1000, pendingBalance: 0, withdrawnAmount: 0 },
    500
  );
  const afterReject = applyPayoutRejection(afterRequest, 500);

  assert.deepEqual(afterReject, {
    totalEarnings: 1000,
    availableBalance: 1000,
    pendingBalance: 0,
    withdrawnAmount: 0,
  });
});

runTest("double payout is blocked by pending balance mismatch", () => {
  const afterPayment = applyPayoutPayment(
    { totalEarnings: 1000, availableBalance: 500, pendingBalance: 500, withdrawnAmount: 0 },
    500
  );

  assert.deepEqual(afterPayment, {
    totalEarnings: 1000,
    availableBalance: 500,
    pendingBalance: 0,
    withdrawnAmount: 500,
  });

  assert.throws(
    () => applyPayoutPayment(afterPayment, 500),
    /pending payout balance is insufficient/i
  );
});

runTest("ledger snapshot matches wallet after request and payment lifecycle", () => {
  const afterCredit = applyOrderCredit(
    { totalEarnings: 0, availableBalance: 0, pendingBalance: 0, withdrawnAmount: 0 },
    1200
  );
  const afterRequest = applyPayoutRequest(afterCredit, 700);
  const afterPayment = applyPayoutPayment(afterRequest, 700);

  assert.equal(
    doesLedgerMatchWallet(afterPayment, { walletSnapshot: afterPayment }),
    true
  );
});

logger.info("script_output", { value: "All vendor payout domain checks passed." });
