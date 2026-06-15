import { api } from "./api";

const BUY_NOW_SESSION_KEY = "buy_now_checkout_session";
const BUY_NOW_GUEST_TOKEN_KEY = "buy_now_guest_token";

export function getOrCreateGuestToken() {
  if (typeof window === "undefined") return "";
  try {
    const existing = sessionStorage.getItem(BUY_NOW_GUEST_TOKEN_KEY);
    if (existing) return existing;
    const token = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    sessionStorage.setItem(BUY_NOW_GUEST_TOKEN_KEY, token);
    return token;
  } catch {
    return "";
  }
}

export function persistBuyNowSession(session) {
  if (typeof window === "undefined" || !session?.sessionId) return;
  try {
    sessionStorage.setItem(
      BUY_NOW_SESSION_KEY,
      JSON.stringify({
        sessionId: session.sessionId,
        guestToken: session.guestToken || "",
        expiresAt: session.expiresAt || null,
      })
    );
    if (session.guestToken) {
      sessionStorage.setItem(BUY_NOW_GUEST_TOKEN_KEY, session.guestToken);
    }
  } catch {
    // Ignore storage failures.
  }
}

export function getPersistedBuyNowSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(BUY_NOW_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.expiresAt && new Date(parsed.expiresAt).getTime() <= Date.now()) {
      clearBuyNowSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearBuyNowSession() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(BUY_NOW_SESSION_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function getBuyNowGuestToken() {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(BUY_NOW_GUEST_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export async function createBuyNowSession(productId, quantity = 1, variantId = "", { guestToken = "" } = {}) {
  const payload = {
    productId,
    quantity,
    variantId,
    ...(guestToken ? { guestToken } : {}),
  };
  const { data } = await api.post("/api/checkout/buy-now/session", payload);
  const session = data?.data || data;
  persistBuyNowSession(session);
  return session;
}

export async function attachBuyNowSessionToUser(sessionId, guestToken = "") {
  const { data } = await api.post(`/api/checkout/buy-now/session/${sessionId}/attach-user`, {
    guestToken,
  });
  return data?.data || data;
}

export async function updateBuyNowSessionQuantity(sessionId, quantity, guestToken = "") {
  const { data } = await api.patch(`/api/checkout/buy-now/session/${sessionId}`, {
    quantity,
    guestToken,
  });
  return data?.data || data;
}

export async function prepareBuyNowCheckout(sessionId, payload = {}, guestToken = "") {
  const { data } = await api.post(`/api/checkout/buy-now/session/${sessionId}/prepare`, {
    ...payload,
    guestToken,
  });
  return data?.data || data;
}

export async function createBuyNowOrder(sessionId, payload) {
  const { data } = await api.post(`/api/checkout/buy-now/session/${sessionId}/create`, payload, {
    timeout: 15000,
  });
  return data;
}

export const buyNowSessionService = {
  getOrCreateGuestToken,
  persistBuyNowSession,
  getPersistedBuyNowSession,
  clearBuyNowSession,
  getBuyNowGuestToken,
  createBuyNowSession,
  attachBuyNowSessionToUser,
  updateBuyNowSessionQuantity,
  prepareBuyNowCheckout,
  createBuyNowOrder,
};

export default buyNowSessionService;
