export const getBaseUrl = () => {
  let url = import.meta.env.VITE_FRONTEND_URL || "https://dayacreatives.com";
  
  // Force HTTPS if someone accidentally configured it as HTTP in prod
  if (url.startsWith("http://") && !url.includes("localhost")) {
    url = url.replace("http://", "https://");
  }
  
  return url;
};

export const getAbsoluteUrl = (path = "") => {
  const baseUrl = getBaseUrl();
  
  // If already an absolute URL, just return it (after enforcing HTTPS and stripping trailing slash)
  if (path.startsWith("http")) {
    let absolutePath = path;
    if (absolutePath.startsWith("http://") && !absolutePath.includes("localhost")) {
      absolutePath = absolutePath.replace("http://", "https://");
    }
    // Remove trailing slash for absolute paths (unless it's just the root domain)
    if (absolutePath.endsWith("/") && absolutePath.length > (baseUrl.length + 1)) {
      return absolutePath.slice(0, -1);
    }
    return absolutePath;
  }
  
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  let normalizedPath = path.startsWith("/") ? path : `/${path}`;
  
  // Remove trailing slash to prevent canonical duplication (e.g. /about/ vs /about)
  if (normalizedPath.length > 1 && normalizedPath.endsWith("/")) {
    normalizedPath = normalizedPath.slice(0, -1);
  }
  
  return `${normalizedBase}${normalizedPath}`;
};
