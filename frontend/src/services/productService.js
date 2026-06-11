import { api } from "./api";
import { uploadMarketplaceProductImages } from "./productMediaService";

/**
 * Get all public products (for storefront)
 */
export async function getPublicProducts(params = {}) {
  const response = await api.get("/api/products/public", { params });
  return response.data;
}

export async function getPublicProductFilters(params = {}) {
  const response = await api.get("/api/products/filters", { params });
  return response.data;
}

/**
 * Get single product by ID
 */
export async function getProductById(id) {
  const response = await api.get(`/api/products/${id}`);
  return response.data;
}

export async function getRelatedProducts(productId, limit = 4, categoryId = "") {
  const response = await api.get("/api/products/public", {
    params: {
      page: 1,
      limit: Math.max(Number(limit || 4) + 1, 4),
      ...(categoryId ? { categoryId } : {}),
    },
  });

  const products = Array.isArray(response?.data?.data?.products) ? response.data.data.products : [];
  return {
    data: products.filter((product) => String(product?._id) !== String(productId)).slice(0, limit),
  };
}

/**
 * Get products list (authenticated - role-based)
 */
export async function getProducts(params = {}) {
  const response = await api.get("/api/products", { params });
  return response.data;
}

export async function generateProductNumber(params = {}) {
  const response = await api.get("/api/products/generate-number", { params });
  return response.data;
}

/**
 * Create new product (admin)
 */
export async function createProduct(productData) {
  const response = await api.post("/api/products", productData);
  return response.data;
}

/**
 * Update product
 */
export async function updateProduct(id, updateData) {
  const response = await api.patch(`/api/products/${id}`, updateData);
  return response.data;
}

export async function uploadProductImages(files, metadata = {}, onUploadProgress) {
  return uploadMarketplaceProductImages(files, metadata, onUploadProgress);
}

/**
 * Delete product (soft delete)
 */
export async function deleteProduct(id) {
  const response = await api.delete(`/api/products/${id}`);
  return response.data;
}

/**
 * Get pending products for admin review
 */
export async function getPendingProducts(params = {}) {
  const response = await api.get("/api/products/admin/pending", { params });
  return response.data;
}

/**
 * Approve product (admin only)
 */
export async function approveProduct(id) {
  const response = await api.patch(`/api/products/admin/${id}/approve`);
  return response.data;
}

/**
 * Reject product (admin only)
 */
export async function rejectProduct(id, rejectionReason) {
  const response = await api.patch(`/api/products/admin/${id}/reject`, {
    rejectionReason,
  });
  return response.data;
}

/**
 * Get product statistics (admin only)
 */
export async function getProductStats() {
  const response = await api.get("/api/products/admin/stats");
  return response.data;
}
