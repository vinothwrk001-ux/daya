const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const userService = require("../services/user.service");

function getMeta(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  };
}

const getDashboard = asyncHandler(async (req, res) => ok(res, await userService.getDashboard(req.user.sub), "Dashboard loaded"));
const getProfile = asyncHandler(async (req, res) => ok(res, await userService.getProfile(req.user.sub), "Profile loaded"));
const updateProfile = asyncHandler(async (req, res) => ok(res, await userService.updateProfile(req.user.sub, req.body, req.file, getMeta(req)), "Profile updated"));
const changePassword = asyncHandler(async (req, res) => ok(res, await userService.changePassword(req.user.sub, req.body, getMeta(req)), "Password changed"));

const listAddresses = asyncHandler(async (req, res) => ok(res, await userService.listAddresses(req.user.sub), "Addresses loaded"));
const createAddress = asyncHandler(async (req, res) => ok(res, await userService.createAddress(req.user.sub, req.body, getMeta(req)), "Address created"));
const updateAddress = asyncHandler(async (req, res) => ok(res, await userService.updateAddress(req.user.sub, req.params.id, req.body, getMeta(req)), "Address updated"));
const deleteAddress = asyncHandler(async (req, res) => ok(res, await userService.deleteAddress(req.user.sub, req.params.id, getMeta(req)), "Address deleted"));

const listOrders = asyncHandler(async (req, res) => ok(res, await userService.listOrders(req.user.sub, req.query), "Orders loaded"));
const getOrder = asyncHandler(async (req, res) => ok(res, await userService.getOrder(req.user.sub, req.params.id), "Order loaded"));
const getOrderTracking = asyncHandler(async (req, res) => ok(res, await userService.getOrderTracking(req.user.sub, req.params.id), "Tracking loaded"));
const cancelOrder = asyncHandler(async (req, res) => ok(res, await userService.cancelOrder(req.user.sub, req.params.id, getMeta(req)), "Order cancelled"));
const requestReturn = asyncHandler(async (req, res) => ok(res, await userService.requestReturn(req.user.sub, req.params.id, req.body, getMeta(req)), "Return requested"));
const downloadInvoice = asyncHandler(async (req, res) => {
  const invoice = await userService.getInvoice(req.user.sub, req.params.id);
  res.setHeader("Content-Type", invoice.contentType || "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${invoice.filename}"`);
  return res.send(invoice.content);
});

const getCart = asyncHandler(async (req, res) => ok(res, await userService.getCart(req.user.sub), "Cart loaded"));
const updateCartItem = asyncHandler(async (req, res) => ok(res, await userService.updateCartItem(req.user.sub, req.params.productId, req.body.quantity), "Cart updated"));
const removeCartItem = asyncHandler(async (req, res) => ok(res, await userService.removeCartItem(req.user.sub, req.params.productId), "Cart updated"));

const getWishlist = asyncHandler(async (req, res) => ok(res, await userService.getWishlist(req.user.sub), "Wishlist loaded"));
const addToWishlist = asyncHandler(async (req, res) => ok(res, await userService.addToWishlist(req.user.sub, req.params.productId, getMeta(req)), "Added to wishlist"));
const removeFromWishlist = asyncHandler(async (req, res) => ok(res, await userService.removeFromWishlist(req.user.sub, req.params.productId, getMeta(req)), "Removed from wishlist"));
const moveWishlistToCart = asyncHandler(async (req, res) => ok(res, await userService.moveWishlistToCart(req.user.sub, req.params.productId, getMeta(req)), "Wishlist item moved to cart"));

const getBilling = asyncHandler(async (req, res) => ok(res, await userService.getBilling(req.user.sub, req.query), "Billing loaded"));
const listReturns = asyncHandler(async (req, res) => ok(res, await userService.listReturns(req.user.sub), "Returns loaded"));

const listReviews = asyncHandler(async (req, res) => ok(res, await userService.listReviews(req.user.sub), "Reviews loaded"));
const createReview = asyncHandler(async (req, res) => ok(res, await userService.createReview(req.user.sub, req.body, getMeta(req)), "Review created"));
const updateReview = asyncHandler(async (req, res) => ok(res, await userService.updateReview(req.user.sub, req.params.id, req.body, getMeta(req)), "Review updated"));
const deleteReview = asyncHandler(async (req, res) => ok(res, await userService.deleteReview(req.user.sub, req.params.id, getMeta(req)), "Review deleted"));

const listNotifications = asyncHandler(async (req, res) => ok(res, await userService.listNotifications(req.user.sub, req.query), "Notifications loaded"));
const markNotificationRead = asyncHandler(async (req, res) => ok(res, await userService.markNotificationRead(req.user.sub, req.params.id), "Notification updated"));

const listSupportTickets = asyncHandler(async (req, res) => ok(res, await userService.listSupportTickets(req.user.sub), "Support tickets loaded"));
const createSupportTicket = asyncHandler(async (req, res) => ok(res, await userService.createSupportTicket(req.user.sub, req.body, getMeta(req)), "Support ticket created"));
const replySupportTicket = asyncHandler(async (req, res) => ok(res, await userService.replySupportTicket(req.user.sub, req.params.id, req.body, getMeta(req)), "Support ticket updated"));

const listSessions = asyncHandler(async (req, res) => ok(res, await userService.listSessions(req.user.sub), "Sessions loaded"));
const revokeSession = asyncHandler(async (req, res) => ok(res, await userService.revokeSession(req.user.sub, req.params.id, getMeta(req)), "Session revoked"));
const logoutAllDevices = asyncHandler(async (req, res) => ok(res, await userService.logoutAllDevices(req.user.sub, getMeta(req)), "Logged out from all devices"));

const getActivity = asyncHandler(async (req, res) => ok(res, await userService.getActivity(req.user.sub, req.query), "Activity loaded"));

module.exports = {
  getDashboard,
  getProfile,
  updateProfile,
  changePassword,
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  listOrders,
  getOrder,
  getOrderTracking,
  cancelOrder,
  requestReturn,
  downloadInvoice,
  getCart,
  updateCartItem,
  removeCartItem,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  moveWishlistToCart,
  getBilling,
  listReturns,
  listReviews,
  createReview,
  updateReview,
  deleteReview,
  listNotifications,
  markNotificationRead,
  listSupportTickets,
  createSupportTicket,
  replySupportTicket,
  listSessions,
  revokeSession,
  logoutAllDevices,
  getActivity,
};
