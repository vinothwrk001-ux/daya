import { api } from "./api";

function extractCartPayload(data) {
  return data?.data || data;
}

function notifyCartChanged(detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("cart:changed", { detail }));
}

// ===== AUTHENTICATED USER ENDPOINTS =====

export async function getCart() {
  const { data } = await api.get("/api/cart");
  return data;
}

export async function addToCart(productId, quantity = 1, variantId = "") {
  const { data } = await api.post("/api/cart/add", { productId, quantity, variantId });
  notifyCartChanged(extractCartPayload(data));
  return data;
}

export async function updateCartItem(productId, quantity, variantId = "") {
  const { data } = await api.patch("/api/cart/update", { productId, quantity, variantId });
  notifyCartChanged(extractCartPayload(data));
  return data;
}

export async function removeCartItem(productId, variantId = "") {
  const { data } = await api.delete("/api/cart/remove", { data: { productId, variantId } });
  notifyCartChanged(extractCartPayload(data));
  return data;
}

export async function clearCart() {
  const { data } = await api.delete("/api/cart/clear");
  notifyCartChanged(extractCartPayload(data));
  return data;
}

// ===== GUEST CART VALIDATION ENDPOINTS =====

/**
 * Validate a single item before adding to guest cart
 * @param {string} productId
 * @param {number} quantity
 * @param {string} variantId
 * @returns {Promise<Object>} Enriched item with price, image, vendor info
 */
export async function validateItem(productId, quantity = 1, variantId = "") {
  const { data } = await api.post("/api/cart/validate-item", {
    productId,
    quantity,
    variantId,
  });
  return data?.data || data;
}

/**
 * Validate multiple items in guest cart
 * @param {Array} items - Array of cart items
 * @returns {Promise<Object>} {validatedItems, errors, totalAmount}
 */
export async function validateCart(items = []) {
  const { data } = await api.post("/api/cart/validate", { items });
  return data?.data || data;
}

/**
 * Get cart summary for guest (item count, total, validation)
 * @param {Array} items - Array of cart items
 * @returns {Promise<Object>} Cart summary
 */
export async function getCartSummary(items = []) {
  const { data } = await api.post("/api/cart/summary", { items });
  return data?.data || data;
}

// ===== CART MERGE ENDPOINTS (Called after login) =====

/**
 * Merge guest cart into authenticated user's cart
 * @param {Array} guestCartItems - Items from guest localStorage
 * @returns {Promise<Object>} Merge result with userCart
 */
export async function mergeGuestCart(guestCartItems = []) {
  const { data } = await api.post("/api/cart/merge", { guestCartItems });
  const payload = extractCartPayload(data);
  notifyCartChanged(payload?.userCart || payload);
  return payload;
}

/**
 * Get merge summary before actually merging
 * @param {Array} guestCartItems - Items from guest localStorage
 * @returns {Promise<Object>} Merge summary
 */
export async function getMergeSummary(guestCartItems = []) {
  const { data } = await api.post("/api/cart/merge-summary", { guestCartItems });
  return extractCartPayload(data);
}

export const cartService = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  validateItem,
  validateCart,
  getCartSummary,
  mergeGuestCart,
  getMergeSummary,
};


