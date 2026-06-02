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
const listRules = asyncHandler(async (req, res) => ok(res, await commissionService.listRules(req.query), "Commission rules loaded"));
const createRule = asyncHandler(async (req, res) =>
  ok(
    res,
    await commissionService.createRule(req.body, req.user, {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    }),
    "Commission rule created"
  )
);
const updateRule = asyncHandler(async (req, res) =>
  ok(
    res,
    await commissionService.updateRule(req.params.ruleId, req.body, req.user, {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    }),
    "Commission rule updated"
  )
);
const approveRule = asyncHandler(async (req, res) =>
  ok(
    res,
    await commissionService.approveRule(req.params.ruleId, req.user, {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    }),
    "Commission rule approved"
  )
);
const deactivateRule = asyncHandler(async (req, res) =>
  ok(
    res,
    await commissionService.deactivateRule(req.params.ruleId, req.user, req.body?.reason || "", {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    }),
    "Commission rule deactivated"
  )
);
const simulate = asyncHandler(async (req, res) => ok(res, await commissionService.simulateCommission(req.body), "Commission simulation complete"));
const dashboard = asyncHandler(async (req, res) => ok(res, await commissionService.getAdminDashboard(req.query), "Commission dashboard loaded"));
const createSettlement = asyncHandler(async (req, res) =>
  ok(
    res,
    await commissionService.createSettlement(req.body, req.user, {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    }),
    "Settlement batch created"
  )
);
const listSettlements = asyncHandler(async (req, res) => ok(res, await commissionService.listSettlements(req.query), "Commission settlements loaded"));
const approveSettlement = asyncHandler(async (req, res) =>
  ok(
    res,
    await commissionService.approveSettlement(req.params.settlementId, req.user, {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    }),
    "Settlement approved"
  )
);
const preparePayoutBatch = asyncHandler(async (req, res) =>
  ok(
    res,
    await commissionService.preparePayoutBatch(req.params.settlementId, req.user, {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    }),
    "Payout batch prepared"
  )
);
const auditLogs = asyncHandler(async (req, res) => ok(res, await commissionService.listAuditLogs(req.query), "Commission audit logs loaded"));

module.exports = {
  wallet,
  overview,
  earnings,
  withdrawals,
  requestWithdrawal,
  cancelWithdrawal,
  payoutAccounts,
  savePayoutAccount,
  listRules,
  createRule,
  updateRule,
  approveRule,
  deactivateRule,
  simulate,
  dashboard,
  createSettlement,
  listSettlements,
  approveSettlement,
  preparePayoutBatch,
  auditLogs,
};
