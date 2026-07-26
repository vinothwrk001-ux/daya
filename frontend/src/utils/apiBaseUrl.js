/**
 * API base URL for axios and asset resolution.
 * In dev and preview, defaults to "" so Vite proxies /api and /uploads to the backend.
 * Set VITE_API_URL to override (e.g. production build or direct backend access).
 */
export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL;
  // If explicitly configured to a full URL, use it
  if (configured && configured.startsWith("http")) {
    return String(configured).replace(/\/$/, "");
  }
  // Otherwise, default to empty string so requests are relative (and handled by Vite proxy or same-domain production server)
  return "";
}
