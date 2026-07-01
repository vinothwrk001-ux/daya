/**
 * API base URL for axios and asset resolution.
 * In dev, defaults to "" so Vite proxies /api and /uploads to the backend (works on LAN).
 * Set VITE_API_URL to override (e.g. production build or direct backend access).
 */
export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) {
    return String(configured).replace(/\/$/, "");
  }
  if (import.meta.env.DEV) {
    return "";
  }
  return "http://localhost:5000";
}
