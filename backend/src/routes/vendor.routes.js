const express = require("express");
const { authRequired, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { upload } = require("../middleware/upload");
const { requireVendorModule, requireVendorPermission } = require("../middleware/vendorModuleAccess");
const { requireApprovedVendor } = require("../middleware/vendorApproval");
const { influencerCommerceGate } = require("../middleware/influencerCommerceGate");
const vendorController = require("../controllers/vendor.controller");
const {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
} = require("../utils/validators/vendor.validation");
const {
  createProductSchema,
  updateProductSchema,
} = require("../utils/validators/product.validation");
const {
  payoutRequestSchema,
  payoutAccountSchema,
} = require("../utils/validators/payout.validation");
const vendorDashboardController = require("../modules/vendorDashboard/vendor-dashboard.controller");
const vendorPayoutController = require("../controllers/vendorPayout.controller");
const commissionController = require("../controllers/commission.controller");
const productController = require("../controllers/product.controller");
const vendorStorefrontController = require("../controllers/vendor-storefront.controller");
const influencerCommerceRoutes = require("../modules/influencerCommerce/routes");

const router = express.Router();

router.use(authRequired, requireRole("vendor"));

router.post("/step1", validate(step1Schema), vendorController.step1);
router.post(
  "/step2",
  upload.array("documents", 10),
  validate(step2Schema),
  vendorController.step2
);
router.post("/step3", validate(step3Schema), vendorController.step3);
router.post(
  "/step4",
  upload.array("shopImages", 5),
  validate(step4Schema),
  vendorController.step4
);

router.get("/me", vendorController.me);
router.use(requireApprovedVendor);

router.get("/dashboard", vendorDashboardController.getDashboard);
router.post("/settings/media", upload.single("image"), vendorController.uploadStoreMedia);
router.use("/influencer-commerce", influencerCommerceGate, influencerCommerceRoutes);

// 🔥 PRODUCTS MODULE - Protected by vendorModuleAccess
router.route("/products")
  .get(requireVendorModule("products"), vendorDashboardController.listProducts)
  .post(requireVendorPermission("products.create"), validate(createProductSchema), vendorDashboardController.createProduct);
router.post("/products/media", requireVendorPermission("products.create"), upload.array("images", 10), productController.uploadProductImages);
router.route("/products/:id")
  .patch(requireVendorPermission("products.update"), validate(updateProductSchema), vendorDashboardController.updateProduct)
  .delete(requireVendorPermission("products.delete"), vendorDashboardController.deleteProduct);

// 🔥 ORDERS MODULE - Protected by vendorModuleAccess
router.get("/orders", requireVendorModule("orders"), vendorDashboardController.listOrders);
router.get("/orders/:id", requireVendorModule("orders"), vendorDashboardController.getOrderById);
router.patch("/orders/:id/status", requireVendorPermission("orders.update"), vendorDashboardController.updateOrderStatus);
router.post("/orders/:id/ship", requireVendorPermission("orders.update"), vendorDashboardController.markOrderSelfShipped);
router.post("/orders/:id/request-pickup", requireVendorPermission("orders.update"), vendorDashboardController.requestOrderPickup);

// 🔥 INVENTORY MODULE - Protected by vendorModuleAccess
router.get("/inventory", requireVendorModule("inventory"), vendorDashboardController.getInventory);
router.patch("/inventory/:id", requireVendorPermission("inventory.update"), vendorDashboardController.updateInventory);

// 🔥 ANALYTICS MODULE - Protected by vendorModuleAccess
router.get("/analytics", requireVendorModule("analytics"), vendorDashboardController.getAnalytics);
router.get("/analytics/products/:id", requireVendorModule("analytics"), vendorDashboardController.getProductAnalyticsDetail);
router.get("/storefront/analytics", requireVendorModule("analytics"), vendorStorefrontController.vendorAnalytics);

// 🔥 PAYMENTS MODULE - Protected by vendorModuleAccess
router.get("/payouts", requireVendorModule("payments"), vendorDashboardController.getPayouts);
router.get("/wallet", requireVendorModule("payments"), vendorPayoutController.getWallet);
router.get("/ledger", requireVendorModule("payments"), vendorPayoutController.getLedger);
router.get("/commission/summary", requireVendorModule("payments"), commissionController.getVendorSummary);
router.get("/payout-requests", requireVendorModule("payments"), vendorPayoutController.listPayoutRequests);
router.post("/payouts/request", requireVendorPermission("payments.update"), validate(payoutRequestSchema), vendorPayoutController.requestPayout);
router.get("/payout-account", requireVendorModule("payments"), vendorPayoutController.getPayoutAccount);
router.put("/payout-account", requireVendorPermission("payments.update"), validate(payoutAccountSchema), vendorPayoutController.upsertPayoutAccount);

// 🔥 DELIVERY MODULE - Protected by vendorModuleAccess
router.get("/delivery", requireVendorModule("delivery"), vendorDashboardController.getDelivery);
router.patch("/delivery/:id", requireVendorPermission("delivery.update"), vendorDashboardController.updateDelivery);

router.get("/settings/shipping", vendorDashboardController.getShippingSettings);
router.patch("/settings/shipping", vendorDashboardController.updateShippingSettings);
router.route("/settings").get(vendorDashboardController.getSettings).patch(vendorDashboardController.updateSettings);
router.patch("/settings/storefront", vendorStorefrontController.updateVendorStoreSettings);

// 🔥 NOTIFICATIONS - All modules can have notifications
router.get("/notifications", vendorDashboardController.getNotifications);
router.patch("/notifications/:id/read", vendorDashboardController.markNotificationRead);

// 🔥 REVIEWS MODULE - Protected by vendorModuleAccess
router.get("/reviews", requireVendorModule("reviews"), vendorDashboardController.getReviews);
router.post("/reviews/:id/respond", requireVendorPermission("reviews.update"), vendorDashboardController.respondToReview);

// 🔥 RETURNS MODULE - Protected by vendorModuleAccess
router.get("/returns", requireVendorModule("returns"), vendorDashboardController.getReturns);
router.patch("/returns/:id", requireVendorPermission("returns.update"), vendorDashboardController.updateReturnStatus);

router.route("/offers").get(vendorDashboardController.getOffers).post(vendorDashboardController.createOffer);
router.patch("/offers/:id", vendorDashboardController.updateOffer);

router.route("/support").get(vendorDashboardController.getSupportTickets).post(vendorDashboardController.createSupportTicket);
router.post("/support/:id/reply", vendorDashboardController.replyToSupportTicket);

module.exports = router;
