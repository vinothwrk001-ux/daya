const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const orderService = require("../services/order.service");
const cancellationRefundService = require("../services/cancellation-refund.service");

const create = asyncHandler(async (req, res) => {
  const orders = await orderService.createFromCart(req.user.sub, req.body || {});
  return ok(res, orders, "Orders created");
});

const listUser = asyncHandler(async (req, res) => {
  const result = await orderService.listForUser(req.user.sub, {
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
  });
  return ok(res, result, "Orders loaded");
});

const getById = asyncHandler(async (req, res) => {
  const order = await orderService.getForUser(req.user.sub, req.params.id);
  return ok(res, order, "Order loaded");
});

const track = asyncHandler(async (req, res) => {
  const order = await orderService.getForUser(req.user.sub, req.params.id);
  const tracking = {
    orderId: order._id,
    status: order.status,
    deliveryStatus: order.deliveryStatus,
    shippingMode: order.shippingMode,
    shippingStatus: order.shippingStatus,
    pickupStatus: order.pickupStatus,
    courierName: order.courierName,
    shipmentId: order.shipmentId,
    deliveryPartner: order.deliveryPartner,
    trackingId: order.trackingId,
    trackingUrl: order.trackingUrl,
    timeline: order.timeline,
  };
  return ok(res, tracking, "Tracking info loaded");
});

const cancel = asyncHandler(async (req, res) => {
  const order = await cancellationRefundService.processOrderCancellation({
    orderId: req.params.id,
    actor: req.user,
    meta: {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    },
    reason: req.body?.reason,
    notes: req.body?.notes,
    previewOnly: Boolean(req.body?.previewOnly),
  });
  return ok(res, order, "Order cancelled");
});

const requestReturn = asyncHandler(async (req, res) => {
  const order = await orderService.requestReturnForUser(req.user.sub, req.params.id);
  return ok(res, order, "Return requested");
});

const updatePaymentStatus = asyncHandler(async (req, res) => {
  const { paymentStatus } = req.body || {};
  const order = await orderService.updatePaymentStatus({
    userId: req.user.sub,
    orderId: req.params.id,
    paymentStatus,
  });
  return ok(res, order, "Payment updated");
});

module.exports = {
  create,
  listUser,
  getById,
  track,
  cancel,
  requestReturn,
  updatePaymentStatus,
};

