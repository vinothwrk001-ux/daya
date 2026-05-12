import { api } from "./api";

export async function getWishlist() {
  const { data } = await api.get("/api/wishlist");
  return data;
}

export async function getWishlistStatus(productId) {
  const { data } = await api.get(`/api/wishlist/${productId}/status`);
  return data;
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
