import { adminHttp } from "./adminHttp";
import { api } from "./api";

export async function getPublicTheme(params = {}) {
  const response = await api.get("/api/public/theme", { params });
  return response.data.data;
}

export async function listThemes(params = {}) {
  const response = await adminHttp.get("/api/admin/theme-engine", { params });
  return response.data.data;
}

export async function getTheme(id) {
  const response = await adminHttp.get(`/api/admin/theme-engine/${id}`);
  return response.data.data;
}

export async function createTheme(body, params = {}) {
  const response = await adminHttp.post("/api/admin/theme-engine", body, { params });
  return response.data.data;
}

export async function updateTheme(id, body) {
  const response = await adminHttp.put(`/api/admin/theme-engine/${id}`, body);
  return response.data.data;
}

export async function duplicateTheme(id) {
  const response = await adminHttp.post(`/api/admin/theme-engine/${id}/duplicate`);
  return response.data.data;
}

export async function publishTheme(id) {
  const response = await adminHttp.post(`/api/admin/theme-engine/${id}/publish`);
  return response.data.data;
}

export async function scheduleTheme(id, schedule) {
  const response = await adminHttp.post(`/api/admin/theme-engine/${id}/schedule`, { schedule });
  return response.data.data;
}

export async function previewTheme(id, params = {}) {
  const response = await adminHttp.get(`/api/admin/theme-engine/${id}/preview`, { params });
  return response.data.data;
}

export async function getThemeVersions(id) {
  const response = await adminHttp.get(`/api/admin/theme-engine/${id}/versions`);
  return response.data.data;
}

export async function rollbackTheme(id, versionId) {
  const response = await adminHttp.post(`/api/admin/theme-engine/${id}/rollback/${versionId}`);
  return response.data.data;
}

export async function deleteTheme(id) {
  const response = await adminHttp.delete(`/api/admin/theme-engine/${id}`);
  return response.data.data;
}

export async function createThemeFromPreset(presetKey, params = {}) {
  const response = await adminHttp.post(`/api/admin/theme-engine/presets/${presetKey}`, {}, { params });
  return response.data.data;
}

export function notifyThemeUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("theme:updated"));
    try {
      localStorage.setItem("theme:updated", String(Date.now()));
    } catch {
      // ignore storage failures
    }
  }
}
