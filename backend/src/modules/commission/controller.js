const { ok } = require("../../utils/apiResponse");
const { asyncHandler } = require("../../utils/asyncHandler");
const commissionService = require("./service");

const wallet = asyncHandler(async (req, res) => ok(res, await commissionService.getInfluencerWallet(req.user.sub), "Influencer wallet loaded"));
const overview = asyncHandler(async (req, res) => ok(res, await commissionService.getOverview(), "Commission overview loaded"));
const earnings = asyncHandler(async (req, res) => ok(res, await commissionService.getInfluencerEarnings(req.user.sub, req.query), "Influencer earnings loaded"));
const withdrawals = asyncHandler(async (req, res) => ok(res, await commissionService.listInfluencerWithdrawals(req.user.sub, req.query), "Influencer withdrawals loaded"));
const requestWithdrawal = asyncHandler(async (req, res) =>
  ok(
    res,
    await commissionService.requestWithdrawal(req.user.sub, req.body, req.user, {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    }),
    "Withdrawal request submitted"
  )
);
const cancelWithdrawal = asyncHandler(async (req, res) =>
  ok(
    res,
    await commissionService.cancelWithdrawal(req.user.sub, req.params.requestId, {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    }),
    "Withdrawal request cancelled"
  )
);
const payoutAccounts = asyncHandler(async (req, res) => ok(res, await commissionService.getInfluencerPayoutAccounts(req.user.sub), "Payout accounts loaded"));
const savePayoutAccount = asyncHandler(async (req, res) =>
  ok(
    res,
    await commissionService.upsertInfluencerPayoutAccount(req.user.sub, req.body, {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    }),
    "Payout account saved"
  )
);

module.exports = {
  wallet,
  overview,
  earnings,
  withdrawals,
  requestWithdrawal,
  cancelWithdrawal,
  payoutAccounts,
  savePayoutAccount,
};
