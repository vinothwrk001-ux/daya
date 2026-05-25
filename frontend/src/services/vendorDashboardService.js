import { api } from "./api";
import { uploadVendorProductImages } from "./productMediaService";

export async function getVendorDashboard(params = {}) {
  const { data } = await api.get("/api/vendor/dashboard", { params });
  return data;
}

export async function getVendorProducts(params) {
  const { data } = await api.get("/api/vendor/products", { params });
  return data;
}

export async function createVendorProduct(payload) {
  const { data } = await api.post("/api/vendor/products", payload);
  return data;
}

export async function updateVendorProduct(id, payload) {
  const { data } = await api.patch(`/api/vendor/products/${id}`, payload);
  return data;
}

export async function uploadVendorImages(files, metadata = {}, onUploadProgress) {
  return uploadVendorProductImages(files, metadata, onUploadProgress);
}

export async function deleteVendorProduct(id) {
  const { data } = await api.delete(`/api/vendor/products/${id}`);
  return data;
}

export async function getVendorOrders(params) {
  const { data } = await api.get("/api/vendor/orders", { params });
  return data;
}

export async function getVendorOrderById(id) {
  const { data } = await api.get(`/api/vendor/orders/${id}`);
  return data;
}

export async function updateVendorOrderStatus(id, payload) {
  const { data } = await api.patch(`/api/vendor/orders/${id}/status`, payload);
  return data;
}

export async function markVendorOrderShipped(id, payload) {
  const { data } = await api.post(`/api/vendor/orders/${id}/ship`, payload);
  return data;
}

export async function requestVendorOrderPickup(id, payload = {}) {
  const { data } = await api.post(`/api/vendor/orders/${id}/request-pickup`, payload);
  return data;
}

export async function getVendorPickupQueue(params = {}) {
  const { data } = await api.get("/api/vendor/pickups/queue", { params });
  return data;
}

export async function getVendorPickupBatches(params = {}) {
  const { data } = await api.get("/api/vendor/pickups", { params });
  return data;
}

export async function scheduleVendorPickup(payload) {
  const { data } = await api.post("/api/vendor/pickups/schedule", payload);
  return data;
}

export async function getVendorInventory(params) {
  const { data } = await api.get("/api/vendor/inventory", { params });
  return data;
}

export async function updateVendorInventory(id, payload) {
  const { data } = await api.patch(`/api/vendor/inventory/${id}`, payload);
  return data;
}

export async function getVendorAnalytics(params = {}) {
  const { data } = await api.get("/api/vendor/analytics", { params });
  return data;
}

export async function getVendorStorefrontAnalytics(params = {}) {
  const { data } = await api.get("/api/vendor/storefront/analytics", { params });
  return data;
}

export async function getVendorProductAnalyticsDetail(id, params = {}) {
  const { data } = await api.get(`/api/vendor/analytics/products/${id}`, { params });
  return data;
}

export async function getVendorPayouts(params = {}) {
  const { data } = await api.get("/api/vendor/payouts", { params });
  return data;
}

export async function getVendorWallet() {
  const { data } = await api.get("/api/vendor/wallet");
  return data;
}

export async function getVendorLedger(params = {}) {
  const { data } = await api.get("/api/vendor/ledger", { params });
  return data;
}

export async function getVendorPayoutRequests(params = {}) {
  const { data } = await api.get("/api/vendor/payout-requests", { params });
  return data;
}

export async function requestVendorPayout(payload) {
  const { data } = await api.post("/api/vendor/payouts/request", payload);
  return data;
}

export async function getVendorPayoutAccount() {
  const { data } = await api.get("/api/vendor/payout-account");
  return data;
}

export async function updateVendorPayoutAccount(payload) {
  const { data } = await api.put("/api/vendor/payout-account", payload);
  return data;
}

export async function getVendorCommissionSummary(params = {}) {
  const { data } = await api.get("/api/vendor/commission/summary", { params });
  return data;
}

export async function getVendorDelivery(params) {
  const { data } = await api.get("/api/vendor/delivery", { params });
  return data;
}

export async function updateVendorDelivery(id, payload) {
  const { data } = await api.patch(`/api/vendor/delivery/${id}`, payload);
  return data;
}

export async function getVendorSettings() {
  const { data } = await api.get("/api/vendor/settings");
  return data;
}

export async function updateVendorSettings(payload) {
  const { data } = await api.patch("/api/vendor/settings", payload);
  return data;
}

export async function uploadVendorStoreMedia(file, context = "logo") {
  const form = new FormData();
  form.append("image", file);
  form.append("context", context);
  const { data } = await api.post("/api/vendor/settings/media", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getVendorShippingSettings() {
  const { data } = await api.get("/api/vendor/settings/shipping");
  return data;
}

export async function updateVendorShippingSettings(payload) {
  const { data } = await api.patch("/api/vendor/settings/shipping", payload);
  return data;
}

export async function getVendorNotifications(params) {
  const { data } = await api.get("/api/vendor/notifications", { params });
  return data;
}

export async function markVendorNotificationRead(id) {
  const { data } = await api.patch(`/api/vendor/notifications/${id}/read`);
  return data;
}

export async function getVendorReviews(params) {
  const { data } = await api.get("/api/reviews/vendor", { params });
  return data;
}

export async function respondToVendorReview(id, payload) {
  const { data } = await api.post(`/api/reviews/${id}/reply`, payload);
  return data;
}

export async function getVendorReturns(params) {
  const { data } = await api.get("/api/vendor/returns", { params });
  return data;
}

export async function updateVendorReturn(id, payload) {
  const { data } = await api.patch(`/api/vendor/returns/${id}`, payload);
  return data;
}

export async function getVendorOffers(params) {
  const { data } = await api.get("/api/vendor/offers", { params });
  return data;
}

export async function createVendorOffer(payload) {
  const { data } = await api.post("/api/vendor/offers", payload);
  return data;
}

export async function updateVendorOffer(id, payload) {
  const { data } = await api.patch(`/api/vendor/offers/${id}`, payload);
  return data;
}

export async function getVendorSupportTickets(params) {
  const { data } = await api.get("/api/vendor/support", { params });
  return data;
}

export async function createVendorSupportTicket(payload) {
  const { data } = await api.post("/api/vendor/support", payload);
  return data;
}

export async function replyVendorSupportTicket(id, payload) {
  const { data } = await api.post(`/api/vendor/support/${id}/reply`, payload);
  return data;
}
