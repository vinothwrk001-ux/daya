import { api } from "./api";
import { adminHttp } from "./adminHttp";

export async function createRazorpayOrder(payload) {
  const { data } = await api.post("/api/payments/create-order", payload, { timeout: 60000 });
  return data?.data || data;
}

export async function verifyRazorpayPayment(payload) {
  const { data } = await api.post("/api/payments/verify", payload, { timeout: 60000 });
  return data?.data || data;
}

export async function checkCodAvailability(payload) {
  const { data } = await api.post("/api/payments/cod/check", payload);
  return data?.data || data;
}

export async function collectCodPayment(payload) {
  const { data } = await adminHttp.post("/api/payments/cod/collect", payload);
  return data?.data || data;
}

export async function listPayments(params = {}) {
  const { data } = await adminHttp.get("/api/payments", { params });
  return data?.data || data;
}

export async function getPaymentDetails(id) {
  const { data } = await adminHttp.get(`/api/payments/${id}`);
  return data?.data || data;
}

export async function listRefunds(params = {}) {
  const { data } = await adminHttp.get("/api/payments/refunds", { params });
  return data?.data || data;
}

export async function createRefund(payload) {
  const { data } = await adminHttp.post("/api/payments/refund", payload);
  return data?.data || data;
}

export async function reviewRefund(id, payload) {
  const { data } = await adminHttp.patch(`/api/payments/refunds/${id}`, payload);
  return data?.data || data;
}

export async function getCodSettings() {
  const { data } = await adminHttp.get("/api/admin/cod/settings");
  return data?.data || data;
}

export async function updateCodSettings(payload) {
  const { data } = await adminHttp.put("/api/admin/cod/settings", payload);
  return data?.data || data;
}

export async function getCodAnalytics(params = {}) {
  const { data } = await adminHttp.get("/api/admin/cod/analytics", { params });
  return data?.data || data;
}

export async function getRazorpaySettings() {
  const { data } = await adminHttp.get("/api/payments/settings/razorpay");
  return data?.data || data;
}

export async function updateRazorpaySettings(payload) {
  const { data } = await adminHttp.put("/api/payments/settings/razorpay", payload);
  return data?.data || data;
}

