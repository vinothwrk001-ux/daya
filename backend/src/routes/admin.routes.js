const express = require("express");
const path = require("path");
const multer = require("multer");
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
const roleController = require("../modules/staff/controllers/role.controller");
const { roleSchema } = require("../modules/staff/validators");
const pricingController = require("../controllers/pricing.controller");
const codController = require("../controllers/cod.controller");
const homepageContainerController = require("../controllers/homepage-container.controller");
const homepageLayoutController = require("../controllers/homepage-layout.controller");
const shippingConfigRoutes = require("./shippingConfig.routes");
const companyBrandingController = require("../controllers/company-branding.controller");
const { validateBrandingFiles } = require("../utils/validators/company-branding.validation");

const router = express.Router();

const brandingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 7 },
  fileFilter: (_req, file, cb) => {
    const ext = String(path.extname(file.originalname || "") || "").toLowerCase();
    const allowedExt = new Set([".png", ".svg", ".webp", ".ico"]);
    const allowedMime = new Set([
      "image/png",
      "image/svg+xml",
      "image/webp",
      "image/x-icon",
      "image/vnd.microsoft.icon",
    ]);
    if (!allowedExt.has(ext) || !allowedMime.has(file.mimetype)) {
      return cb(new Error("UNSUPPORTED_FILE_TYPE"));
    }
    return cb(null, true);
  },
});

router.use(adminWorkspaceAuthRequired);

router.get(
  "/dashboard",
  requireWorkspacePermission("analytics.read", { legacyPermission: "dashboard:read" }),
  adminController.dashboard
);
router.get("/analytics", requireWorkspacePermission("analytics.read"), adminController.analytics);
router.get("/analytics/products/:id", requireWorkspacePermission("analytics.read"), adminController.productAnalyticsDetail);
router.get("/revenue", requireLegacyAdminPermission("analytics:read"), revenueController.getRevenueSummary);
router.get("/revenue/export", requireLegacyAdminPermission("analytics:read"), revenueController.exportRevenue);
router.get("/daily-revenue", requireWorkspacePermission("analytics.read"), adminController.dailyRevenue);
router.get("/audit-logs", requireLegacyAdminPermission("audit:read"), adminController.listAuditLogs);
router.post(
  "/system/reset-data",
  requireLegacyAdminPermission("settings:update"),
  express.json(),
  adminController.resetPlatformData
);

router.get("/users", requireWorkspacePermission("users.read"), adminController.listUsers);
router.post("/users", requireWorkspacePermission("users.create"), adminController.createUser);
router.patch("/users/:id/block", requireWorkspacePermission("users.update"), adminController.toggleUserBlocked);
router.delete("/users/:id", requireWorkspacePermission("users.delete"), adminController.deleteUser);

router.put("/user/:id/status", requireWorkspacePermission("users.update"), adminController.setUserStatus);

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
router.post("/homepage-containers/media", requireWorkspacePermission("settings.update"), upload.array("images", 20), homepageContainerController.uploadAdminContainerMedia);
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
router.delete("/homepage-builder/layouts/:id", requireWorkspacePermission("settings.update"), homepageLayoutController.deleteAdminLayout);
router.get("/homepage-builder/layouts/:id/versions", requireWorkspacePermission("settings.read"), homepageLayoutController.listAdminLayoutVersions);
router.post("/homepage-builder/layouts/:id/rollback/:versionId", requireWorkspacePermission("settings.update"), homepageLayoutController.rollbackAdminLayoutVersion);
router.post("/homepage-builder/preview", requireWorkspacePermission("settings.read"), express.json(), homepageLayoutController.previewAdminLayout);
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
  "/company-branding",
  requireWorkspacePermission("branding.view", { legacyPermission: "branding:view" }),
  companyBrandingController.getAdminConfig
);
router.post(
  "/company-branding",
  requireWorkspacePermission("branding.create", { legacyPermission: "branding:create" }),
  brandingUpload.fields([
    { name: "primaryLogo", maxCount: 1 },
    { name: "darkLogo", maxCount: 1 },
    { name: "mobileLogo", maxCount: 1 },
    { name: "favicon", maxCount: 1 },
    { name: "emailLogo", maxCount: 1 },
    { name: "invoiceLogo", maxCount: 1 },
    { name: "organizationLogo", maxCount: 1 },
  ]),
  (req, _res, next) => {
    try {
      validateBrandingFiles(req.files || {});
      next();
    } catch (error) {
      next(error);
    }
  },
  companyBrandingController.saveAdminConfig
);
router.put(
  "/company-branding/:id",
  requireWorkspacePermission("branding.update", { legacyPermission: "branding:update" }),
  brandingUpload.fields([
    { name: "primaryLogo", maxCount: 1 },
    { name: "darkLogo", maxCount: 1 },
    { name: "mobileLogo", maxCount: 1 },
    { name: "favicon", maxCount: 1 },
    { name: "emailLogo", maxCount: 1 },
    { name: "invoiceLogo", maxCount: 1 },
    { name: "organizationLogo", maxCount: 1 },
  ]),
  (req, _res, next) => {
    try {
      validateBrandingFiles(req.files || {});
      next();
    } catch (error) {
      next(error);
    }
  },
  companyBrandingController.saveAdminConfig
);
router.delete(
  "/company-branding/logo/:id",
  requireWorkspacePermission("branding.delete", { legacyPermission: "branding:delete" }),
  express.json(),
  companyBrandingController.removeLogo
);
router.get(
  "/company-branding/:id/versions",
  requireWorkspacePermission("branding.view", { legacyPermission: "branding:view" }),
  companyBrandingController.getVersions
);
router.post(
  "/company-branding/:id/rollback/:versionId",
  requireWorkspacePermission("branding.update", { legacyPermission: "branding:update" }),
  companyBrandingController.rollback
);

router.get(
  "/pricing-categories",
  requireWorkspacePermission("settings.read", { legacyPermission: "settings:update" }),
  pricingController.getPricingCategories
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
