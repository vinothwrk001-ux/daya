const express = require("express");
const { authRequired, requireRole } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const { validate } = require("../middleware/validate");
const productController = require("../controllers/product.controller");
const {
  createProductSchema,
  updateProductSchema,
  rejectProductSchema,
} = require("../utils/validators/product.validation");

const router = express.Router();

/**
 * ==========================================
 * PUBLIC ROUTES (No auth required)
 * ==========================================
 */

/**
 * GET /products/public
 * Get all approved and active products (PUBLIC STOREFRONT)
 */
router.get("/public", productController.getPublicProducts);

/**
 * GET /products/filters
 * Get dynamic storefront filters for a category/subcategory
 */
router.get("/filters", productController.getProductFilters);

/**
 * GET /products/generate-number
 * Preview next product number for category + subcategory
 */
router.get("/generate-number", authRequired, requireRole("admin"), productController.generateProductNumber);
router.post(
  "/media",
  authRequired,
  requireRole("admin"),
  upload.array("images", 10),
  productController.uploadProductImages
);

/**
 * GET /products/:id
 * Get single product by ID
 * (Anyone can view approved products)
 */
router.get("/:id", productController.getProductById);

/**
 * ==========================================
 * USER ROUTES (All authenticated users)
 * ==========================================
 */

/**
 * GET /products
 * List products with filtering
 * - Users: see only APPROVED & ACTIVE
 * - Admins: see all
 */
router.get("/", authRequired, requireRole("admin"), productController.getProducts);

/**
 * ==========================================
 * ADMIN PRODUCT MANAGEMENT ROUTES
 * ==========================================
 */

/**
 * POST /products
 * Create a new product
 */
router.post(
  "/",
  authRequired,
  requireRole("admin"),
  validate(createProductSchema),
  productController.createProduct
);

/**
 * PATCH /products/:id
 * Update product
 */
router.patch(
  "/:id",
  authRequired,
  requireRole("admin"),
  validate(updateProductSchema),
  productController.updateProduct
);

/**
 * DELETE /products/:id
 * Delete product (soft delete)
 */
router.delete("/:id", authRequired, requireRole("admin"), productController.deleteProduct);

/**
 * ==========================================
 * ADMIN ROUTES
 * ==========================================
 */

/**
 * GET /admin/products/pending
 * Get all pending products for approval
 * Admin only
 */
router.get(
  "/admin/pending",
  authRequired,
  requireRole("admin"),
  productController.getPendingProducts
);

/**
 * PATCH /admin/products/:id/approve
 * Approve a product
 * Admin only
 */
router.patch(
  "/admin/:id/approve",
  authRequired,
  requireRole("admin"),
  productController.approveProduct
);

/**
 * PATCH /admin/products/:id/reject
 * Reject a product with reason
 * Admin only
 */
router.patch(
  "/admin/:id/reject",
  authRequired,
  requireRole("admin"),
  validate(rejectProductSchema),
  productController.rejectProduct
);

/**
 * GET /admin/products/stats
 * Get product statistics
 * Admin only
 */
router.get(
  "/admin/stats",
  authRequired,
  requireRole("admin"),
  productController.getProductStats
);

module.exports = router;
