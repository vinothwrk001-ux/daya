const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const adminService = require("../services/admin.service");
const { AppError } = require("../utils/AppError");
const cancellationPolicyService = require("../services/cancellation-policy.service");
const cancellationRefundService = require("../services/cancellation-refund.service");

const dashboard = asyncHandler(async (req, res) => {
  const summary = await adminService.getDashboardOverview();
  return ok(res, summary, "Dashboard loaded");
});

const analytics = asyncHandler(async (req, res) => {
  const result = await adminService.getAnalytics({
    range: req.query.range,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    categoryId: req.query.categoryId,
    paymentMethod: req.query.paymentMethod,
    orderStatus: req.query.orderStatus,
  });
  return ok(res, result, "Analytics loaded");
});

const productAnalyticsDetail = asyncHandler(async (req, res) => {
  const result = await adminService.getProductAnalyticsDetail(req.params.id, {
    range: req.query.range,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    paymentMethod: req.query.paymentMethod,
    orderStatus: req.query.orderStatus,
  });
  return ok(res, result, "Product analytics loaded");
});

const listUsers = asyncHandler(async (req, res) => {
  const users = await adminService.listUsers({
    role: req.query.role,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  });
  return ok(res, users, "OK");
});

const createUser = asyncHandler(async (req, res) => {
  const user = await adminService.createUser(req.body, req.user, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, user, "User created");
});

const listAuditLogs = asyncHandler(async (req, res) => {
  const logs = await adminService.listAuditLogs({
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 20),
    action: req.query.action,
    actorRole: req.query.actorRole,
    entityType: req.query.entityType,
    status: req.query.status,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  });
  return ok(res, logs, "OK");
});

const setUserStatus = asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!status) throw new AppError("Missing status", 400, "VALIDATION_ERROR");
  const user = await adminService.setUserStatus(req.params.id, status, req.user, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, user, "User updated");
});

const toggleUserBlocked = asyncHandler(async (req, res) => {
  const user = await adminService.toggleUserBlocked(req.params.id, req.user, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, user, "User status updated");
});

const deleteUser = asyncHandler(async (req, res) => {
  const result = await adminService.deleteUser(req.params.id, req.user, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, result, "User deleted");
});

const listOrders = asyncHandler(async (req, res) => {
  const result = await adminService.listOrders({
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 20),
    status: req.query.status,
    paymentStatus: req.query.paymentStatus,
    search: req.query.search,
    includeInactive: req.query.includeInactive === "true",
    sortBy: req.query.sortBy || "createdAt",
    sortOrder: req.query.sortOrder === "asc" ? 1 : -1,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  });
  return ok(res, result, "Orders loaded");
});

const getAdminInventorySummary = asyncHandler(async (req, res) => {
  const result = await adminService.getAdminInventorySummary({
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 20),
    search: req.query.search || "",
  });
  return ok(res, result, "Admin inventory loaded");
});

const getAdminInventoryProduct = asyncHandler(async (req, res) => {
  const result = await adminService.getAdminInventoryProduct(req.params.id);
  return ok(res, result, "Admin product inventory loaded");
});

const getAdminInventoryLedger = asyncHandler(async (req, res) => {
  const result = await adminService.getAdminInventoryLedger(req.params.id, req.params.variantId, {
    limit: Number(req.query.limit || 20),
    offset: Number(req.query.offset || 0),
  });
  return ok(res, result, "Admin inventory ledger loaded");
});

const adjustAdminInventory = asyncHandler(async (req, res) => {
  const result = await adminService.adjustAdminInventory(req.params.id, req.params.variantId, req.body || {}, req.user);
  return ok(res, result, "Admin inventory adjusted");
});

const updateAdminInventoryThreshold = asyncHandler(async (req, res) => {
  const { threshold } = req.body || {};
  if (threshold === undefined) throw new AppError("Threshold value is required", 400, "VALIDATION_ERROR");
  const result = await adminService.updateAdminInventoryThreshold(req.params.id, req.params.variantId, threshold, req.user);
  return ok(res, result, "Admin inventory threshold updated");
});

const listReviews = asyncHandler(async (req, res) => {
  const reviews = await adminService.listReviews({
    search: req.query.search,
  });
  return ok(res, reviews, "Reviews loaded");
});

const getOrderById = asyncHandler(async (req, res) => {
  const order = await adminService.getOrderById(req.params.id);
  return ok(res, order, "Order loaded");
});

const createOrder = asyncHandler(async (req, res) => {
  const result = await adminService.createOrder(req.body, req.user, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, result, "Order created");
});

const updateOrder = asyncHandler(async (req, res) => {
  const order = await adminService.updateOrder(req.params.id, req.body, req.user, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, order, "Order updated");
});

const getShippingModes = asyncHandler(async (req, res) => {
  const config = await adminService.getShippingModes(req.user);
  return ok(res, config, "Shipping modes loaded");
});

const saveShippingModes = asyncHandler(async (req, res) => {
  const config = await adminService.saveShippingModes(req.body, req.user, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, config, "Shipping modes updated");
});

const deleteOrder = asyncHandler(async (req, res) => {
  const order = await adminService.softDeleteOrder(req.params.id, req.user, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, order, "Order deleted");
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!status) throw new AppError("Missing status", 400, "VALIDATION_ERROR");
  const order = await adminService.updateOrderStatus(req.params.id, status, req.user, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, order, "Order updated");
});

const cancelOrder = asyncHandler(async (req, res) => {
  const order = await cancellationRefundService.processOrderCancellation({
    orderId: req.params.id,
    actor: req.user,
    reason: req.body?.reason,
    notes: req.body?.notes,
    previewOnly: Boolean(req.body?.previewOnly),
    meta: {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    },
  });
  return ok(res, order, "Order cancelled");
});

const listCancellationPolicies = asyncHandler(async (req, res) => {
  const result = await cancellationPolicyService.listPolicies();
  return ok(res, result, "Cancellation policies loaded");
});

const createCancellationPolicy = asyncHandler(async (req, res) => {
  const result = await cancellationPolicyService.createPolicy(req.body || {}, req.user?.sub || req.user?._id || null);
  return ok(res, result, "Cancellation policy created");
});

const updateCancellationPolicy = asyncHandler(async (req, res) => {
  const result = await cancellationPolicyService.updatePolicy(req.params.id, req.body || {}, req.user?.sub || req.user?._id || null);
  return ok(res, result, "Cancellation policy updated");
});

const listRefundCases = asyncHandler(async (req, res) => {
  const result = await cancellationRefundService.listRefunds(req.query);
  return ok(res, result, "Refunds loaded");
});

const getRefundCase = asyncHandler(async (req, res) => {
  const result = await cancellationRefundService.getRefundDetails(req.params.id);
  return ok(res, result, "Refund details loaded");
});

const processRefundCase = asyncHandler(async (req, res) => {
  const result = await cancellationRefundService.processRefundAction(req.params.id, req.user, { action: "approve", ...(req.body || {}) }, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, result, "Refund processed");
});

const markManualRefundCase = asyncHandler(async (req, res) => {
  const result = await cancellationRefundService.markManualRefund(req.params.id, req.user, req.body || {}, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, result, "Manual refund marked");
});

const markWalletRefundCase = asyncHandler(async (req, res) => {
  const result = await cancellationRefundService.markWalletRefund(req.params.id, req.user, req.body || {}, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, result, "Wallet refund processed");
});

const retryRefundCase = asyncHandler(async (req, res) => {
  const result = await cancellationRefundService.retryRefund(req.params.id, req.user, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, result, "Refund retry triggered");
});

const deleteReview = asyncHandler(async (req, res) => {
  const result = await adminService.deleteReview(req.params.id, req.user, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, result, "Review deleted");
});

const resetPlatformData = asyncHandler(async (req, res) => {
  const confirmation = req.body?.confirmation;
  if (confirmation !== "RESET ALL DATA") {
    throw new AppError("Invalid confirmation text", 400, "VALIDATION_ERROR");
  }

  const result = await adminService.resetPlatformData();
  return ok(res, result, "Platform data reset completed");
});

const dailyRevenue = asyncHandler(async (req, res) => {
  const days = Number(req.query.days || 7);
  if (days < 1 || days > 90) {
    throw new AppError("Days must be between 1 and 90", 400, "VALIDATION_ERROR");
  }
  const data = await adminService.getDailyRevenue(days);
  return ok(res, data, "Daily revenue loaded");
});

module.exports = {
  dashboard,
  analytics,
  productAnalyticsDetail,
  dailyRevenue,
  listUsers,
  createUser,
  listAuditLogs,
  setUserStatus,
  toggleUserBlocked,
  deleteUser,
  listOrders,
  getAdminInventorySummary,
  getAdminInventoryProduct,
  getAdminInventoryLedger,
  adjustAdminInventory,
  updateAdminInventoryThreshold,
  cancelOrder,
  listCancellationPolicies,
  createCancellationPolicy,
  updateCancellationPolicy,
  listRefundCases,
  getRefundCase,
  processRefundCase,
  markManualRefundCase,
  markWalletRefundCase,
  retryRefundCase,
  listReviews,
  getOrderById,
  createOrder,
  updateOrder,
  getShippingModes,
  saveShippingModes,
  deleteOrder,
  deleteReview,
  resetPlatformData,
  updateOrderStatus,
};
