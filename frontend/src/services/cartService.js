import { api } from "./api";
import { emitCartChanged, normalizeCartPayload } from "../utils/cartState";

// ===== AUTHENTICATED USER ENDPOINTS =====

export async function getCart() {
  const { data } = await api.get("/api/cart");
  return normalizeCartPayload(data);
}

export async function addToCart(productId, quantity = 1, variantId = "") {
  const { data } = await api.post("/api/cart/add", { productId, quantity, variantId });
  const payload = data?.data || data;
  const cart = normalizeCartPayload(payload);
  emitCartChanged(cart);
  return { cart, addedItem: payload?.addedItem || null };
}

export async function updateCartItem(productId, quantity, variantId = "") {
  const { data } = await api.patch("/api/cart/update", { productId, quantity, variantId });
  const cart = normalizeCartPayload(data);
  emitCartChanged(cart);
  return cart;
}

export async function removeCartItem(productId, variantId = "") {
  const { data } = await api.delete("/api/cart/remove", { data: { productId, variantId } });
  const cart = normalizeCartPayload(data);
  emitCartChanged(cart);
  return cart;
}

export async function clearCart() {
  const { data } = await api.delete("/api/cart/clear");
  const cart = normalizeCartPayload(data);
  emitCartChanged(cart);
  return cart;
}

// ===== GUEST CART VALIDATION ENDPOINTS =====

/**
 * Validate a single item before adding to guest cart
 * @param {string} productId
 * @param {number} quantity
 * @param {string} variantId
 * @returns {Promise<Object>} Enriched item with price, image, and product info
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
  const payload = data?.data || data;
  const userCart = normalizeCartPayload(payload?.userCart);
  emitCartChanged(userCart);
  return payload;
}

/**
 * Get merge summary before actually merging
 * @param {Array} guestCartItems - Items from guest localStorage
 * @returns {Promise<Object>} Merge summary
 */
export async function getMergeSummary(guestCartItems = []) {
  const { data } = await api.post("/api/cart/merge-summary", { guestCartItems });
  return data?.data || data;
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


