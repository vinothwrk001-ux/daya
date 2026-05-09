const express = require("express");
const { authRequired } = require("../middleware/auth");
const { adminWorkspaceAuthRequired, requireWorkspacePermission } = require("../middleware/adminAccess");
const paymentController = require("../controllers/payment.controller");

const router = express.Router();

router.post("/create-order", authRequired, paymentController.createRazorpayOrder);
router.post("/verify", authRequired, paymentController.verifyRazorpayPayment);
router.post("/refund", adminWorkspaceAuthRequired, requireWorkspacePermission("payments.refund"), paymentController.refundPayment);
router.get("/", adminWorkspaceAuthRequired, requireWorkspacePermission("payments.read"), paymentController.listPayments);
router.get("/refunds", adminWorkspaceAuthRequired, requireWorkspacePermission("payments.read"), paymentController.listRefunds);
router.patch("/refunds/:id", adminWorkspaceAuthRequired, requireWorkspacePermission("payments.refund"), paymentController.reviewRefund);
router.get("/:id", adminWorkspaceAuthRequired, requireWorkspacePermission("payments.read"), paymentController.getPaymentDetails);

module.exports = router;

