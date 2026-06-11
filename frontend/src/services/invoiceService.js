import { api } from "./api";
import { adminHttp } from "./adminHttp";

function triggerBlobDownload(response, fallbackName) {
  const blob = new Blob([response.data], { type: response.headers["content-type"] || "application/pdf" });
  const contentDisposition = response.headers["content-disposition"] || "";
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || fallbackName;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function getInvoiceSettings() {
  const { data } = await adminHttp.get("/api/invoices/settings");
  return data?.data || data;
}

export async function updateInvoiceSettings(payload, { isFormData = false } = {}) {
  const { data } = await adminHttp.put("/api/invoices/settings", payload, {
    headers: isFormData ? { "Content-Type": "multipart/form-data" } : undefined,
  });
  return data?.data || data;
}

export async function listAdminInvoices(params = {}) {
  const { data } = await adminHttp.get("/api/invoices/admin/orders", { params });
  return data?.data || data;
}

export async function getAdminInvoice(orderId) {
  const { data } = await adminHttp.get(`/api/invoices/admin/orders/${orderId}`);
  return data?.data || data;
}

export async function updateAdminInvoiceMetadata(orderId, payload) {
  const { data } = await adminHttp.put(`/api/invoices/admin/orders/${orderId}/metadata`, payload);
  return data?.data || data;
}

export async function getAdminInvoiceAudit(orderId) {
  const { data } = await adminHttp.get(`/api/invoices/admin/orders/${orderId}/audit`);
  return data?.data || data;
}

export async function downloadAdminInvoicePdf(orderId) {
  const response = await adminHttp.get(`/api/invoices/admin/orders/${orderId}/pdf`, { responseType: "blob" });
  triggerBlobDownload(response, `invoice-${orderId}.pdf`);
}

export async function getUserInvoicePreview(orderId) {
  const { data } = await api.get(`/api/invoices/user/orders/${orderId}`);
  return data?.data || data;
}

export async function downloadUserInvoicePdf(orderId) {
  const response = await api.get(`/api/invoices/user/orders/${orderId}/pdf`, { responseType: "blob" });
  triggerBlobDownload(response, `invoice-${orderId}.pdf`);
}
