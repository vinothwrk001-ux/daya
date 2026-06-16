import { api } from "./api";
import { adminHttp } from "./adminHttp";

export async function getCategories() {
  const { data } = await api.get("/api/categories");
  return data;
}

export async function getHomepageCategories() {
  const { data } = await api.get("/api/categories/homepage");
  return data.data;
}

export async function getHeroBannerCategories() {
  const { data } = await api.get("/api/categories/hero-banner");
  const payload = data?.data ?? data ?? {};
  return {
    categories: Array.isArray(payload.categories) ? payload.categories : [],
    config: payload.config ?? {},
  };
}

export async function getHomepageHeroBanner() {
  const { data } = await api.get("/api/homepage/hero-banner");
  return data.data;
}

export async function getCategoryBySlug(slug) {
  const { data } = await api.get(`/api/categories/slug/${slug}`);
  return data.data;
}

export async function trackCategoryEvent(categoryId, payload) {
  if (!categoryId) return null;
  const { data } = await api.post(`/api/categories/${categoryId}/track`, payload);
  return data.data;
}

export async function getAdminCategories() {
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

export async function uploadCategoryMedia(id, formData) {
  const { data } = await adminHttp.post(`/api/admin/categories/${id}/media`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getCategoryCarouselConfig() {
  const { data } = await adminHttp.get("/api/admin/categories/carousel-config");
  return data.data;
}

export async function updateCategoryCarouselConfig(payload) {
  const { data } = await adminHttp.put("/api/admin/categories/carousel-config", payload);
  return data.data;
}

export async function getCategoryAnalyticsSummary() {
  const { data } = await adminHttp.get("/api/admin/categories/analytics/summary");
  return data.data;
}
