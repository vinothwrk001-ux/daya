const TRACKING_STORAGE_KEY = "grm_influencer_tracking";

export function saveTrackingContext(context) {
  if (typeof window === "undefined" || !context?.trackingToken) return;
  window.sessionStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(context));
}

export function loadTrackingContext() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(TRACKING_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearTrackingContext() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(TRACKING_STORAGE_KEY);
}
