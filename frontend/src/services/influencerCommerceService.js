import { api } from "./api";

export async function getInfluencerDashboard(params = {}) {
  const { data } = await api.get("/api/influencer/dashboard", { params });
  return data;
}

export async function getInfluencerActivationWelcome() {
  const { data } = await api.get("/api/influencer/activation/welcome");
  return data;
}

export async function getInfluencerStorefront(params = {}) {
  const { data } = await api.get("/api/influencer/storefront", { params });
  return data;
}

export async function getInfluencerStorefrontBuilder() {
  const { data } = await api.get("/api/influencer/storefront-builder");
  return data;
}

export async function saveInfluencerStorefrontBuilder(payload) {
  const { data } = await api.put("/api/influencer/storefront-builder", payload);
  return data;
}

export async function previewInfluencerStorefrontBuilder(payload) {
  const { data } = await api.post("/api/influencer/storefront-builder/preview", payload);
  return data;
}

export async function generateInfluencerAffiliateLink(payload) {
  const { data } = await api.post("/api/influencer/generate-affiliate-link", payload);
  return data;
}

export async function listAffiliateProducts(params = {}) {
  const { data } = await api.get("/api/influencer/affiliate-products", { params });
  return data;
}

export async function listRecommendedAffiliateProducts(params = {}) {
  const { data } = await api.get("/api/influencer/affiliate-products/recommended", { params });
  return data;
}

export async function listSavedAffiliateProducts(params = {}) {
  const { data } = await api.get("/api/influencer/affiliate-products/saved", { params });
  return data;
}

export async function saveAffiliateProduct(productId, saved = true) {
  const { data } = await api.patch(`/api/influencer/affiliate-products/${productId}/save`, { saved });
  return data;
}

export async function generateAffiliateProductLinks(payload) {
  const { data } = await api.post("/api/influencer/affiliate-products/links", payload);
  return data;
}

export async function getAffiliateProductAnalytics(params = {}) {
  const { data } = await api.get("/api/influencer/affiliate-products/analytics", { params });
  return data;
}

export async function getInfluencerAnalytics() {
  const { data } = await api.get("/api/influencer/analytics");
  return data;
}

export async function listInfluencerCollections(params = {}) {
  const { data } = await api.get("/api/influencer/collections", { params });
  return data;
}

export async function getInfluencerCollection(id) {
  const { data } = await api.get(`/api/influencer/collections/${id}`);
  return data;
}

export async function saveInfluencerCollection(payload, id = "") {
  const { data } = id
    ? await api.put(`/api/influencer/collections/${id}`, payload)
    : await api.post("/api/influencer/collections", payload);
  return data;
}

export async function updateInfluencerCollectionStatus(id, payload) {
  const { data } = await api.patch(`/api/influencer/collections/${id}/status`, payload);
  return data;
}

export async function assignInfluencerCollectionProducts(id, payload) {
  const { data } = await api.post(`/api/influencer/collections/${id}/products`, payload);
  return data;
}

export async function listInfluencerCollectionProducts(params = {}) {
  const { data } = await api.get("/api/influencer/collections/products", { params });
  return data;
}

export async function getInfluencerCollectionAnalytics(params = {}) {
  const { data } = await api.get("/api/influencer/collections/analytics", { params });
  return data;
}

export async function getInfluencerEarnings(params = {}) {
  const { data } = await api.get("/api/influencer/earnings", { params });
  return data;
}

export async function getInfluencerWalletEarnings(params = {}) {
  const { data } = await api.get("/api/commission/earnings", { params });
  return data;
}

export async function listInfluencerWithdrawals(params = {}) {
  const { data } = await api.get("/api/commission/withdrawals", { params });
  return data;
}

export async function requestInfluencerWithdrawal(payload = {}) {
  const { data } = await api.post("/api/commission/withdrawals", payload);
  return data;
}

export async function cancelInfluencerWithdrawal(requestId) {
  const { data } = await api.post(`/api/commission/withdrawals/${requestId}/cancel`);
  return data;
}

export async function listInfluencerPayoutAccounts() {
  const { data } = await api.get("/api/commission/payout-accounts");
  return data;
}

export async function saveInfluencerPayoutAccount(payload = {}) {
  const { data } = await api.post("/api/commission/payout-accounts", payload);
  return data;
}

export async function getInfluencerVerification(params = {}) {
  const { data } = await api.get("/api/influencer/verification", { params });
  return data;
}

export async function uploadInfluencerVerificationDocuments(formData) {
  const { data } = await api.post("/api/influencer/verification/documents", formData);
  return data;
}

export async function saveInfluencerVerificationTax(formData) {
  const { data } = await api.post("/api/influencer/verification/tax", formData);
  return data;
}

export async function saveInfluencerVerificationBank(payload = {}) {
  const { data } = await api.post("/api/influencer/verification/bank", payload);
  return data;
}

export async function getInfluencerProfileSettings() {
  const { data } = await api.get("/api/influencer/profile-settings");
  return data;
}

export async function updateInfluencerProfileSettings(section, payload = {}) {
  const { data } = await api.patch(`/api/influencer/profile-settings/${section}`, payload);
  return data;
}

export async function changeInfluencerPassword(payload = {}) {
  const { data } = await api.post("/api/influencer/profile-settings/security/change-password", payload);
  return data;
}

export async function getInfluencerSessions() {
  const { data } = await api.get("/api/influencer/profile-settings/security/sessions");
  return data;
}

export async function revokeInfluencerSession(id) {
  const { data } = await api.delete(`/api/influencer/profile-settings/security/sessions/${id}`);
  return data;
}

export async function registerInfluencer(payload) {
  const { data } = await api.post("/api/influencer/register", payload);
  return data;
}

export async function getInfluencerProfile() {
  const { data } = await api.get("/api/influencer/profile");
  return data;
}

export async function updateInfluencerProfile(payload) {
  const { data } = await api.put("/api/influencer/profile", payload);
  return data;
}

export async function listInfluencers(params = {}) {
  const { data } = await api.get("/api/influencer/list", { params });
  return data;
}

export async function listAdminInfluencers() {
  const { data } = await api.get("/api/influencer/admin/list");
  return data;
}

export async function moderateInfluencer(id, payload) {
  const { data } = await api.patch(`/api/influencer/admin/${id}/status`, payload);
  return data;
}

export async function listInfluencerApplications(params = {}) {
  const { data } = await api.get("/api/influencer/admin/applications", { params });
  return data;
}

export async function getInfluencerApplicationReview(applicationId) {
  const { data } = await api.get(`/api/influencer/admin/application/${applicationId}`);
  return data;
}

export async function reviewInfluencerApplication(applicationId, payload) {
  const { data } = await api.patch(`/api/influencer/admin/application/${applicationId}/review`, payload);
  return data;
}

export async function createCampaign(payload) {
  const { data } = await api.post("/api/campaign/create", payload);
  return data;
}

export async function acceptCampaign(campaignId) {
  const { data } = await api.post("/api/campaign/accept", { campaignId });
  return data;
}

export async function rejectCampaign(campaignId, note = "") {
  const { data } = await api.post("/api/campaign/reject", { campaignId, note });
  return data;
}

export async function getVendorCampaigns() {
  const { data } = await api.get("/api/campaign/vendor");
  return data;
}

export async function getInfluencerCampaigns() {
  const { data } = await api.get("/api/campaign/influencer");
  return data;
}

export async function getAdminCampaigns() {
  const { data } = await api.get("/api/campaign/admin/list");
  return data;
}

export async function listCampaignMarketplace(params = {}) {
  const { data } = await api.get("/api/campaign/marketplace", { params });
  return data;
}

export async function applyCampaignMarketplace(campaignId, payload = {}) {
  const { data } = await api.post(`/api/campaign/marketplace/${campaignId}/apply`, payload);
  return data;
}

export async function saveCampaignMarketplace(campaignId, saved = true) {
  const { data } = await api.patch(`/api/campaign/marketplace/${campaignId}/save`, { saved });
  return data;
}

export async function submitCampaignDeliverable(campaignId, payload = {}) {
  const { data } = await api.post(`/api/campaign/marketplace/${campaignId}/deliverables`, payload);
  return data;
}

export async function getCampaignMarketplaceAnalytics(params = {}) {
  const { data } = await api.get("/api/campaign/marketplace/analytics", { params });
  return data;
}

export async function uploadReel(payload) {
  const { data } = await api.post("/api/reel/upload", payload);
  return data;
}

export async function uploadReelMultipart(formData) {
  const { data } = await api.post("/api/reel/upload", formData);
  return data;
}

export async function publishReel(payload) {
  const { data } = await api.post("/api/reel/publish", payload);
  return data;
}

export async function getReelFeed(params = {}) {
  const { data } = await api.get("/api/reel/feed", { params });
  return data;
}

export async function getReel(id) {
  const { data } = await api.get(`/api/reel/${id}`);
  return data;
}

export async function getInfluencerReels() {
  const { data } = await api.get("/api/reel/mine");
  return data;
}

export async function getInfluencerReelsPage(params = {}) {
  const { data } = await api.get("/api/reel/influencer", { params });
  return data;
}

export async function listInfluencerContent(params = {}) {
  const { data } = await api.get("/api/reel/content", { params });
  return data;
}

export async function updateInfluencerContent(id, payload) {
  const { data } = await api.patch(`/api/reel/content/${id}`, payload);
  return data;
}

export async function getInfluencerContentAnalytics(params = {}) {
  const { data } = await api.get("/api/reel/content/analytics", { params });
  return data;
}

export async function getInfluencerMediaLibrary(params = {}) {
  const { data } = await api.get("/api/reel/content/media-library", { params });
  return data;
}

export async function listInfluencerLiveSessions(params = {}) {
  const { data } = await api.get("/api/reel/content/live", { params });
  return data;
}

export async function createInfluencerLiveSession(payload) {
  const { data } = await api.post("/api/reel/content/live", payload);
  return data;
}

export async function clickTracking(payload) {
  const { data } = await api.post("/api/tracking/click", payload);
  return data;
}

export async function getInfluencerWallet() {
  const { data } = await api.get("/api/commission/wallet");
  return data;
}

export async function getCommissionOverview() {
  const { data } = await api.get("/api/commission/admin/overview");
  return data;
}
