import { api } from "./api";
import { emitCartChanged, normalizeCartPayload } from "../utils/cartState";
import { bumpCartStateVersion } from "../utils/cartStateVersion";
import { getReelAttribution } from "./reelService";
import { dedupePromise, invalidateDedupePromise } from "../utils/dedupePromise";

const CART_GET_KEY = "cart:get";

function unwrapApiData(responseData) {
  return responseData?.data ?? responseData;
}

function publishCartMutation(cart) {
  const cartStateVersion = bumpCartStateVersion();
  invalidateDedupePromise(CART_GET_KEY);
  const normalized = normalizeCartPayload(cart);
  emitCartChanged(normalized, { cartStateVersion });
  return normalized;
}

// ===== AUTHENTICATED USER ENDPOINTS =====

export async function getCart() {
  return dedupePromise(CART_GET_KEY, async () => {
    const { data } = await api.get("/api/cart");
    return normalizeCartPayload(unwrapApiData(data));
  });
}

export async function addToCart(productId, quantity = 1, variantId = "") {
  const reelAttribution = getReelAttribution();
  const requestBody = {
    productId,
    quantity,
    variantId,
    ...(reelAttribution?.productId === String(productId)
      ? {
          reelAttribution: {
            reelId: reelAttribution.reelId,
            sessionId: reelAttribution.sessionId,
          },
        }
      : {}),
  };
  const { data } = await api.post("/api/cart/add", requestBody);
  const payload = unwrapApiData(data);
  const cart = publishCartMutation(payload);
  return { cart, addedItem: payload?.addedItem || null };
}

export async function updateCartItem(productId, quantity, variantId = "") {
  const { data } = await api.patch("/api/cart/update", { productId, quantity, variantId });
  const cart = publishCartMutation(unwrapApiData(data));
  return cart;
}

export async function removeCartItem(productId, variantId = "") {
  const { data } = await api.delete("/api/cart/remove", { data: { productId, variantId } });
  const cart = publishCartMutation(unwrapApiData(data));
  return cart;
}

export async function clearCart() {
  const { data } = await api.delete("/api/cart/clear");
  const cart = publishCartMutation(unwrapApiData(data));
  return cart;
}

// ===== GUEST CART VALIDATION ENDPOINTS =====

export async function validateItem(productId, quantity = 1, variantId = "") {
  const { data } = await api.post("/api/cart/validate-item", {
    productId,
    quantity,
    variantId,
  });
  return unwrapApiData(data);
}

export async function validateCart(items = []) {
  const { data } = await api.post("/api/cart/validate", { items });
  return unwrapApiData(data);
}

export async function getCartSummary(items = []) {
  const { data } = await api.post("/api/cart/summary", { items });
  return unwrapApiData(data);
}

// ===== CART MERGE ENDPOINTS (Called after login) =====

export async function mergeGuestCart(guestCartItems = []) {
  const { data } = await api.post("/api/cart/merge", { guestCartItems });
  const payload = unwrapApiData(data);
  const userCart = publishCartMutation(payload?.userCart || payload);
  return { ...payload, userCart };
}

export async function getMergeSummary(guestCartItems = []) {
  const { data } = await api.post("/api/cart/merge-summary", { guestCartItems });
  return unwrapApiData(data);
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
