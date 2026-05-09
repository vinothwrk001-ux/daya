const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const adminService = require("../services/admin.service");
const { AppError } = require("../utils/AppError");

const dashboard = asyncHandler(async (req, res) => {
  const summary = await adminService.getDashboardOverview();
  return ok(res, summary, "Dashboard loaded");
});

const analytics = asyncHandler(async (req, res) => {
  const result = await adminService.getAnalytics({
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  });
  return ok(res, result, "Analytics loaded");
});

const listVendors = asyncHandler(async (req, res) => {
  const vendors = await adminService.listVendors({
    status: req.query.status,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  });
  return ok(res, vendors, "OK");
});

const getVendorDetails = asyncHandler(async (req, res) => {
  const vendor = await adminService.getVendorDetails(req.params.id);
  return ok(res, vendor, "OK");
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

const approveVendor = asyncHandler(async (req, res) => {
  const vendor = await adminService.approveVendor(req.params.id, req.user, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, vendor, "Vendor approved");
});

const rejectVendor = asyncHandler(async (req, res) => {
  const reason = req.body?.reason;
  if (reason && typeof reason !== "string") {
    throw new AppError("Invalid rejection reason", 400, "VALIDATION_ERROR");
  }
  const vendor = await adminService.rejectVendor(req.params.id, { reason }, req.user, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, vendor, "Vendor rejected");
});

const removeVendor = asyncHandler(async (req, res) => {
  const result = await adminService.removeVendor(req.params.id, req.user, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, result, "Vendor removed and privileges revoked");
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

const listPayouts = asyncHandler(async (req, res) => {
  const result = await adminService.listPayouts({
    status: req.query.status,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  });
  return ok(res, result, "Payouts loaded");
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
  const order = await adminService.updateOrderStatus(req.params.id, "Cancelled", req.user, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, order, "Order cancelled");
});

const deleteReview = asyncHandler(async (req, res) => {
  const result = await adminService.deleteReview(req.params.id, req.user, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  return ok(res, result, "Review deleted");
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
  dailyRevenue,
  listVendors,
  getVendorDetails,
  listUsers,
  createUser,
  listAuditLogs,
  setUserStatus,
  toggleUserBlocked,
  deleteUser,
  approveVendor,
  rejectVendor,
  removeVendor,
  listOrders,
  getAdminInventorySummary,
  getAdminInventoryProduct,
  getAdminInventoryLedger,
  adjustAdminInventory,
  updateAdminInventoryThreshold,
  cancelOrder,
  listPayouts,
  listReviews,
  getOrderById,
  createOrder,
  updateOrder,
  getShippingModes,
  saveShippingModes,
  deleteOrder,
  deleteReview,
  updateOrderStatus,
};
