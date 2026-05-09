import { api } from "./api";

/**
 * Get product inventory overview with all variants
 */
export async function getProductInventory(productId) {
  const { data } = await api.get(`/api/inventory/product/${productId}`);
  return data;
}

/**
 * Get specific variant inventory details
 */
export async function getVariantInventory(productId, variantId) {
  const { data } = await api.get(`/api/inventory/product/${productId}/variant/${variantId}`);
  return data;
}

/**
 * Get available stock for a variant
 */
export async function getAvailableStock(productId, variantId) {
  const { data } = await api.get(`/api/inventory/product/${productId}/variant/${variantId}/available`);
  return data;
}

/**
 * Get inventory transaction ledger for a variant
 */
export async function getVariantLedger(productId, variantId, limit = 100, offset = 0) {
  const { data } = await api.get(
    `/api/inventory/product/${productId}/variant/${variantId}/ledger`,
    { params: { limit, offset } }
  );
  return data;
}

/**
 * Get seller's inventory summary (all products)
 */
export async function getSellerInventorySummary() {
  const { data } = await api.get("/api/inventory/seller/summary");
  return data;
}

/**
 * Get seller's low stock variants
 */
export async function getSellersLowStockVariants(limit = 50, offset = 0) {
  const { data } = await api.get("/api/inventory/seller/low-stock", {
    params: { limit, offset },
  });
  return data;
}

/**
 * Manual stock adjustment
 */
export async function adjustStock(productId, variantId, quantityChange, reason, notes = "") {
  const { data } = await api.post(
    `/api/inventory/product/${productId}/variant/${variantId}/adjust`,
    {
      quantityChange,
      reason,
      notes,
    }
  );
  return data;
}

/**
 * Update variant threshold
 */
export async function updateThreshold(productId, variantId, threshold) {
  const { data } = await api.patch(
    `/api/inventory/product/${productId}/variant/${variantId}/threshold`,
    { threshold }
  );
  return data;
}

/**
 * Export product inventory as CSV
 */
export async function exportInventoryCSV(productId) {
  const response = await api.get(`/api/inventory/product/${productId}/export/csv`, {
    responseType: "blob",
  });

  // Create a download link
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `inventory_${productId}.csv`);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);

  return response;
}
