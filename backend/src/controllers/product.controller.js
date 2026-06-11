const { ok, fail } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const productService = require("../services/product.service");

function pickDynamicQueryFilters(query = {}) {
  const reserved = new Set([
    "page",
    "limit",
    "category",
    "categoryId",
    "subCategoryId",
    "search",
    "minPrice",
    "maxPrice",
    "sortBy",
    "sortOrder",
    "status",
  ]);

  return Object.fromEntries(
    Object.entries(query).filter(([key]) => !reserved.has(key))
  );
}

/**
 * CREATE PRODUCT
 * POST /products
 * Available for: ADMIN
 */
const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body, req.user.sub);
  return ok(res, product, "Product created and approved");
});

/**
 * GET ALL PRODUCTS
 * GET /products
 * Filters: category, status, page, limit, search, minPrice, maxPrice, sortBy
 * For users: only shows APPROVED & ACTIVE
 * For admins: shows all
 */
const getProducts = asyncHandler(async (req, res) => {
  let filters = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20,
    category: req.query.category,
    categoryId: req.query.categoryId,
    subCategoryId: req.query.subCategoryId,
    search: req.query.search,
    minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
    maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
    sortBy: req.query.sortBy || "createdAt",
    sortOrder: req.query.sortOrder === "asc" ? 1 : -1,
    rawQuery: pickDynamicQueryFilters(req.query),
  };

  if (req.user.role === "user") {
    const result = await productService.getPublicProducts(filters);
    return ok(res, result, "Products retrieved");
  }
  filters.status = req.query.status;
  const result = await productService.getProducts(filters);
  return ok(res, result, "All products retrieved");
});

/**
 * GET PUBLIC PRODUCTS (for storefront)
 * GET /products/public
 * Returns only APPROVED & ACTIVE products
 */
const getPublicProducts = asyncHandler(async (req, res) => {
  const filters = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20,
    category: req.query.category,
    categoryId: req.query.categoryId,
    subCategoryId: req.query.subCategoryId,
    search: req.query.search,
    minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
    maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
    sortBy: req.query.sortBy || "createdAt",
    sortOrder: req.query.sortOrder === "asc" ? 1 : -1,
    rawQuery: pickDynamicQueryFilters(req.query),
  };

  const result = await productService.getPublicProducts(filters);
  return ok(res, result, "Public products retrieved");
});

const getProductFilters = asyncHandler(async (req, res) => {
  const filters = {
    category: req.query.category,
    categoryId: req.query.categoryId,
    subCategoryId: req.query.subCategoryId,
    search: req.query.search,
    minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
    maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
    rawQuery: pickDynamicQueryFilters(req.query),
  };

  const result = await productService.getPublicProductFilters(filters);
  return ok(res, result, "Product filters retrieved");
});

/**
 * GET PRODUCT BY ID
 * GET /products/:id
 */
const getProductById = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.params.id);

  // Record view for public products
  if (product.isActive && product.status === "APPROVED") {
    await productService.recordView(req.params.id);
  }

  return ok(res, product, "Product retrieved");
});

/**
 * UPDATE PRODUCT
 * PUT/PATCH /products/:id
 * Admins can update any product
 */
const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(
    req.params.id,
    req.body,
    req.user.sub
  );

  return ok(res, product, "Product updated");
});

/**
 * DELETE PRODUCT
 * DELETE /products/:id
 * Soft delete - sets isActive to false
 */
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await productService.deleteProduct(
    req.params.id,
    req.user.sub
  );

  return ok(res, product, "Product deleted");
});

/**
 * ADMIN APPROVAL ENDPOINTS
 */

/**
 * GET PENDING PRODUCTS (for admin approval)
 * GET /admin/products/pending
 * Admin only
 */
const getPendingProducts = asyncHandler(async (req, res) => {
  const filters = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20,
  };

  const result = await productService.getPendingProducts(filters);
  return ok(res, result, "Pending products retrieved");
});

/**
 * APPROVE PRODUCT
 * PATCH /admin/products/:id/approve
 * Admin only
 */
const approveProduct = asyncHandler(async (req, res) => {
  const product = await productService.approveProduct(req.params.id, req.user.sub);
  return ok(res, product, "Product approved");
});

/**
 * REJECT PRODUCT
 * PATCH /admin/products/:id/reject
 * Admin only
 * Requires: rejectionReason in body
 */
const rejectProduct = asyncHandler(async (req, res) => {
  const { rejectionReason } = req.body;

  if (!rejectionReason) {
    return fail(res, 400, "Rejection reason is required");
  }

  const product = await productService.rejectProduct(req.params.id, rejectionReason, req.user.sub);
  return ok(res, product, "Product rejected");
});

/**
 * GET PRODUCT STATISTICS
 * GET /admin/products/stats
 * Admin only
 */
const getProductStats = asyncHandler(async (req, res) => {
  const stats = await productService.getProductStats();
  return ok(res, stats, "Product statistics retrieved");
});

const generateProductNumber = asyncHandler(async (req, res) => {
  const productNumber = await productService.previewProductNumber({
    categoryId: req.query.categoryId,
    subCategoryId: req.query.subCategoryId,
  });
  return ok(res, { productNumber }, "Product number generated");
});

const uploadProductImages = asyncHandler(async (req, res) => {
  const context = String(req.body?.context || "product").trim().toLowerCase();
  const folder = context === "variant" ? "product_variants" : "products";
  const images = await productService.uploadProductImages(req.files || [], {
    folder,
    productName: String(req.body?.productName || "").trim(),
    variantTitle: String(req.body?.variantTitle || "").trim(),
  });

  return ok(res, images, "Product images uploaded");
});

module.exports = {
  createProduct,
  getProducts,
  getPublicProducts,
  getProductFilters,
  getProductById,
  updateProduct,
  deleteProduct,
  getPendingProducts,
  approveProduct,
  rejectProduct,
  getProductStats,
  generateProductNumber,
  uploadProductImages,
};
