import { api } from "./api";
import { adminHttp } from "./adminHttp";

const REEL_SESSION_KEY = "reel_attribution_session";

export function getReelSessionId() {
  if (typeof window === "undefined") return "";
  let sessionId = window.sessionStorage.getItem(REEL_SESSION_KEY);
  if (!sessionId) {
    sessionId = `reel_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(REEL_SESSION_KEY, sessionId);
  }
  return sessionId;
}

export function setReelAttribution({ reelId, productId, sessionId }) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    "reel_attribution",
    JSON.stringify({
      reelId,
      productId,
      sessionId: sessionId || getReelSessionId(),
      clickedAt: Date.now(),
    })
  );
}

export function getReelAttribution() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem("reel_attribution");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearReelAttribution() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem("reel_attribution");
}

export async function listReels(params = {}) {
  const response = await api.get("/api/reels", { params });
  return response.data.data;
}

export async function getReel(reelId) {
  const response = await api.get(`/api/reels/${reelId}`);
  return response.data.data;
}

export async function trackReelView(reelId, payload) {
  const response = await api.post(`/api/reels/${reelId}/view`, payload);
  return response.data.data;
}

export async function likeReel(reelId) {
  const response = await api.post(`/api/reels/${reelId}/like`);
  return response.data.data;
}

export async function unlikeReel(reelId) {
  const response = await api.delete(`/api/reels/${reelId}/like`);
  return response.data.data;
}

export async function commentReel(reelId, payload) {
  const response = await api.post(`/api/reels/${reelId}/comments`, payload);
  return response.data.data;
}

export async function listReelComments(reelId, params = {}) {
  const response = await api.get(`/api/reels/${reelId}/comments`, { params });
  return response.data.data;
}

export async function shareReel(reelId, payload) {
  const response = await api.post(`/api/reels/${reelId}/share`, payload);
  return response.data.data;
}

export async function saveReel(reelId) {
  const response = await api.post(`/api/reels/${reelId}/save`);
  return response.data.data;
}

export async function unsaveReel(reelId) {
  const response = await api.delete(`/api/reels/${reelId}/save`);
  return response.data.data;
}

export async function listSavedReels(params = {}) {
  const response = await api.get("/api/reels/saved", { params });
  return response.data.data;
}

export async function trackReelProductClick(reelId, payload) {
  const response = await api.post(`/api/reels/${reelId}/product-click`, payload);
  return response.data.data;
}

export async function trackReelProductView(reelId, payload) {
  const response = await api.post(`/api/reels/${reelId}/product-view`, payload);
  return response.data.data;
}

export async function deleteOwnReelComment(reelId, commentId) {
  const response = await api.delete(`/api/reels/${reelId}/comments/${commentId}`);
  return response.data.data;
}

export async function trackReelCart(payload) {
  const response = await api.post("/api/reels/track/cart", payload);
  return response.data.data;
}

export async function trackReelProductWidgetOpen(reelId, payload) {
  const response = await api.post(`/api/reels/${reelId}/product-widget-open`, payload);
  return response.data.data;
}

export async function getReelProducts(reelId) {
  const response = await api.get(`/api/reels/${reelId}/products`);
  return response.data.data;
}

export async function getAdminReelProducts(reelId) {
  const response = await adminHttp.get(`/api/reels/admin/${reelId}/products`);
  return response.data.data;
}

export async function setAdminReelProducts(reelId, payload) {
  const response = await adminHttp.put(`/api/reels/admin/${reelId}/products`, payload);
  return response.data.data;
}

export async function addAdminReelProducts(reelId, payload) {
  const response = await adminHttp.post(`/api/reels/admin/${reelId}/products`, payload);
  return response.data.data;
}

export async function removeAdminReelProduct(reelId, productId) {
  const response = await adminHttp.delete(`/api/reels/admin/${reelId}/products/${productId}`);
  return response.data.data;
}

export async function getReelsPerformance(params = {}) {
  const response = await adminHttp.get("/api/reels/admin/analytics/performance", { params });
  return response.data.data;
}

export async function listAdminReels(params = {}) {
  const response = await adminHttp.get("/api/reels/admin/list", { params });
  return response.data.data;
}

export async function getAdminReel(reelId) {
  const response = await adminHttp.get(`/api/reels/admin/${reelId}`);
  return response.data.data;
}

export async function createAdminReel(formData) {
  const response = await adminHttp.post("/api/reels/admin", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.data;
}

export async function updateAdminReel(reelId, formData) {
  const response = await adminHttp.put(`/api/reels/admin/${reelId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.data;
}

export async function deleteAdminReel(reelId) {
  const response = await adminHttp.delete(`/api/reels/admin/${reelId}`);
  return response.data.data;
}

export async function publishAdminReel(reelId) {
  const response = await adminHttp.post(`/api/reels/admin/${reelId}/publish`);
  return response.data.data;
}

export async function getReelsAnalytics() {
  const response = await adminHttp.get("/api/reels/admin/analytics");
  return response.data.data;
}

export async function getReelsAttribution(params = {}) {
  const response = await adminHttp.get("/api/reels/admin/attribution", { params });
  return response.data.data;
}

export async function deleteAdminReelComment(reelId, commentId) {
  const response = await adminHttp.delete(`/api/reels/admin/${reelId}/comments/${commentId}`);
  return response.data.data;
}
