const TRACKING_STORAGE_KEY = "grm_influencer_tracking";

export function saveTrackingContext(context) {
  if (typeof window === "undefined" || !context?.trackingToken) return;
  const payload = {
    ...context,
    savedAt: Date.now(),
    expiresAt: context.expiresAt || Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
  window.sessionStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(payload));
  window.localStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(payload));
  document.cookie = `${TRACKING_STORAGE_KEY}=${encodeURIComponent(context.trackingToken)}; max-age=${30 * 24 * 60 * 60}; path=/; samesite=lax`;
}

export function loadTrackingContext() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(TRACKING_STORAGE_KEY) || window.localStorage.getItem(TRACKING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.expiresAt && Number(parsed.expiresAt) < Date.now()) {
      clearTrackingContext();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearTrackingContext() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(TRACKING_STORAGE_KEY);
  window.localStorage.removeItem(TRACKING_STORAGE_KEY);
  document.cookie = `${TRACKING_STORAGE_KEY}=; max-age=0; path=/; samesite=lax`;
}
