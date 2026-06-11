const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const paymentService = require("../services/payment.service");
const cancellationRefundService = require("../services/cancellation-refund.service");

const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { cartId, shippingAddress } = req.body;
  const result = await paymentService.createRazorpayOrder({
    userId: req.user.sub,
    cartId,
    shippingAddress,
  });
  return ok(res, result, "Razorpay order created");
});

const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, shippingAddress } = req.body;
  const result = await paymentService.verifyRazorpayPayment({
    userId: req.user.sub,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    shippingAddress,
  });
  return res.status(200).json({
    success: true,
    orderId: result.orderId,
    redirectUrl: result.redirectUrl,
    orderGroupId: result.orderGroupId,
    paymentId: result.paymentId,
    orders: result.orders || [],
    payment: result.payment || null,
  });
});

const recordCheckoutFailure = asyncHandler(async (req, res) => {
  const result = await paymentService.recordCheckoutFailure({
    userId: req.user.sub,
    ...req.body,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, result, "Checkout failure recorded");
});

const recordCheckoutOpened = asyncHandler(async (req, res) => {
  const result = await paymentService.recordCheckoutOpened({
    userId: req.user.sub,
    ...req.body,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, result, "Checkout open recorded");
});

const inspectCheckoutOrder = asyncHandler(async (req, res) => {
  const result = await paymentService.inspectCheckoutOrder({
    userId: req.user.sub,
    razorpayOrderId: req.params.razorpayOrderId,
  });
  return ok(res, result, "Checkout order inspection loaded");
});

const refundPayment = asyncHandler(async (req, res) => {
  const result = await paymentService.processRefund({
    orderId: req.body.orderId,
    paymentId: req.body.paymentId,
    amount: req.body.amount,
    reason: req.body.reason,
    notes: req.body.notes,
    actorRole: req.user.role,
  });
  return ok(res, result, "Refund initiated");
});

const listPayments = asyncHandler(async (req, res) => {
  const result = await paymentService.listPayments(req.query);
  return ok(res, result, "Payments loaded");
});

const getRazorpaySettings = asyncHandler(async (req, res) => {
  const result = await paymentService.getGatewayConfig();
  return ok(res, result, "Razorpay settings loaded");
});

const updateRazorpaySettings = asyncHandler(async (req, res) => {
  const result = await paymentService.updateGatewayConfig(req.body || {}, req.user?._id || req.user?.sub || null);
  return ok(res, result, "Razorpay settings updated");
});

const getPaymentDetails = asyncHandler(async (req, res) => {
  const result = await paymentService.getPaymentDetails(req.params.id);
  return ok(res, result, "Payment details loaded");
});

const listRefunds = asyncHandler(async (req, res) => {
  const result = await cancellationRefundService.listRefunds(req.query);
  return ok(res, result, "Refunds loaded");
});

const reviewRefund = asyncHandler(async (req, res) => {
  const result = await cancellationRefundService.processRefundAction(req.params.id, req.user, req.body || {}, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, result, "Refund updated");
});

const getRefundStatus = asyncHandler(async (req, res) => {
  const result = await cancellationRefundService.getRefundStatus(req.params.id, req.user);
  return ok(res, result, "Refund status loaded");
});

module.exports = {
  createRazorpayOrder,
  verifyRazorpayPayment,
  recordCheckoutFailure,
  recordCheckoutOpened,
  inspectCheckoutOrder,
  refundPayment,
  listPayments,
  getRazorpaySettings,
  updateRazorpaySettings,
  getPaymentDetails,
  listRefunds,
  reviewRefund,
  getRefundStatus,
};

