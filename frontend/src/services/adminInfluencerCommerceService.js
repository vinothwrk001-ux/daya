import { api } from "./api";

const base = "/api/admin/influencer-commerce";

export async function getAdminInfluencerCommerceDashboard(params = {}) {
  const { data } = await api.get(`${base}/dashboard`, { params });
  return data;
}

export async function listAdminInfluencerCommerceInfluencers(params = {}) {
  const { data } = await api.get(`${base}/influencers`, { params });
  return data;
}

export async function listAdminInfluencerCommerceVendors(params = {}) {
  const { data } = await api.get(`${base}/vendors`, { params });
  return data;
}

export async function listAdminInfluencerCommerceCampaigns(params = {}) {
  const { data } = await api.get(`${base}/campaigns`, { params });
  return data;
}

export async function updateAdminInfluencerCommerceCampaign(campaignId, payload = {}) {
  const { data } = await api.patch(`${base}/campaigns/${campaignId}`, payload);
  return data;
}

export async function listAdminCampaignApplications(params = {}) {
  const { data } = await api.get(`${base}/campaign-applications`, { params });
  return data;
}

export async function reviewAdminCampaignApplication(campaignId, influencerId, payload = {}) {
  const { data } = await api.patch(`${base}/campaigns/${campaignId}/applications/${influencerId}`, payload);
  return data;
}

export async function getAdminInfluencerVendorMatching(params = {}) {
  const { data } = await api.get(`${base}/matching`, { params });
  return data;
}

export async function listAdminAffiliateProducts(params = {}) {
  const { data } = await api.get(`${base}/affiliate-products`, { params });
  return data;
}

export async function listAdminAffiliateTracking(params = {}) {
  const { data } = await api.get(`${base}/affiliate-tracking`, { params });
  return data;
}

export async function listAdminContentModeration(params = {}) {
  const { data } = await api.get(`${base}/content-moderation`, { params });
  return data;
}

export async function moderateAdminInfluencerContent(reelId, payload = {}) {
  const { data } = await api.patch(`${base}/content-moderation/${reelId}`, payload);
  return data;
}

export async function listAdminProductPromotions(params = {}) {
  const { data } = await api.get(`${base}/product-promotions`, { params });
  return data;
}

export async function listAdminInfluencerCommissions(params = {}) {
  const { data } = await api.get(`${base}/commissions`, { params });
  return data;
}

export async function updateAdminInfluencerCommission(commissionId, payload = {}) {
  const { data } = await api.patch(`${base}/commissions/${commissionId}`, payload);
  return data;
}

export async function listAdminInfluencerSettlements(params = {}) {
  const { data } = await api.get(`${base}/settlements`, { params });
  return data;
}

export async function listAdminInfluencerPayouts(params = {}) {
  const { data } = await api.get(`${base}/payouts`, { params });
  return data;
}

export async function listAdminInfluencerWithdrawals(params = {}) {
  const { data } = await api.get(`${base}/withdrawals`, { params });
  return data;
}

export async function updateAdminInfluencerWithdrawal(requestId, payload = {}) {
  const { data } = await api.patch(`${base}/withdrawals/${requestId}`, payload);
  return data;
}

export async function getAdminCreatorPerformance(params = {}) {
  const { data } = await api.get(`${base}/creator-performance`, { params });
  return data;
}

export async function getAdminVendorPerformance(params = {}) {
  const { data } = await api.get(`${base}/vendor-performance`, { params });
  return data;
}

export async function getAdminCampaignAnalytics(params = {}) {
  const { data } = await api.get(`${base}/campaign-analytics`, { params });
  return data;
}

export async function getAdminRevenueAnalytics(params = {}) {
  const { data } = await api.get(`${base}/revenue-analytics`, { params });
  return data;
}

export async function listAdminFraudAlerts(params = {}) {
  const { data } = await api.get(`${base}/fraud`, { params });
  return data;
}

export async function updateAdminFraudAlert(alertId, payload = {}) {
  const { data } = await api.patch(`${base}/fraud/${alertId}`, payload);
  return data;
}

export async function getAdminCommunicationCenter(params = {}) {
  const { data } = await api.get(`${base}/communication`, { params });
  return data;
}

export async function getAdminInfluencerReports(params = {}) {
  const { data } = await api.get(`${base}/reports`, { params });
  return data;
}

export async function saveAdminInfluencerReportSchedule(payload = {}) {
  const { data } = await api.post(`${base}/reports/schedules`, payload);
  return data;
}

export async function getAdminInfluencerSettings() {
  const { data } = await api.get(`${base}/settings`);
  return data;
}

export async function updateAdminInfluencerSettings(payload = {}) {
  const { data } = await api.patch(`${base}/settings`, payload);
  return data;
}

const commissionEngineBase = "/api/commission/admin/engine";

export async function getCommissionEngineDashboard(params = {}) {
  const { data } = await api.get(`${commissionEngineBase}/dashboard`, { params });
  return data;
}

export async function listCommissionEngineRules(params = {}) {
  const { data } = await api.get(`${commissionEngineBase}/rules`, { params });
  return data;
}

export async function createCommissionEngineRule(payload = {}) {
  const { data } = await api.post(`${commissionEngineBase}/rules`, payload);
  return data;
}

export async function updateCommissionEngineRule(ruleId, payload = {}) {
  const { data } = await api.patch(`${commissionEngineBase}/rules/${ruleId}`, payload);
  return data;
}

export async function approveCommissionEngineRule(ruleId) {
  const { data } = await api.post(`${commissionEngineBase}/rules/${ruleId}/approve`);
  return data;
}

export async function deactivateCommissionEngineRule(ruleId, payload = {}) {
  const { data } = await api.post(`${commissionEngineBase}/rules/${ruleId}/deactivate`, payload);
  return data;
}

export async function simulateCommissionEngine(payload = {}) {
  const { data } = await api.post(`${commissionEngineBase}/simulate`, payload);
  return data;
}

export async function createCommissionEngineSettlement(payload = {}) {
  const { data } = await api.post(`${commissionEngineBase}/settlements`, payload);
  return data;
}

export async function approveCommissionEngineSettlement(settlementId) {
  const { data } = await api.post(`${commissionEngineBase}/settlements/${settlementId}/approve`);
  return data;
}

export async function prepareCommissionEnginePayoutBatch(settlementId) {
  const { data } = await api.post(`${commissionEngineBase}/settlements/${settlementId}/payout-batch`);
  return data;
}

export async function listCommissionEngineAuditLogs(params = {}) {
  const { data } = await api.get(`${commissionEngineBase}/audit-logs`, { params });
  return data;
}
