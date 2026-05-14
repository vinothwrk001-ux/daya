import { api } from "./api";

export async function prepareCheckout(payload = {}) {
  const { data } = await api.post("/api/checkout/prepare", payload, { timeout: 15000 });
  return data;
}

export async function prepareGuestCheckout(payload = {}) {
  const { data } = await api.post("/api/checkout/guest/prepare", payload, { timeout: 15000 });
  return data;
}

export async function createOrder(payload) {
  const { data } = await api.post("/api/checkout/create", payload, { timeout: 15000 });
  return data;
}

