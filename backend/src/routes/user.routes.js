const express = require("express");
const { authRequired, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { upload } = require("../middleware/upload");
const userController = require("../controllers/user.controller");
const {
  profileSchema,
  changePasswordSchema,
  addressSchema,
  addressUpdateSchema,
  returnRequestSchema,
  reviewSchema,
  reviewUpdateSchema,
  supportTicketSchema,
  supportReplySchema,
} = require("../utils/validators/user.validation");

const router = express.Router();

router.use(authRequired, requireRole("user"));

router.get("/dashboard", userController.getDashboard);

router.get("/profile", userController.getProfile);
router.patch("/profile", upload.single("avatar"), validate(profileSchema), userController.updateProfile);
router.post("/security/change-password", validate(changePasswordSchema), userController.changePassword);

router.get("/addresses", userController.listAddresses);
router.post("/addresses", validate(addressSchema), userController.createAddress);
router.patch("/addresses/:id", validate(addressUpdateSchema), userController.updateAddress);
router.delete("/addresses/:id", userController.deleteAddress);

router.get("/orders", userController.listOrders);
router.get("/orders/:id", userController.getOrder);
router.get("/orders/:id/tracking", userController.getOrderTracking);
router.get("/orders/:id/invoice", userController.downloadInvoice);
router.post("/orders/:id/cancel", userController.cancelOrder);
router.patch("/orders/:id/cancel", userController.cancelOrder);
router.post("/orders/:id/return", validate(returnRequestSchema), userController.requestReturn);

router.get("/cart", userController.getCart);
router.patch("/cart/items/:productId", userController.updateCartItem);
router.delete("/cart/items/:productId", userController.removeCartItem);

router.get("/wishlist", userController.getWishlist);
router.post("/wishlist/:productId", userController.addToWishlist);
router.delete("/wishlist/:productId", userController.removeFromWishlist);
router.post("/wishlist/:productId/move-to-cart", userController.moveWishlistToCart);

router.get("/billing", userController.getBilling);
router.get("/returns", userController.listReturns);

router.get("/reviews/eligible", userController.listReviewableProducts);
router.get("/reviews", userController.listReviews);
router.post("/reviews", upload.array("photos", 10), validate(reviewSchema), userController.createReview);
router.patch("/reviews/:id", upload.array("photos", 10), validate(reviewUpdateSchema), userController.updateReview);
router.delete("/reviews/:id", userController.deleteReview);

router.get("/notifications", userController.listNotifications);
router.patch("/notifications/:id/read", userController.markNotificationRead);

router.get("/support", userController.listSupportTickets);
router.post("/support", validate(supportTicketSchema), userController.createSupportTicket);
router.post("/support/:id/reply", validate(supportReplySchema), userController.replySupportTicket);

router.get("/security/sessions", userController.listSessions);
router.delete("/security/sessions/:id", userController.revokeSession);
router.post("/security/logout-all", userController.logoutAllDevices);

router.get("/activity", userController.getActivity);

module.exports = router;
