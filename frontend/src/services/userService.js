import { api } from "./api";

export async function getUserDashboard() {
  const { data } = await api.get("/api/user/dashboard");
  return data;
}

export async function getUserProfile() {
  const { data } = await api.get("/api/user/profile");
  return data;
}

export async function updateUserProfile(payload, { isFormData = false } = {}) {
  const { data } = await api.patch("/api/user/profile", payload, {
    headers: isFormData ? { "Content-Type": "multipart/form-data" } : undefined,
  });
  return data;
}

export async function changeUserPassword(payload) {
  const { data } = await api.post("/api/user/security/change-password", payload);
  return data;
}

export async function getUserAddresses() {
  const { data } = await api.get("/api/user/addresses");
  return data;
}

export async function createUserAddress(payload) {
  const { data } = await api.post("/api/user/addresses", payload);
  return data;
}

export async function updateUserAddress(id, payload) {
  const { data } = await api.patch(`/api/user/addresses/${id}`, payload);
  return data;
}

export async function deleteUserAddress(id) {
  const { data } = await api.delete(`/api/user/addresses/${id}`);
  return data;
}

export async function getUserOrders(params = {}) {
  const { data } = await api.get("/api/user/orders", { params });
  return data;
}

export async function getUserOrder(id) {
  const { data } = await api.get(`/api/user/orders/${id}`);
  return data;
}

export async function getUserOrderTracking(id) {
  const { data } = await api.get(`/api/user/orders/${id}/tracking`);
  return data;
}

export async function cancelUserOrder(id) {
  const { data } = await api.patch(`/api/user/orders/${id}/cancel`);
  return data;
}

export async function previewUserOrderCancellation(id, payload = {}) {
  const { data } = await api.post(`/api/user/orders/${id}/cancel`, { ...payload, previewOnly: true });
  return data;
}

export async function confirmUserOrderCancellation(id, payload = {}) {
  const { data } = await api.post(`/api/user/orders/${id}/cancel`, payload);
  return data;
}

export async function requestUserReturn(id, payload) {
  const { data } = await api.post(`/api/user/orders/${id}/return`, payload);
  return data;
}

export async function getRefundStatus(id) {
  const { data } = await api.get(`/api/payments/refund-status/${id}`);
  return data;
}

export async function downloadUserInvoice(id) {
  const response = await api.get(`/api/user/orders/${id}/invoice`, {
    responseType: "blob",
  });
  
  const blob = new Blob([response.data], { type: response.headers["content-type"] || "application/pdf" });
  const contentDisposition = response.headers["content-disposition"] || "";
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || `invoice-${id}.pdf`;
  
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

export function getUserInvoiceUrl(id) {
  const base = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");
  return `${base}/api/user/orders/${id}/invoice`;
}

export async function getUserCart() {
  const { data } = await api.get("/api/user/cart");
  return data;
}

export async function updateUserCartItem(productId, quantity) {
  const { data } = await api.patch(`/api/user/cart/items/${productId}`, { quantity });
  return data;
}

export async function removeUserCartItem(productId) {
  const { data } = await api.delete(`/api/user/cart/items/${productId}`);
  return data;
}

export async function getUserWishlist() {
  const { data } = await api.get("/api/user/wishlist");
  return data;
}

export async function addUserWishlist(productId) {
  const { data } = await api.post(`/api/user/wishlist/${productId}`);
  return data;
}

export async function removeUserWishlist(productId) {
  const { data } = await api.delete(`/api/user/wishlist/${productId}`);
  return data;
}

export async function moveWishlistItemToCart(productId) {
  const { data } = await api.post(`/api/user/wishlist/${productId}/move-to-cart`);
  return data;
}

export async function getUserBilling(params = {}) {
  const { data } = await api.get("/api/user/billing", { params });
  return data;
}

export async function getUserReturns() {
  const { data } = await api.get("/api/user/returns");
  return data;
}

export async function getUserReviews() {
  const { data } = await api.get("/api/user/reviews");
  return data;
}

export async function getUserReviewableProducts() {
  const { data } = await api.get("/api/user/reviews/eligible");
  return data;
}

export async function createUserReview(payload, photos = []) {
  const formData = new FormData();
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") formData.append(key, value);
  });
  photos.forEach((file) => formData.append("photos", file));
  const { data } = await api.post("/api/user/reviews", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function updateUserReview(id, payload, photos = []) {
  const formData = new FormData();
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") formData.append(key, value);
  });
  photos.forEach((file) => formData.append("photos", file));
  const { data } = await api.patch(`/api/user/reviews/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteUserReview(id) {
  const { data } = await api.delete(`/api/user/reviews/${id}`);
  return data;
}

export async function getUserNotifications(params = {}) {
  const { data } = await api.get("/api/user/notifications", { params });
  return data;
}

export async function markUserNotificationRead(id) {
  const { data } = await api.patch(`/api/user/notifications/${id}/read`);
  return data;
}

export async function getUserSupportTickets() {
  const { data } = await api.get("/api/user/support");
  return data;
}

export async function createUserSupportTicket(payload) {
  const { data } = await api.post("/api/user/support", payload);
  return data;
}

export async function replyUserSupportTicket(id, payload) {
  const { data } = await api.post(`/api/user/support/${id}/reply`, payload);
  return data;
}

export async function getUserSessions() {
  const { data } = await api.get("/api/user/security/sessions");
  return data;
}

export async function revokeUserSession(id) {
  const { data } = await api.delete(`/api/user/security/sessions/${id}`);
  return data;
}

export async function logoutUserDevices() {
  const { data } = await api.post("/api/user/security/logout-all");
  return data;
}

export async function getUserActivity(params = {}) {
  const { data } = await api.get("/api/user/activity", { params });
  return data;
}
