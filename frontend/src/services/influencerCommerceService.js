import { api } from "./api";

export async function getInfluencerDashboard() {
  const { data } = await api.get("/api/influencer/dashboard");
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

export async function generateInfluencerAffiliateLink(payload) {
  const { data } = await api.post("/api/influencer/generate-affiliate-link", payload);
  return data;
}

export async function getInfluencerAnalytics() {
  const { data } = await api.get("/api/influencer/analytics");
  return data;
}

export async function getInfluencerEarnings(params = {}) {
  const { data } = await api.get("/api/influencer/earnings", { params });
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
