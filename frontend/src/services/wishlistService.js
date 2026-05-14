import { api } from "./api";

function extractWishlistPayload(data) {
  return data?.data || data;
}

function notifyWishlistChanged(items) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("wishlist:changed", { detail: { items } }));
}

// ===== AUTHENTICATED USER ENDPOINTS =====

export async function getWishlist() {
  const { data } = await api.get("/api/wishlist");
  return data;
}

export async function checkWishlistStatus(productId) {
  const { data } = await api.get(`/api/wishlist/${productId}/status`);
  return extractWishlistPayload(data);
}

// Legacy name for backward compatibility
export async function getWishlistStatus(productId) {
  return checkWishlistStatus(productId);
}

export async function addToWishlist(productId, variantId = null, selectedAttributes = {}) {
  const { data } = await api.post(`/api/wishlist/${productId}`, {
    variantId,
    selectedAttributes,
  });
  return data;
}

export async function removeFromWishlist(productId) {
  const { data } = await api.delete(`/api/wishlist/${productId}`);
  return data;
}

export async function syncWishlistBadge() {
  const wishlist = await getWishlist();
  const items = Array.isArray(wishlist?.data) ? wishlist.data : Array.isArray(wishlist) ? wishlist : [];
  notifyWishlistChanged(items);
  return items;
}

// ===== GUEST WISHLIST VALIDATION ENDPOINTS =====

/**
 * Validate a product before adding to guest wishlist
 * @param {string} productId
 * @param {string} variantId
 * @returns {Promise<Object>} Validated product info
 */
export async function validateProduct(productId, variantId = "") {
  const { data } = await api.post(`/api/wishlist/${productId}/validate`, { variantId });
  return data?.data || data;
}

/**
 * Check product availability for wishlist
 * @param {string} productId
 * @returns {Promise<Object>} {exists, isAvailable, price, image}
 */
export async function getProductStatus(productId) {
  const { data } = await api.get(`/api/wishlist/${productId}/check`);
  return data?.data || data;
}

/**
 * Validate multiple wishlist items
 * @param {Array} items - Wishlist items
 * @returns {Promise<Object>} {validatedItems, removedItems}
 */
export async function validateWishlistItems(items = []) {
  const { data } = await api.post("/api/wishlist/validate-items", { items });
  return data?.data || data;
}

// ===== WISHLIST MERGE ENDPOINTS (Called after login) =====

/**
 * Merge guest wishlist into authenticated user's wishlist
 * @param {Array} guestWishlistItems - Items from guest localStorage
 * @returns {Promise<Object>} Merge result with userWishlist
 */
export async function mergeGuestWishlist(guestWishlistItems = []) {
  const { data } = await api.post("/api/wishlist/merge", { guestWishlistItems });
  return extractWishlistPayload(data);
}

export const wishlistService = {
  getWishlist,
  checkWishlistStatus,
  getWishlistStatus,
  addToWishlist,
  removeFromWishlist,
  validateProduct,
  getProductStatus,
  validateWishlistItems,
  mergeGuestWishlist,
  syncWishlistBadge,
};

