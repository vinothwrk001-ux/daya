import { adminHttp } from "./adminHttp";
import { buildDateRangeParams } from "../utils/reporting";
import { uploadAdminProductImages as uploadAdminProductImagesRequest } from "./productMediaService";

function triggerBlobDownload(response, fallbackName) {
  const blob = new Blob([response.data], { type: response.headers["content-type"] || "application/octet-stream" });
  const contentDisposition = response.headers["content-disposition"] || "";
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || fallbackName;
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

export async function getDashboard() {
  const { data } = await adminHttp.get("/api/admin/dashboard");
  return data;
}

export async function getAnalytics(params = {}) {
  const { data } = await adminHttp.get("/api/admin/analytics", { params });
  return data;
}

export async function getProductAnalyticsDetail(id, params = {}) {
  const { data } = await adminHttp.get(`/api/admin/analytics/products/${id}`, { params });
  return data;
}

export async function getDailyRevenue(days = 7) {
  const { data } = await adminHttp.get("/api/admin/daily-revenue", { params: { days } });
  return data;
}

export async function resetPlatformData(confirmation) {
  const { data } = await adminHttp.post(
    "/api/admin/system/reset-data",
    { confirmation },
    { timeout: 120000 }
  );
  return data;
}

export async function getRevenueSummary(params = {}) {
  const { data } = await adminHttp.get("/api/admin/revenue", { params });
  return data;
}

export async function getVendorRevenue(params = {}) {
  const { data } = await adminHttp.get("/api/admin/revenue/vendors", { params });
  return data;
}

export async function exportRevenueReport({ format, startDate, endDate, vendorId }) {
  const response = await adminHttp.get("/api/admin/revenue/export", {
    params: {
      format,
      ...(vendorId ? { vendorId } : {}),
      ...buildDateRangeParams(startDate, endDate),
    },
    responseType: "blob",
  });

  triggerBlobDownload(response, `revenue-report.${format === "excel" ? "xlsx" : format}`);
}

export async function listUsers(params = {}) {
  const { data } = await adminHttp.get("/api/admin/users", { params });
  return data;
}

export async function createUser(payload) {
  const { data } = await adminHttp.post("/api/admin/users", payload);
  return data;
}

export async function toggleUserBlock(id) {
  const { data } = await adminHttp.patch(`/api/admin/users/${id}/block`);
  return data;
}

export async function deleteUser(id) {
  const { data } = await adminHttp.delete(`/api/admin/users/${id}`);
  return data;
}

export async function listSellers(params = {}) {
  const { data } = await adminHttp.get("/api/admin/sellers", { params });
  return data;
}

export async function getSellerDetails(id) {
  const { data } = await adminHttp.get(`/api/admin/sellers/${id}`);
  return data;
}

export async function approveSeller(id) {
  const { data } = await adminHttp.patch(`/api/admin/sellers/${id}/approve`);
  return data;
}

export async function rejectSeller(id, reason) {
  const { data } = await adminHttp.patch(`/api/admin/sellers/${id}/reject`, { reason });
  return data;
}

export async function moderateVendorStore(id, payload) {
  const { data } = await adminHttp.patch(`/api/admin/sellers/${id}/store-moderation`, payload);
  return data;
}

export async function removeSeller(id) {
  const { data } = await adminHttp.delete(`/api/admin/vendor/${id}`);
  return data;
}

export async function listProducts(params = {}) {
  const { data } = await adminHttp.get("/api/admin/products", { params });
  return data;
}

export async function getProductById(id) {
  const { data } = await adminHttp.get(`/api/admin/products/${id}`);
  return data;
}

export async function generateAdminProductNumber(params = {}) {
  const { data } = await adminHttp.get("/api/admin/products/generate-number", { params });
  return data;
}

export async function createProduct(productData) {
  const { data } = await adminHttp.post("/api/admin/products", productData);
  return data;
}

export async function updateProduct(id, productData) {
  const { data } = await adminHttp.patch(`/api/admin/products/${id}`, productData);
  return data;
}

export async function uploadAdminProductImages(files, metadata = {}, onUploadProgress) {
  return uploadAdminProductImagesRequest(files, metadata, onUploadProgress);
}

export async function deleteProduct(id) {
  const { data } = await adminHttp.delete(`/api/admin/products/${id}`);
  return data;
}

export async function approveProduct(id) {
  const { data } = await adminHttp.patch(`/api/admin/products/${id}/approve`);
  return data;
}

export async function rejectProduct(id, rejectionReason) {
  const { data } = await adminHttp.patch(`/api/admin/products/${id}/reject`, { rejectionReason });
  return data;
}

export async function getProductStats() {
  const { data } = await adminHttp.get("/api/admin/products/stats");
  return data;
}

export async function getAdminInventorySummary(params = {}) {
  const { data } = await adminHttp.get("/api/admin/inventory", { params });
  return data;
}

export async function getAdminInventoryProduct(id) {
  const { data } = await adminHttp.get(`/api/admin/inventory/${id}`);
  return data;
}

export async function getAdminInventoryLedger(id, variantId, params = {}) {
  const { data } = await adminHttp.get(`/api/admin/inventory/${id}/variant/${variantId}/ledger`, { params });
  return data;
}

export async function adjustAdminInventory(id, variantId, payload) {
  const { data } = await adminHttp.post(`/api/admin/inventory/${id}/variant/${variantId}/adjust`, payload);
  return data;
}

export async function updateAdminInventoryThreshold(id, variantId, threshold) {
  const { data } = await adminHttp.patch(`/api/admin/inventory/${id}/variant/${variantId}/threshold`, { threshold });
  return data;
}

export async function listOrders(params = {}) {
  const { data } = await adminHttp.get("/api/admin/orders", { params });
  return data;
}

export async function getShippingModes() {
  const { data } = await adminHttp.get("/api/admin/shipping/modes");
  return data;
}

export async function updateShippingModes(payload) {
  const { data } = await adminHttp.patch("/api/admin/shipping/modes", payload);
  return data;
}

export async function listPickupBatches(params = {}) {
  const { data } = await adminHttp.get("/api/admin/pickups", { params });
  return data;
}

export async function scheduleAdminPickup(payload) {
  const { data } = await adminHttp.post("/api/admin/pickups/schedule", payload);
  return data;
}

export async function listPayouts(params = {}) {
  const { data } = await adminHttp.get("/api/admin/payouts", { params });
  return data;
}

export async function processPayout(orderId) {
  const { data } = await adminHttp.post("/api/payouts/process", { orderId });
  return data;
}

export async function queueEligiblePayouts() {
  const { data } = await adminHttp.post("/api/payouts/queue");
  return data;
}

export async function listPayoutRequests(params = {}) {
  const { data } = await adminHttp.get("/api/admin/payout-requests", { params });
  return data;
}

export async function listPayoutAccounts(params = {}) {
  const { data } = await adminHttp.get("/api/admin/payout-accounts", { params });
  return data;
}

export async function approvePayoutRequest(id, payload = {}) {
  const { data } = await adminHttp.post(`/api/admin/payouts/${id}/approve`, payload);
  return data;
}

export async function rejectPayoutRequest(id, payload) {
  const { data } = await adminHttp.post(`/api/admin/payouts/${id}/reject`, payload);
  return data;
}

export async function payPayoutRequest(id, payload) {
  const { data } = await adminHttp.post(`/api/admin/payouts/${id}/pay`, payload);
  return data;
}

export async function getAdminVendorWallet(vendorId) {
  const { data } = await adminHttp.get(`/api/admin/vendors/${vendorId}/wallet`);
  return data;
}

export async function getAdminVendorLedger(vendorId, params = {}) {
  const { data } = await adminHttp.get(`/api/admin/vendors/${vendorId}/ledger`, { params });
  return data;
}

export async function getAdminVendorPayoutAccount(vendorId) {
  const { data } = await adminHttp.get(`/api/admin/vendors/${vendorId}/payout-account`);
  return data;
}

export async function verifyVendorPayoutAccount(accountId) {
  const { data } = await adminHttp.post(`/api/admin/payout-accounts/${accountId}/verify`);
  return data;
}

export async function listReviews(params = {}) {
  const { data } = await adminHttp.get("/api/admin/reviews", { params });
  return data;
}

export async function deleteReview(id) {
  const { data } = await adminHttp.delete(`/api/admin/reviews/${id}`);
  return data;
}

export async function listProductReviewsForModeration(params = {}) {
  const { data } = await adminHttp.get("/api/reviews/admin", { params });
  return data;
}

export async function deleteProductReview(id) {
  const { data } = await adminHttp.delete(`/api/reviews/${id}`);
  return data;
}

export async function updateProductReviewModeration(id, payload) {
  const { data } = await adminHttp.put(`/api/reviews/${id}`, payload);
  return data;
}

export async function getReviewDashboard() {
  const { data } = await adminHttp.get("/api/reviews/admin/dashboard");
  return data;
}

export async function updateOrderStatus(id, status) {
  const { data } = await adminHttp.patch(`/api/admin/orders/${id}/status`, { status });
  return data;
}

export async function cancelOrder(id) {
  const { data } = await adminHttp.patch(`/api/admin/orders/${id}/cancel`);
  return data;
}

export async function previewAdminOrderCancellation(id, payload = {}) {
  const { data } = await adminHttp.post(`/api/admin/orders/${id}/cancel`, { ...payload, previewOnly: true });
  return data;
}

export async function confirmAdminOrderCancellation(id, payload = {}) {
  const { data } = await adminHttp.post(`/api/admin/orders/${id}/cancel`, payload);
  return data;
}

export async function getOrderById(id) {
  const { data } = await adminHttp.get(`/api/admin/orders/${id}`);
  return data;
}

export async function createOrder(payload) {
  const { data } = await adminHttp.post("/api/admin/orders", payload);
  return data;
}

export async function updateOrder(id, patch) {
  const { data } = await adminHttp.patch(`/api/admin/orders/${id}`, patch);
  return data;
}

export async function deleteOrder(id) {
  const { data } = await adminHttp.delete(`/api/admin/orders/${id}`);
  return data;
}

export async function getAuditLogs(params = {}) {
  const { data } = await adminHttp.get("/api/admin/audit-logs", { params });
  return data;
}

export async function listCancellationPolicies() {
  const { data } = await adminHttp.get("/api/admin/cancellation-policies");
  return data;
}

export async function createCancellationPolicy(payload) {
  const { data } = await adminHttp.post("/api/admin/cancellation-policy", payload);
  return data;
}

export async function updateCancellationPolicy(id, payload) {
  const { data } = await adminHttp.put(`/api/admin/cancellation-policy/${id}`, payload);
  return data;
}

export async function listRefundCases(params = {}) {
  const { data } = await adminHttp.get("/api/admin/refunds", { params });
  return data;
}

export async function getRefundCase(id) {
  const { data } = await adminHttp.get(`/api/admin/refunds/${id}`);
  return data;
}

export async function processRefundCase(id, payload = {}) {
  const { data } = await adminHttp.post(`/api/admin/refunds/${id}/process`, payload);
  return data;
}

export async function markManualRefundCase(id, payload = {}) {
  const { data } = await adminHttp.post(`/api/admin/refunds/${id}/manual`, payload);
  return data;
}

export async function markWalletRefundCase(id, payload = {}) {
  const { data } = await adminHttp.post(`/api/admin/refunds/${id}/wallet`, payload);
  return data;
}

export async function retryRefundCase(id, payload = {}) {
  const { data } = await adminHttp.post(`/api/admin/refunds/${id}/retry`, payload);
  return data;
}

export async function listCategories() {
  const { data } = await adminHttp.get("/api/admin/categories");
  return data;
}

export async function createCategory(payload) {
  const { data } = await adminHttp.post("/api/admin/categories", payload);
  return data;
}

export async function updateCategory(id, payload) {
  const { data } = await adminHttp.patch(`/api/admin/categories/${id}`, payload);
  return data;
}

export async function toggleCategory(id, isActive) {
  const { data } = await adminHttp.patch(`/api/admin/categories/${id}/toggle`, { isActive });
  return data;
}

export async function listSubcategories() {
  const { data } = await adminHttp.get("/api/admin/subcategories");
  return data;
}

export async function createSubcategory(payload) {
  const { data } = await adminHttp.post("/api/admin/subcategories", payload);
  return data;
}

export async function updateSubcategory(id, payload) {
  const { data } = await adminHttp.put(`/api/admin/subcategories/${id}`, payload);
  return data;
}

export async function deleteSubcategory(id) {
  const { data } = await adminHttp.delete(`/api/admin/subcategories/${id}`);
  return data;
}

export async function toggleSubcategoryStatus(id, status) {
  const { data } = await adminHttp.patch(`/api/admin/subcategories/${id}/status`, { status });
  return data;
}

export async function getStaffPermissionCatalog() {
  const { data } = await adminHttp.get("/api/admin/permissions/catalog");
  return data;
}

export async function listStaffRoles() {
  const { data } = await adminHttp.get("/api/admin/roles");
  return data;
}

export async function createStaffRole(payload) {
  const { data } = await adminHttp.post("/api/admin/roles", payload);
  return data;
}

export async function updateStaffRole(id, payload) {
  const { data } = await adminHttp.patch(`/api/admin/roles/${id}`, payload);
  return data;
}

export async function deleteStaffRole(id) {
  const { data } = await adminHttp.delete(`/api/admin/roles/${id}`);
  return data;
}

export async function listStaffAccounts() {
  const { data } = await adminHttp.get("/api/staff/admin/accounts");
  return data;
}

export async function createStaffAccount(payload) {
  const { data } = await adminHttp.post("/api/staff/admin/accounts", payload);
  return data;
}

export async function updateStaffAccount(id, payload) {
  const { data } = await adminHttp.patch(`/api/staff/admin/accounts/${id}`, payload);
  return data;
}

export async function deleteStaffAccount(id) {
  const { data } = await adminHttp.delete(`/api/staff/admin/accounts/${id}`);
  return data;
}

export async function forceLogoutStaffAccount(id) {
  const { data } = await adminHttp.post(`/api/staff/admin/accounts/${id}/force-logout`);
  return data;
}

export async function listCommissionRules(params = {}) {
  const { data } = await adminHttp.get("/api/admin/commission/rules", { params });
  return data;
}

export async function createCommissionRule(payload) {
  const { data } = await adminHttp.post("/api/admin/commission/rules", payload);
  return data;
}

export async function updateCommissionRule(id, payload) {
  const { data } = await adminHttp.put(`/api/admin/commission/rules/${id}`, payload);
  return data;
}

export async function toggleCommissionRuleActive(id, active) {
  const { data } = await adminHttp.patch(`/api/admin/commission/rules/${id}/active`, { active });
  return data;
}

export async function deleteCommissionRule(id) {
  const { data } = await adminHttp.delete(`/api/admin/commission/rules/${id}`);
  return data;
}

export async function getCommissionAnalytics(params = {}) {
  const { data } = await adminHttp.get("/api/admin/commission/analytics", { params });
  return data;
}
