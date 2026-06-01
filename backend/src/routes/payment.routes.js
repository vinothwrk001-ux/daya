const express = require("express");
const { authRequired } = require("../middleware/auth");
const { adminWorkspaceAuthRequired, requireWorkspacePermission } = require("../middleware/adminAccess");
const { validate } = require("../middleware/validate");
const paymentController = require("../controllers/payment.controller");
const codController = require("../controllers/cod.controller");
const {
  createRazorpayOrderSchema,
  verifyRazorpayPaymentSchema,
  checkoutFailureSchema,
  checkoutOpenedSchema,
  refundPaymentSchema,
  razorpaySettingsSchema,
} = require("../utils/validators/payment.validation");

const router = express.Router();

router.post("/create-order", authRequired, validate(createRazorpayOrderSchema), paymentController.createRazorpayOrder);
router.post("/verify", authRequired, validate(verifyRazorpayPaymentSchema), paymentController.verifyRazorpayPayment);
router.post("/checkout-opened", authRequired, validate(checkoutOpenedSchema), paymentController.recordCheckoutOpened);
router.post("/checkout-failure", authRequired, validate(checkoutFailureSchema), paymentController.recordCheckoutFailure);
router.get("/checkout-inspect/:razorpayOrderId", authRequired, paymentController.inspectCheckoutOrder);
router.post("/razorpay/create-order", authRequired, validate(createRazorpayOrderSchema), paymentController.createRazorpayOrder);
router.post("/razorpay/verify", authRequired, validate(verifyRazorpayPaymentSchema), paymentController.verifyRazorpayPayment);
router.post("/cod/check", authRequired, codController.checkAvailability);
router.post("/cod/collect", adminWorkspaceAuthRequired, requireWorkspacePermission("payments.update"), codController.collect);
router.get("/settings/razorpay", adminWorkspaceAuthRequired, requireWorkspacePermission("settings.read"), paymentController.getRazorpaySettings);
router.put("/settings/razorpay", adminWorkspaceAuthRequired, requireWorkspacePermission("settings.update"), validate(razorpaySettingsSchema), paymentController.updateRazorpaySettings);
router.post("/refund", adminWorkspaceAuthRequired, requireWorkspacePermission("payments.refund"), validate(refundPaymentSchema), paymentController.refundPayment);
router.get("/", adminWorkspaceAuthRequired, requireWorkspacePermission("payments.read"), paymentController.listPayments);
router.get("/refunds", adminWorkspaceAuthRequired, requireWorkspacePermission("payments.read"), paymentController.listRefunds);
router.patch("/refunds/:id", adminWorkspaceAuthRequired, requireWorkspacePermission("payments.refund"), paymentController.reviewRefund);
router.get("/refund-status/:id", authRequired, paymentController.getRefundStatus);
router.get("/:id", adminWorkspaceAuthRequired, requireWorkspacePermission("payments.read"), paymentController.getPaymentDetails);

module.exports = router;

