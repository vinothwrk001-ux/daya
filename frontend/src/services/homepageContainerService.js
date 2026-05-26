import { api } from "./api";
import { adminHttp } from "./adminHttp";

export async function getHomepageContainerSchemas() {
  const { data } = await adminHttp.get("/api/admin/homepage-containers/schemas");
  return data;
}

export async function getHomepageContainerSchema(type) {
  const { data } = await adminHttp.get(`/api/admin/homepage-containers/schema/${type}`);
  return data;
}

export async function getHomepageContainerProducts(slug, params = {}) {
  const { data } = await api.get(`/api/homepage-containers/${slug}/products`, { params });
  return data;
}

export async function listAdminHomepageContainers(params = {}) {
  const { data } = await adminHttp.get("/api/admin/homepage-containers", { params });
  return data;
}

export async function createAdminHomepageContainer(payload) {
  const { data } = await adminHttp.post("/api/admin/homepage-containers", payload);
  return data;
}

export async function updateAdminHomepageContainer(id, payload) {
  const { data } = await adminHttp.put(`/api/admin/homepage-containers/${id}`, payload);
  return data;
}

export async function deleteAdminHomepageContainer(id) {
  const { data } = await adminHttp.delete(`/api/admin/homepage-containers/${id}`);
  return data;
}

export async function reorderAdminHomepageContainers(items) {
  const { data } = await adminHttp.post("/api/admin/homepage-containers/reorder", { items });
  return data;
}

export async function previewAdminHomepageContainer(payload) {
  const { data } = await adminHttp.post("/api/admin/homepage-containers/preview", payload);
  return data;
}

export async function uploadHomepageContainerMedia(files = []) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("images", file);
  }
  const { data } = await adminHttp.post("/api/admin/homepage-containers/media", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function trackHomepageContainerEvent(id, payload) {
  const { data } = await api.post(`/api/homepage-containers/${id}/track`, payload);
  return data;
}
