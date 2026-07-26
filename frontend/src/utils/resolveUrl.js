import { getApiBaseUrl } from "./apiBaseUrl";

export function resolveApiAssetUrl(url) {
  if (Array.isArray(url)) {
    return resolveApiAssetUrl(url[0]);
  }
  if (url && typeof url === "object") {
    url = url.url || url.secureUrl || url.path || url.src || "";
  }
  if (!url) return url;
  url = String(url);
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;

  const base = getApiBaseUrl();
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${base}${path}`;
}

