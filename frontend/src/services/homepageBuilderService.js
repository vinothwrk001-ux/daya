import { api } from "./api";
import { adminHttp } from "./adminHttp";

export async function getHomepageBuilderPublicLayout(params = {}) {
  const { data } = await api.get("/api/homepage-builder/public", { params });
  return data;
}

export async function listHomepageBuilderContainers() {
  const { data } = await adminHttp.get("/api/admin/homepage-builder/containers");
  return data;
}

export async function listHomepageBuilderLayouts() {
  const { data } = await adminHttp.get("/api/admin/homepage-builder/layouts");
  return data;
}

export async function getHomepageBuilderLayout(id) {
  const { data } = await adminHttp.get(`/api/admin/homepage-builder/layouts/${id}`);
  return data;
}

export async function createHomepageBuilderLayout(payload) {
  const { data } = await adminHttp.post("/api/admin/homepage-builder/layouts", payload);
  return data;
}

export async function saveHomepageBuilderDraft(id, payload) {
  const { data } = await adminHttp.put(`/api/admin/homepage-builder/layouts/${id}/draft`, payload);
  return data;
}

export async function previewHomepageBuilderLayout(payload) {
  const { data } = await adminHttp.post("/api/admin/homepage-builder/preview", payload);
  return data;
}

export async function publishHomepageBuilderLayout(id) {
  const { data } = await adminHttp.post(`/api/admin/homepage-builder/layouts/${id}/publish`);
  return data;
}

export async function listHomepageBuilderVersions(id) {
  const { data } = await adminHttp.get(`/api/admin/homepage-builder/layouts/${id}/versions`);
  return data;
}

export async function rollbackHomepageBuilderVersion(id, versionId) {
  const { data } = await adminHttp.post(`/api/admin/homepage-builder/layouts/${id}/rollback/${versionId}`);
  return data;
}

export async function uploadHomepageBuilderMedia(files = []) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("images", file);
  }
  const { data } = await adminHttp.post("/api/admin/homepage-builder/media", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
