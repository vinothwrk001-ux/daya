import { api } from "./api";
import { adminHttp } from "./adminHttp";

export async function getHomepageBanners() {
  const { data } = await api.get("/api/homepage/banners");
  const payload = data?.data ?? data ?? {};
  return {
    container: payload.container ?? null,
    settings: payload.settings ?? {},
    banners: Array.isArray(payload.banners) ? payload.banners : [],
  };
}

export async function trackHomepageBannerEvent(bannerId, payload) {
  if (!bannerId) return null;
  const { data } = await api.post(`/api/homepage/banners/${bannerId}/track`, payload);
  return data?.data ?? data;
}

export async function listAdminHomepageBanners(containerId) {
  const { data } = await adminHttp.get("/api/admin/homepage/banners", {
    params: containerId ? { containerId } : undefined,
  });
  return data?.data ?? data ?? [];
}

export async function listAdminHomepageBannerContainers() {
  const { data } = await adminHttp.get("/api/admin/homepage/banner-containers");
  return data?.data ?? data ?? [];
}

export async function createAdminHomepageBannerContainer(payload) {
  const { data } = await adminHttp.post("/api/admin/homepage/banner-containers", payload);
  return data?.data ?? data;
}

export async function updateAdminHomepageBannerContainer(id, payload) {
  const { data } = await adminHttp.put(`/api/admin/homepage/banner-containers/${id}`, payload);
  return data?.data ?? data;
}

export async function deleteAdminHomepageBannerContainer(id) {
  const { data } = await adminHttp.delete(`/api/admin/homepage/banner-containers/${id}`);
  return data?.data ?? data;
}

export async function publishAdminHomepageBannerContainer(id) {
  const { data } = await adminHttp.post(`/api/admin/homepage/banner-containers/${id}/publish`);
  return data?.data ?? data;
}

export async function getAdminHomepageBanner(id) {
  const { data } = await adminHttp.get(`/api/admin/homepage/banners/${id}`);
  return data?.data ?? data;
}

export async function createAdminHomepageBanner(payload) {
  const { data } = await adminHttp.post("/api/admin/homepage/banners", payload);
  return data?.data ?? data;
}

export async function updateAdminHomepageBanner(id, payload) {
  const { data } = await adminHttp.put(`/api/admin/homepage/banners/${id}`, payload);
  return data?.data ?? data;
}

export async function deleteAdminHomepageBanner(id) {
  const { data } = await adminHttp.delete(`/api/admin/homepage/banners/${id}`);
  return data?.data ?? data;
}

export async function uploadAdminHomepageBannerMedia(id, formData) {
  const { data } = await adminHttp.post(`/api/admin/homepage/banners/${id}/media`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.data ?? data;
}

export async function getAdminHomepageBannerAnalytics() {
  const { data } = await adminHttp.get("/api/admin/homepage/banners/analytics/summary");
  return data?.data ?? data;
}

export async function getAdminHomepageBannerSettings() {
  const { data } = await adminHttp.get("/api/admin/homepage/banners/settings");
  return data?.data ?? data;
}

export async function updateAdminHomepageBannerSettings(payload) {
  const { data } = await adminHttp.put("/api/admin/homepage/banners/settings", payload);
  return data?.data ?? data;
}

export async function reorderAdminHomepageBanners(items) {
  const { data } = await adminHttp.put("/api/admin/homepage/banners/reorder", { items });
  return data?.data ?? data;
}
