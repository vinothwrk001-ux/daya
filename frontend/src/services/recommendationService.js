import { api } from "./api";
import { adminHttp } from "./adminHttp";

const GUEST_RECENTLY_VIEWED_KEY = "guestRecentlyViewedProducts";

function readGuestRecentlyViewedRaw() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GUEST_RECENTLY_VIEWED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function getProductRecommendations(productId, params = {}) {
  const response = await api.get(`/api/recommendations/product/${productId}`, { params });
  return response.data;
}

export async function getCartRecommendations(productIds = []) {
  const response = await api.get("/api/recommendations/cart", {
    params: {
      productIds: productIds.join(","),
    },
  });
  return response.data;
}

export async function getCheckoutRecommendations(productIds = []) {
  const response = await api.get("/api/recommendations/checkout", {
    params: {
      productIds: productIds.join(","),
    },
  });
  return response.data;
}

export async function getHomeRecommendations() {
  const response = await api.get("/api/recommendations/home");
  return response.data;
}

export async function trackRecentlyViewed(productId) {
  const response = await api.post("/api/recommendations/recently-viewed", { productId });
  return response.data;
}

export function trackGuestRecentlyViewed(product) {
  if (!product?._id || typeof window === "undefined") return [];
  const current = readGuestRecentlyViewedRaw().filter((item) => String(item?._id) !== String(product._id));
  const next = [
    {
      _id: product._id,
      name: product.name,
      category: product.category,
      price: product.price,
      discountPrice: product.discountPrice,
      images: Array.isArray(product.images) ? product.images.slice(0, 1) : [],
      ratings: product.ratings || {},
      stock: product.stock,
    },
    ...current,
  ].slice(0, 20);
  try {
    window.localStorage.setItem(GUEST_RECENTLY_VIEWED_KEY, JSON.stringify(next));
  } catch {
    return next;
  }
  return next;
}

export function getGuestRecentlyViewed() {
  return readGuestRecentlyViewedRaw();
}

export async function trackRecommendationEvent(payload) {
  const response = await api.post("/api/recommendations/events", payload);
  return response.data;
}

export async function getRecommendationSettings() {
  const response = await adminHttp.get("/api/recommendations/admin/settings");
  return response.data;
}

export async function updateRecommendationSettings(payload) {
  const response = await adminHttp.put("/api/recommendations/admin/settings", payload);
  return response.data;
}

export async function previewRecommendations(productId) {
  const response = await adminHttp.get(`/api/recommendations/admin/preview/${productId}`);
  return response.data;
}

export async function rebuildRecommendations() {
  const response = await adminHttp.post("/api/recommendations/admin/rebuild");
  return response.data;
}

export async function clearRecommendationCache() {
  const response = await adminHttp.post("/api/recommendations/admin/cache/clear");
  return response.data;
}

export async function getRecommendationAnalytics(params = {}) {
  const response = await adminHttp.get("/api/recommendations/admin/analytics", { params });
  return response.data;
}
