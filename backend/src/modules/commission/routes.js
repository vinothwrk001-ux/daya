const express = require("express");
const Joi = require("joi");
const { authRequired, requireRole } = require("../../middleware/auth");
const { validate } = require("../../middleware/validate");
const controller = require("./controller");

const router = express.Router();

router.get("/wallet", authRequired, requireRole("influencer"), controller.wallet);
router.get("/earnings", authRequired, requireRole("influencer"), controller.earnings);
router.get("/withdrawals", authRequired, requireRole("influencer"), controller.withdrawals);
router.post(
  "/withdrawals",
  authRequired,
  requireRole("influencer"),
  validate(
    Joi.object({
      amount: Joi.number().positive().precision(2).required(),
      payoutAccountId: Joi.string().allow("", null),
      paymentMethod: Joi.string().valid("bank_transfer", "upi", "paypal", "stripe_connect", "wise", "manual").default("bank_transfer"),
      remarks: Joi.string().trim().max(1000).allow("").default(""),
    })
  ),
  controller.requestWithdrawal
);
router.post("/withdrawals/:requestId/cancel", authRequired, requireRole("influencer"), controller.cancelWithdrawal);
router.get("/payout-accounts", authRequired, requireRole("influencer"), controller.payoutAccounts);
router.post(
  "/payout-accounts",
  authRequired,
  requireRole("influencer"),
  validate(
    Joi.object({
      accountHolderName: Joi.string().trim().max(160).allow("", null),
      accountNumber: Joi.string().trim().max(40).allow("", null),
      ifscCode: Joi.string().trim().max(20).allow("", null),
      bankName: Joi.string().trim().max(160).allow("", null),
      upiId: Joi.string().trim().max(160).allow("", null),
      paypalEmail: Joi.string().email().allow("", null),
      paymentMethod: Joi.string().valid("bank_transfer", "upi", "paypal", "stripe_connect", "wise", "manual").default("bank_transfer"),
      updateReason: Joi.string().trim().max(500).allow("").default(""),
    })
  ),
  controller.savePayoutAccount
);
router.get("/admin/overview", authRequired, requireRole("admin", "super_admin", "support_admin", "finance_admin"), controller.overview);

module.exports = router;
