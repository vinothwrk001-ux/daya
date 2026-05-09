const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const paymentService = require("../services/payment.service");

const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { cartId, shippingAddress, trackingToken } = req.body;
  const result = await paymentService.createRazorpayOrder({
    userId: req.user.sub,
    cartId,
    shippingAddress,
    trackingToken,
  });
  return ok(res, result, "Razorpay order created");
});

const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, shippingAddress, trackingToken } = req.body;
  const result = await paymentService.verifyRazorpayPayment({
    userId: req.user.sub,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    shippingAddress,
    trackingToken,
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

const getPaymentDetails = asyncHandler(async (req, res) => {
  const result = await paymentService.getPaymentDetails(req.params.id);
  return ok(res, result, "Payment details loaded");
});

const listRefunds = asyncHandler(async (req, res) => {
  const result = await paymentService.listRefunds(req.query);
  return ok(res, result, "Refunds loaded");
});

const reviewRefund = asyncHandler(async (req, res) => {
  const result = await paymentService.updateRefundStatus(req.params.id, req.body || {});
  return ok(res, result, "Refund updated");
});

module.exports = {
  createRazorpayOrder,
  verifyRazorpayPayment,
  refundPayment,
  listPayments,
  getPaymentDetails,
  listRefunds,
  reviewRefund,
};

