import { adminHttp } from "./adminHttp";
import { api } from "./api";

export async function getCompanyBranding(params = {}) {
  const response = await adminHttp.get("/api/admin/company-branding", { params });
  return response.data.data;
}

export async function createCompanyBranding(body, options = {}) {
  const response = await adminHttp.post("/api/admin/company-branding", body, {
    headers: options.isFormData ? { "Content-Type": "multipart/form-data" } : undefined,
  });
  return response.data.data;
}

export async function updateCompanyBranding(id, body, options = {}) {
  const response = await adminHttp.put(`/api/admin/company-branding/${id}`, body, {
    headers: options.isFormData ? { "Content-Type": "multipart/form-data" } : undefined,
  });
  return response.data.data;
}

export async function deleteCompanyBrandingAsset(id, slot) {
  const response = await adminHttp.delete(`/api/admin/company-branding/logo/${id}`, {
    data: { slot },
    params: { slot },
  });
  return response.data.data;
}

export async function getCompanyBrandingVersions(id) {
  const response = await adminHttp.get(`/api/admin/company-branding/${id}/versions`);
  return response.data.data;
}

export async function rollbackCompanyBranding(id, versionId) {
  const response = await adminHttp.post(`/api/admin/company-branding/${id}/rollback/${versionId}`);
  return response.data.data;
}

export async function getPublicBranding(params = {}) {
  const response = await api.get("/api/public/branding", { params });
  return response.data.data;
}
