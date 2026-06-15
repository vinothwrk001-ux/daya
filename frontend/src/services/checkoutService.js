import { api } from "./api";
import { getReelAttribution } from "./reelService";

export async function prepareCheckout(payload = {}) {
  const { data } = await api.post("/api/checkout/prepare", payload, { timeout: 15000 });
  return data;
}

export async function prepareGuestCheckout(payload = {}) {
  const { data } = await api.post("/api/checkout/guest/prepare", payload, { timeout: 15000 });
  return data;
}

export async function createOrder(payload) {
  const reelAttribution = getReelAttribution();
  const requestPayload = {
    ...payload,
    ...(reelAttribution?.sessionId ? { reelAttributionSessionId: reelAttribution.sessionId } : {}),
  };
  const { data } = await api.post("/api/checkout/create", requestPayload, { timeout: 15000 });
  return data;
}

