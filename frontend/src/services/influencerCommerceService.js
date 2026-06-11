import { api } from "./api";

function compactParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== "" && value !== null && value !== undefined)
  );
}

export async function getInfluencerDashboard(params = {}) {
  const { data } = await api.get("/api/influencer/dashboard", { params: compactParams(params) });
  return data;
}

export async function getInfluencerStorefront(params = {}) {
  const { data } = await api.get("/api/influencer/storefront", { params });
  return data;
}

export async function getPublicInfluencerStorefront(username, tab = "storefront", params = {}) {
  const cleanTab = tab && tab !== "storefront" ? `/${tab}` : "";
  const { data } = await api.get(`/api/influencer/public/${encodeURIComponent(username)}${cleanTab}`, { params });
  return data;
}

export async function followPublicInfluencer(username) {
  const { data } = await api.post(`/api/influencer/public/${encodeURIComponent(username)}/follow`, { source: "storefront" });
  return data;
}

export async function unfollowPublicInfluencer(username) {
  const { data } = await api.delete(`/api/influencer/public/${encodeURIComponent(username)}/follow`);
  return data;
}

export async function subscribePublicInfluencerNewsletter(username, email) {
  const { data } = await api.post(`/api/influencer/public/${encodeURIComponent(username)}/newsletter`, { email, source: "storefront" });
  return data;
}

export async function trackPublicInfluencerEvent(username, payload = {}) {
  const { data } = await api.post(`/api/influencer/public/${encodeURIComponent(username)}/events`, payload);
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
  const { data } = await api.get("/api/influencer/affiliate-products", { params: compactParams(params) });
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
  const { data } = await api.get("/api/influencer/affiliate-products/analytics", { params: compactParams(params) });
  return data;
}

export async function listInfluencerCollections(params = {}) {
  const { data } = await api.get("/api/influencer/collections", { params: compactParams(params) });
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

export async function uploadInfluencerCollectionMedia(formData) {
  const { data } = await api.post("/api/influencer/collections/media", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function updateInfluencerCollectionStatus(id, payload) {
  const { data } = await api.patch(`/api/influencer/collections/${id}/status`, payload);
  return data;
}

export async function deleteInfluencerCollection(id) {
  const { data } = await api.delete(`/api/influencer/collections/${id}`);
  return data;
}

export async function assignInfluencerCollectionProducts(id, payload) {
  const { data } = await api.post(`/api/influencer/collections/${id}/products`, payload);
  return data;
}

export async function listInfluencerCollectionProducts(params = {}) {
  const { data } = await api.get("/api/influencer/collections/products", { params: compactParams(params) });
  return data;
}

export async function getInfluencerCollectionAnalytics(params = {}) {
  const { data } = await api.get("/api/influencer/collections/analytics", { params: compactParams(params) });
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

export async function getInfluencerCommerceProfile() {
  const { data } = await api.get("/api/influencer/commerce-profile");
  return data;
}

export async function saveInfluencerServices(payload = {}) {
  const { data } = await api.put("/api/influencer/services", payload);
  return data;
}

export async function saveInfluencerRequirements(payload = {}) {
  const { data } = await api.put("/api/influencer/requirements", payload);
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

export async function getVendorInfluencerCommerceDashboard(params = {}) {
  const { data } = await api.get("/api/vendor/influencer-commerce/dashboard", { params });
  return data;
}

export async function getVendorInfluencerSubscriptionPlans() {
  const { data } = await api.get("/api/vendor/influencer-commerce/subscription/plans");
  return data;
}

export async function activateVendorInfluencerSubscription(payload = {}) {
  const { data } = await api.post("/api/vendor/influencer-commerce/subscription", payload);
  return data;
}

export async function createVendorInfluencerSubscriptionOrder(payload = {}) {
  const { data } = await api.post("/api/vendor/influencer-commerce/subscription/order", payload);
  return data;
}

export async function verifyVendorInfluencerSubscriptionPayment(payload = {}) {
  const { data } = await api.post("/api/vendor/influencer-commerce/subscription/verify", payload);
  return data;
}

export async function previewVendorInfluencerSubscriptionChange(params = {}) {
  const { data } = await api.get("/api/vendor/influencer-commerce/subscription/proration-preview", { params });
  return data;
}

export async function createVendorInfluencerSubscriptionChangeOrder(payload = {}) {
  const { data } = await api.post("/api/vendor/influencer-commerce/subscription/change-plan", payload);
  return data;
}

export async function confirmVendorInfluencerSubscriptionChange(payload = {}) {
  const { data } = await api.post("/api/vendor/influencer-commerce/subscription/change-plan/confirm", payload);
  return data;
}

export async function cancelVendorInfluencerSubscription() {
  const { data } = await api.post("/api/vendor/influencer-commerce/subscription/cancel");
  return data;
}

export async function discoverVendorInfluencers(params = {}) {
  const { data } = await api.get("/api/vendor/influencer-commerce/discover", { params });
  return data;
}

export async function getVendorInfluencerCommerceConfiguration() {
  const { data } = await api.get("/api/vendor/influencer-commerce/configuration");
  return data;
}

export async function getVendorInfluencerProfile(influencerId) {
  const { data } = await api.get(`/api/vendor/influencer-commerce/creators/${influencerId}`);
  return data;
}

export async function getVendorInfluencerRelationships(params = {}) {
  const { data } = await api.get("/api/vendor/influencer-commerce/relationships", { params });
  return data;
}

export async function saveVendorInfluencer(influencerId, saved = true) {
  const { data } = await api.patch(`/api/vendor/influencer-commerce/relationships/${influencerId}/save`, { saved });
  return data;
}

export async function visitVendorInfluencer(influencerId) {
  const { data } = await api.post(`/api/vendor/influencer-commerce/relationships/${influencerId}/visit`);
  return data;
}

export async function updateVendorInfluencerRelationship(influencerId, payload = {}) {
  const { data } = await api.patch(`/api/vendor/influencer-commerce/relationships/${influencerId}`, payload);
  return data;
}

export async function createVendorInfluencerCampaign(payload = {}) {
  const { data } = await api.post("/api/vendor/influencer-commerce/campaigns", payload);
  return data;
}

export async function previewVendorInfluencerCampaign(payload = {}) {
  const { data } = await api.post("/api/vendor/influencer-commerce/campaigns/preview", payload);
  return data;
}

export async function getVendorInfluencerCampaigns(params = {}) {
  const { data } = await api.get("/api/vendor/influencer-commerce/campaigns", { params });
  return data;
}

export async function reviewVendorCampaignApplication(campaignId, influencerId, payload = {}) {
  const { data } = await api.patch(`/api/vendor/influencer-commerce/campaigns/${campaignId}/applications/${influencerId}`, payload);
  return data;
}

export async function updateVendorInfluencerCampaignStatus(campaignId, payload = {}) {
  const { data } = await api.patch(`/api/vendor/influencer-commerce/campaigns/${campaignId}/status`, payload);
  return data;
}

export async function deleteVendorInfluencerCampaign(campaignId) {
  const { data } = await api.delete(`/api/vendor/influencer-commerce/campaigns/${campaignId}`);
  return data;
}

export async function getVendorPromotionProducts(params = {}) {
  const { data } = await api.get("/api/vendor/influencer-commerce/products", { params });
  return data;
}

export async function getVendorAffiliateProducts(params = {}) {
  const { data } = await api.get("/api/vendor/influencer-commerce/affiliate-products", { params });
  return data;
}

export async function getVendorContentApprovals(params = {}) {
  const { data } = await api.get("/api/vendor/influencer-commerce/content-approvals", { params });
  return data;
}

export async function reviewVendorInfluencerContent(reelId, payload = {}) {
  const { data } = await api.patch(`/api/vendor/influencer-commerce/content-approvals/${reelId}`, payload);
  return data;
}

export async function getVendorInfluencerPerformance(params = {}) {
  const { data } = await api.get("/api/vendor/influencer-commerce/performance", { params });
  return data;
}

export async function getVendorInfluencerAnalytics(params = {}) {
  const { data } = await api.get("/api/vendor/influencer-commerce/analytics", { params });
  return data;
}

export async function getVendorCreatorLeaderboard(params = {}) {
  const { data } = await api.get("/api/vendor/influencer-commerce/leaderboard", { params });
  return data;
}

export async function getVendorInfluencerReports(params = {}) {
  const { data } = await api.get("/api/vendor/influencer-commerce/reports", { params });
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

export async function previewFixedCampaign(payload = {}) {
  const { data } = await api.post("/api/fixed-campaigns/preview", payload);
  return data;
}

export async function createFixedCampaign(payload = {}) {
  const { data } = await api.post("/api/fixed-campaigns", payload);
  return data;
}

export async function getVendorFixedCampaigns(params = {}) {
  const { data } = await api.get("/api/fixed-campaigns/vendor", { params: compactParams(params) });
  return data;
}

export async function getVendorFixedCampaignAnalytics(params = {}) {
  const { data } = await api.get("/api/fixed-campaigns/vendor/analytics", { params: compactParams(params) });
  return data;
}

export async function reviewFixedCampaignContent(submissionId, payload = {}) {
  const { data } = await api.patch(`/api/fixed-campaigns/content/${submissionId}/review`, payload);
  return data;
}

export async function releaseFixedCampaignPayment(campaignId, payload = {}) {
  const { data } = await api.post(`/api/fixed-campaigns/${campaignId}/release-payment`, payload);
  return data;
}

export async function cancelFixedCampaign(campaignId, payload = {}) {
  const { data } = await api.post(`/api/fixed-campaigns/${campaignId}/cancel`, payload);
  return data;
}

export async function getInfluencerFixedCampaigns(params = {}) {
  const { data } = await api.get("/api/fixed-campaigns/influencer", { params: compactParams(params) });
  return data;
}

export async function getInfluencerFixedCampaignAnalytics(params = {}) {
  const { data } = await api.get("/api/fixed-campaigns/influencer/analytics", { params: compactParams(params) });
  return data;
}

export async function acceptFixedCampaign(campaignId) {
  const { data } = await api.post(`/api/fixed-campaigns/${campaignId}/accept`);
  return data;
}

export async function rejectFixedCampaign(campaignId, note = "") {
  const { data } = await api.post(`/api/fixed-campaigns/${campaignId}/reject`, { note });
  return data;
}

export async function submitFixedCampaignContent(campaignId, payload = {}) {
  const { data } = await api.post(`/api/fixed-campaigns/${campaignId}/content`, payload);
  return data;
}

export async function trackFixedCampaignEvent(payload = {}) {
  const { data } = await api.post("/api/fixed-campaigns/track", payload);
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

export async function uploadInfluencerContentMedia(formData) {
  const { data } = await api.post("/api/reel/media", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
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

export async function getAdjacentReels(id) {
  const { data } = await api.get(`/api/reel/${id}/adjacent`);
  return data;
}

export async function getReelEngagement(id) {
  const { data } = await api.get(`/api/reel/${id}/engagement`);
  return data;
}

export async function toggleReelLike(id) {
  const { data } = await api.post(`/api/reel/${id}/like`);
  return data;
}

export async function toggleReelSave(id, payload = {}) {
  const { data } = await api.post(`/api/reel/${id}/save`, payload);
  return data;
}

export async function listReelComments(id, params = {}) {
  const { data } = await api.get(`/api/reel/${id}/comments`, { params });
  return data;
}

export async function createReelComment(id, payload = {}) {
  const { data } = await api.post(`/api/reel/${id}/comments`, payload);
  return data;
}

export async function createReelCommentReply(id, commentId, payload = {}) {
  const { data } = await api.post(`/api/reel/${id}/comments/${commentId}/replies`, payload);
  return data;
}

export async function toggleReelCommentLike(id, commentId) {
  const { data } = await api.post(`/api/reel/${id}/comments/${commentId}/like`);
  return data;
}

export async function reportReelComment(id, commentId, payload = {}) {
  const { data } = await api.post(`/api/reel/${id}/comments/${commentId}/report`, payload);
  return data;
}

export async function shareReel(id, payload = {}) {
  const { data } = await api.post(`/api/reel/${id}/share`, payload);
  return data;
}

export async function recordReelView(id, payload = {}) {
  const { data } = await api.post(`/api/reel/${id}/view`, payload);
  return data;
}

export async function recordReelStoreVisit(id, payload = {}) {
  const { data } = await api.post(`/api/reel/${id}/store-visit`, payload);
  return data;
}

export async function recordReelProductClick(id, payload = {}) {
  const { data } = await api.post(`/api/reel/${id}/product-click`, payload);
  return data;
}

export async function followReelCreator(id, payload = {}) {
  const { data } = await api.post(`/api/reel/${id}/follow`, payload);
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

export async function deleteInfluencerContent(id) {
  const { data } = await api.delete(`/api/reel/content/${id}`);
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

export async function trackAffiliateEvent(payload) {
  const { data } = await api.post("/api/tracking/event", payload);
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
