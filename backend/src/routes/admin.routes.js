const express = require("express");
const { upload } = require("../middleware/upload");
const {
  adminWorkspaceAuthRequired,
  requireWorkspacePermission,
  requireLegacyAdminPermission,
} = require("../middleware/adminAccess");
const adminController = require("../controllers/admin.controller");
const revenueController = require("../controllers/revenue.controller");
const productController = require("../controllers/product.controller");
const { validate } = require("../middleware/validate");
const { body } = require("express-validator");
const {
  createProductSchema,
  updateProductSchema,
  rejectProductSchema,
} = require("../utils/validators/product.validation");
const { createAdminOrderSchema, updateAdminOrderSchema } = require("../utils/validators/order.validation");
const {
  createCategorySchema,
  updateCategorySchema,
  toggleCategorySchema,
} = require("../utils/validators/category.validation");
const {
  createSubcategorySchema,
  updateSubcategorySchema,
  updateSubcategoryStatusSchema,
} = require("../utils/validators/subcategory.validation");
const categoryController = require("../controllers/category.controller");
const subcategoryController = require("../controllers/subcategory.controller");
const attributeController = require("../controllers/attribute.controller");
const productModuleController = require("../controllers/product-module.controller");
const { createAttributeSchema, updateAttributeSchema } = require("../utils/validators/attribute.validation");
const {
  createProductModuleSchema,
  updateProductModuleSchema,
} = require("../utils/validators/product-module.validation");
const {
  payoutApprovalSchema,
  payoutPaymentSchema,
  payoutRejectionSchema,
  accountRejectionSchema,
} = require("../utils/validators/payout.validation");
const roleController = require("../modules/staff/controllers/role.controller");
const { roleSchema } = require("../modules/staff/validators");
const adminPayoutController = require("../controllers/adminPayout.controller");
const pricingController = require("../controllers/pricing.controller");
const codController = require("../controllers/cod.controller");
const commissionController = require("../controllers/commission.controller");
const homepageContainerController = require("../controllers/homepage-container.controller");
const homepageLayoutController = require("../controllers/homepage-layout.controller");
const shippingConfigRoutes = require("./shippingConfig.routes");

const router = express.Router();

router.use(adminWorkspaceAuthRequired);

router.get(
  "/dashboard",
  requireWorkspacePermission("analytics.read", { legacyPermission: "dashboard:read" }),
  adminController.dashboard
);
router.get("/analytics", requireWorkspacePermission("analytics.read"), adminController.analytics);
router.get("/analytics/products/:id", requireWorkspacePermission("analytics.read"), adminController.productAnalyticsDetail);
router.get("/revenue", requireLegacyAdminPermission("analytics:read"), revenueController.getRevenueSummary);
router.get("/revenue/vendors", requireLegacyAdminPermission("analytics:read"), revenueController.getVendorRevenue);
router.get("/revenue/export", requireLegacyAdminPermission("analytics:read"), revenueController.exportRevenue);
router.get("/daily-revenue", requireWorkspacePermission("analytics.read"), adminController.dailyRevenue);
router.get("/audit-logs", requireLegacyAdminPermission("audit:read"), adminController.listAuditLogs);

router.get("/users", requireWorkspacePermission("users.read"), adminController.listUsers);
router.post("/users", requireWorkspacePermission("users.create"), adminController.createUser);
router.patch("/users/:id/block", requireWorkspacePermission("users.update"), adminController.toggleUserBlocked);
router.delete("/users/:id", requireWorkspacePermission("users.delete"), adminController.deleteUser);

// Backward-compatible user status endpoint
router.put("/user/:id/status", requireWorkspacePermission("users.update"), adminController.setUserStatus);

router.get("/sellers", requireLegacyAdminPermission("vendors:read"), adminController.listVendors);
router.patch("/sellers/:id/approve", requireLegacyAdminPermission("vendors:approve"), adminController.approveVendor);
router.patch("/sellers/:id/reject", requireLegacyAdminPermission("vendors:reject"), express.json(), adminController.rejectVendor);
router.get("/sellers/:id", requireLegacyAdminPermission("vendors:read"), adminController.getVendorDetails);

// Backward-compatible vendor routes
router.get("/vendors", requireLegacyAdminPermission("vendors:read"), adminController.listVendors);
router.get("/vendor/:id", requireLegacyAdminPermission("vendors:read"), adminController.getVendorDetails);
router.put("/vendor/:id/approve", requireLegacyAdminPermission("vendors:approve"), adminController.approveVendor);
router.put("/vendor/:id/reject", requireLegacyAdminPermission("vendors:reject"), express.json(), adminController.rejectVendor);
router.delete("/vendor/:id", requireLegacyAdminPermission("vendors:delete"), adminController.removeVendor);

router.get("/orders", requireWorkspacePermission("orders.read"), adminController.listOrders);
router.get("/inventory", requireWorkspacePermission("products.read"), adminController.getAdminInventorySummary);
router.get("/inventory/:id", requireWorkspacePermission("products.read"), adminController.getAdminInventoryProduct);
router.get("/inventory/:id/variant/:variantId/ledger", requireWorkspacePermission("products.read"), adminController.getAdminInventoryLedger);
router.post("/inventory/:id/variant/:variantId/adjust", requireWorkspacePermission("products.update"), express.json(), adminController.adjustAdminInventory);
router.patch("/inventory/:id/variant/:variantId/threshold", requireWorkspacePermission("products.update"), express.json(), adminController.updateAdminInventoryThreshold);
router.get("/shipping/modes", requireWorkspacePermission("settings.update"), adminController.getShippingModes);
router.patch(
  "/shipping/modes",
  requireWorkspacePermission("settings.update"),
  express.json(),
  validate([
    body("selfShipping").isBoolean().withMessage("selfShipping must be boolean"),
    body("platformShipping").isBoolean().withMessage("platformShipping must be boolean"),
  ]),
  adminController.saveShippingModes
);
router.patch("/orders/:id/status", requireWorkspacePermission("orders.update"), express.json(), adminController.updateOrderStatus);
router.patch("/orders/:id/cancel", requireWorkspacePermission("orders.cancel"), adminController.cancelOrder);
router.post("/orders/:id/cancel", requireWorkspacePermission("orders.cancel"), express.json(), adminController.cancelOrder);
router.get("/orders/:id", requireWorkspacePermission("orders.read"), adminController.getOrderById);
router.get("/cancellation-policies", requireWorkspacePermission("settings.read"), adminController.listCancellationPolicies);
router.post("/cancellation-policy", requireWorkspacePermission("settings.update"), express.json(), adminController.createCancellationPolicy);
router.put("/cancellation-policy/:id", requireWorkspacePermission("settings.update"), express.json(), adminController.updateCancellationPolicy);
router.get("/refunds", requireWorkspacePermission("payments.read"), adminController.listRefundCases);
router.get("/refunds/:id", requireWorkspacePermission("payments.read"), adminController.getRefundCase);
router.post("/refunds/:id/process", requireWorkspacePermission("payments.refund"), express.json(), adminController.processRefundCase);
router.post("/refunds/:id/manual", requireWorkspacePermission("payments.refund"), express.json(), adminController.markManualRefundCase);
router.post("/refunds/:id/wallet", requireWorkspacePermission("payments.refund"), express.json(), adminController.markWalletRefundCase);
router.post("/refunds/:id/retry", requireWorkspacePermission("payments.refund"), express.json(), adminController.retryRefundCase);
router.get("/homepage-containers/schemas", requireWorkspacePermission("settings.read"), homepageContainerController.listContainerSchemas);
router.get("/homepage-containers/schema/:type", requireWorkspacePermission("settings.read"), homepageContainerController.getContainerSchema);
router.post("/homepage-containers/media", requireWorkspacePermission("settings.update"), upload.array("images", 5), homepageContainerController.uploadAdminContainerMedia);
router.post("/homepage-containers/reorder", requireWorkspacePermission("settings.update"), express.json(), homepageContainerController.reorderAdminContainers);
router.post("/homepage-containers/preview", requireWorkspacePermission("settings.read"), express.json(), homepageContainerController.previewAdminContainer);
router.get("/homepage-containers", requireWorkspacePermission("settings.read"), homepageContainerController.listAdminContainers);
router.post("/homepage-containers", requireWorkspacePermission("settings.update"), express.json(), homepageContainerController.createAdminContainer);
router.get("/homepage-containers/:id", requireWorkspacePermission("settings.read"), homepageContainerController.getAdminContainerById);
router.put("/homepage-containers/:id", requireWorkspacePermission("settings.update"), express.json(), homepageContainerController.updateAdminContainer);
router.delete("/homepage-containers/:id", requireWorkspacePermission("settings.update"), homepageContainerController.deleteAdminContainer);
router.get("/homepage-builder/containers", requireWorkspacePermission("settings.read"), homepageLayoutController.listContainerLibrary);
router.get("/homepage-builder/layouts", requireWorkspacePermission("settings.read"), homepageLayoutController.listAdminLayouts);
router.post("/homepage-builder/layouts", requireWorkspacePermission("settings.update"), express.json(), homepageLayoutController.createAdminLayout);
router.get("/homepage-builder/layouts/:id", requireWorkspacePermission("settings.read"), homepageLayoutController.getAdminLayoutById);
router.put("/homepage-builder/layouts/:id/draft", requireWorkspacePermission("settings.update"), express.json(), homepageLayoutController.updateAdminLayoutDraft);
router.post("/homepage-builder/layouts/:id/publish", requireWorkspacePermission("settings.update"), homepageLayoutController.publishAdminLayout);
router.get("/homepage-builder/layouts/:id/versions", requireWorkspacePermission("settings.read"), homepageLayoutController.listAdminLayoutVersions);
router.post("/homepage-builder/layouts/:id/rollback/:versionId", requireWorkspacePermission("settings.update"), homepageLayoutController.rollbackAdminLayoutVersion);
router.post("/homepage-builder/preview", requireWorkspacePermission("settings.read"), express.json(), homepageLayoutController.previewAdminLayout);
router.post("/homepage-builder/media", requireWorkspacePermission("settings.update"), upload.array("images", 10), homepageLayoutController.uploadAdminLayoutMedia);
router.get("/payouts", requireWorkspacePermission("payouts.read"), adminController.listPayouts);
router.get("/payout-accounts", requireWorkspacePermission("payouts.read"), adminPayoutController.listPayoutAccounts);
router.get("/payout-requests", requireWorkspacePermission("payouts.read"), adminPayoutController.listPayoutRequests);
router.get("/payout-requests/:id", requireWorkspacePermission("payouts.read"), adminPayoutController.getPayoutRequestById);
router.post("/payouts/:id/approve", requireWorkspacePermission("payouts.process"), validate(payoutApprovalSchema), adminPayoutController.approvePayoutRequest);
router.post("/payouts/:id/reject", requireWorkspacePermission("payouts.process"), validate(payoutRejectionSchema), adminPayoutController.rejectPayoutRequest);
router.post("/payouts/:id/pay", requireWorkspacePermission("payouts.process"), validate(payoutPaymentSchema), adminPayoutController.payPayoutRequest);
router.get("/vendors/:vendorId/wallet", requireWorkspacePermission("payouts.read"), adminPayoutController.getVendorWallet);
router.get("/vendors/:vendorId/ledger", requireWorkspacePermission("payouts.read"), adminPayoutController.getVendorLedger);
router.get("/vendors/:vendorId/payout-account", requireWorkspacePermission("payouts.read"), adminPayoutController.getVendorPayoutAccount);
router.post("/payout-accounts/:accountId/verify", requireWorkspacePermission("payouts.process"), adminPayoutController.verifyVendorPayoutAccount);
router.post("/payout-accounts/:accountId/reject", requireWorkspacePermission("payouts.process"), validate(accountRejectionSchema), adminPayoutController.rejectVendorPayoutAccount);
router.post("/orders", requireLegacyAdminPermission("orders:create"), validate(createAdminOrderSchema), adminController.createOrder);
router.patch("/orders/:id", requireWorkspacePermission("orders.update"), validate(updateAdminOrderSchema), adminController.updateOrder);
router.delete("/orders/:id", requireLegacyAdminPermission("orders:delete"), adminController.deleteOrder);

// Products routes - IMPORTANT: Specific routes must come before parameter routes
router.get("/products", requireWorkspacePermission("products.read"), productController.getProducts);
router.get("/products/stats", requireWorkspacePermission("products.read"), productController.getProductStats);
router.get("/products/pending", requireWorkspacePermission("products.read"), productController.getPendingProducts);
router.get("/products/generate-number", requireWorkspacePermission("products.create"), productController.generateProductNumber);
router.post("/products/media", requireWorkspacePermission("products.create"), upload.array("images", 10), productController.uploadProductImages);
router.post("/products", requireWorkspacePermission("products.create"), validate(createProductSchema), productController.createProduct);
router.get("/reviews", requireWorkspacePermission("reviews.read"), adminController.listReviews);
router.delete("/reviews/:id", requireWorkspacePermission("reviews.delete"), adminController.deleteReview);

// Parameter-based product routes (after specific routes)
router.get("/products/:id", requireWorkspacePermission("products.read"), productController.getProductById);
router.patch("/products/:id", requireWorkspacePermission("products.update"), validate(updateProductSchema), productController.updateProduct);
router.delete("/products/:id", requireWorkspacePermission("products.delete"), productController.deleteProduct);
router.patch("/products/:id/approve", requireLegacyAdminPermission("products:approve"), productController.approveProduct);
router.patch("/products/:id/reject", requireLegacyAdminPermission("products:reject"), validate(rejectProductSchema), productController.rejectProduct);

router.get(
  "/categories",
  requireWorkspacePermission("products.read", { legacyPermission: "categories:read" }),
  categoryController.getAdminCategories
);
router.post("/categories", requireLegacyAdminPermission("categories:create"), validate(createCategorySchema), categoryController.createCategory);
router.patch("/categories/:id", requireLegacyAdminPermission("categories:update"), validate(updateCategorySchema), categoryController.updateCategory);
router.patch(
  "/categories/:id/toggle",
  requireLegacyAdminPermission("categories:update"),
  validate(toggleCategorySchema),
  categoryController.toggleCategory
);

router.get("/subcategories", requireLegacyAdminPermission("categories:read"), subcategoryController.getAdminSubcategories);
router.post(
  "/subcategories",
  requireLegacyAdminPermission("categories:create"),
  validate(createSubcategorySchema),
  subcategoryController.createSubcategory
);
router.put(
  "/subcategories/:id",
  requireLegacyAdminPermission("categories:update"),
  validate(updateSubcategorySchema),
  subcategoryController.updateSubcategory
);
router.delete("/subcategories/:id", requireLegacyAdminPermission("categories:update"), subcategoryController.deleteSubcategory);
router.patch(
  "/subcategories/:id/status",
  requireLegacyAdminPermission("categories:update"),
  validate(updateSubcategoryStatusSchema),
  subcategoryController.updateSubcategoryStatus
);

router.get("/attributes", requireLegacyAdminPermission("categories:read"), attributeController.getAdminAttributes);
router.post(
  "/attributes",
  requireLegacyAdminPermission("categories:create"),
  validate(createAttributeSchema),
  attributeController.createAttribute
);
router.put(
  "/attributes/:id",
  requireLegacyAdminPermission("categories:update"),
  validate(updateAttributeSchema),
  attributeController.updateAttribute
);
router.delete("/attributes/:id", requireLegacyAdminPermission("categories:update"), attributeController.deleteAttribute);

router.get("/product-modules", requireLegacyAdminPermission("categories:read"), productModuleController.getAdminProductModules);
router.post(
  "/product-modules",
  requireLegacyAdminPermission("categories:create"),
  validate(createProductModuleSchema),
  productModuleController.createProductModule
);
router.put(
  "/product-modules/:id",
  requireLegacyAdminPermission("categories:update"),
  validate(updateProductModuleSchema),
  productModuleController.updateProductModule
);
router.delete(
  "/product-modules/:id",
  requireLegacyAdminPermission("categories:update"),
  productModuleController.deleteProductModule
);

// Role management routes
router.get("/permissions/catalog", requireWorkspacePermission("roles.read"), roleController.getPermissionCatalog);
router.get("/roles", requireWorkspacePermission("roles.read"), roleController.listRoles);
router.get("/roles/:id", requireWorkspacePermission("roles.read"), roleController.getRoleById);
router.post("/roles", requireWorkspacePermission("roles.create"), validate(roleSchema), roleController.createRole);
router.patch("/roles/:id", requireWorkspacePermission("roles.update"), validate(roleSchema), roleController.updateRole);
router.delete("/roles/:id", requireWorkspacePermission("roles.delete"), roleController.deleteRole);

// Pricing configuration routes
router.get(
  "/pricing",
  requireWorkspacePermission("settings.read", { legacyPermission: "settings:update" }),
  pricingController.getAdminPricingConfig
);
router.get(
  "/cod/settings",
  requireWorkspacePermission("settings.read", { legacyPermission: "settings:update" }),
  codController.getSettings
);
router.put(
  "/cod/settings",
  requireWorkspacePermission("settings.update", { legacyPermission: "settings:update" }),
  express.json(),
  codController.updateSettings
);
router.get(
  "/cod/analytics",
  requireWorkspacePermission("analytics.read", { legacyPermission: "dashboard:read" }),
  codController.getAnalytics
);
router.put(
  "/pricing/:id",
  requireWorkspacePermission("settings.update", { legacyPermission: "settings:update" }),
  pricingController.updatePricingConfig
);
router.post(
  "/pricing/initialize",
  requireWorkspacePermission("settings.create", { legacyPermission: "settings:update" }),
  pricingController.initializePricingConfig
);

// Dynamic Pricing Rules endpoints (NEW)
router.get(
  "/pricing-rules",
  requireWorkspacePermission("settings.read", { legacyPermission: "settings:update" }),
  pricingController.getAllPricingRules
);
router.post(
  "/pricing-rules",
  requireWorkspacePermission("settings.create", { legacyPermission: "settings:update" }),
  express.json(),
  pricingController.createPricingRule
);
router.get(
  "/pricing-rules/:id",
  requireWorkspacePermission("settings.read", { legacyPermission: "settings:update" }),
  pricingController.getPricingRule
);
router.put(
  "/pricing-rules/:id",
  requireWorkspacePermission("settings.update", { legacyPermission: "settings:update" }),
  express.json(),
  pricingController.updatePricingRule
);
router.patch(
  "/pricing-rules/:id/active",
  requireWorkspacePermission("settings.update", { legacyPermission: "settings:update" }),
  express.json(),
  pricingController.togglePricingRuleActive
);
router.delete(
  "/pricing-rules/:id",
  requireWorkspacePermission("settings.delete", { legacyPermission: "settings:update" }),
  pricingController.deletePricingRule
);
router.patch(
  "/pricing-rules/batch/toggle-active",
  requireWorkspacePermission("settings.update", { legacyPermission: "settings:update" }),
  express.json(),
  pricingController.toggleMultipleRulesActive
);

router.get(
  "/pricing-categories",
  requireWorkspacePermission("settings.read", { legacyPermission: "settings:update" }),
  pricingController.getPricingCategories
);

router.get(
  "/commission/rules",
  requireWorkspacePermission("settings.read", { legacyPermission: "settings:update" }),
  commissionController.listRules
);
router.post(
  "/commission/rules",
  requireWorkspacePermission("settings.update", { legacyPermission: "settings:update" }),
  express.json(),
  commissionController.createRule
);
router.put(
  "/commission/rules/:id",
  requireWorkspacePermission("settings.update", { legacyPermission: "settings:update" }),
  express.json(),
  commissionController.updateRule
);
router.patch(
  "/commission/rules/:id/active",
  requireWorkspacePermission("settings.update", { legacyPermission: "settings:update" }),
  express.json(),
  commissionController.toggleRule
);
router.delete(
  "/commission/rules/:id",
  requireWorkspacePermission("settings.update", { legacyPermission: "settings:update" }),
  commissionController.deleteRule
);
router.get(
  "/commission/analytics",
  requireWorkspacePermission("analytics.read", { legacyPermission: "dashboard:read" }),
  commissionController.getAdminAnalytics
);
router.post(
  "/pricing-categories",
  requireWorkspacePermission("settings.create", { legacyPermission: "settings:update" }),
  express.json(),
  pricingController.createPricingCategory
);
router.put(
  "/pricing-categories/:id",
  requireWorkspacePermission("settings.update", { legacyPermission: "settings:update" }),
  express.json(),
  pricingController.updatePricingCategory
);
router.delete(
  "/pricing-categories/:id",
  requireWorkspacePermission("settings.delete", { legacyPermission: "settings:update" }),
  pricingController.deletePricingCategory
);

// Shipping Configuration routes
router.use("/shipping-config", shippingConfigRoutes);

module.exports = router;
