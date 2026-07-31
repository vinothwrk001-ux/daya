/**
 * SEO Utilities
 */

// Get the base frontend URL safely
export const getBaseUrl = () => {
  return import.meta.env.VITE_FRONTEND_URL || 'https://dayacreatives.com';
};

// Ensure URL is absolute
export const getAbsoluteUrl = (path = '') => {
  const baseUrl = getBaseUrl();
  if (path.startsWith('http')) return path;
  
  // ensure single slash between base and path
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${normalizedBase}${normalizedPath}`;
};

// Ensure image is absolute, fallback to a default logo if missing
export const getAbsoluteImageUrl = (url) => {
  if (!url) return getAbsoluteUrl('/assets/images/logo.png'); // Replace with actual default logo path
  if (url.startsWith('http')) return url;
  return getAbsoluteUrl(url);
};

// Generate a fallback description if missing
export const getFallbackDescription = (str, maxLength = 155) => {
  if (!str) return 'Discover premium fashion, creative services, workshops, web development, and graphic design at Daya Creatives.';
  const stripped = str.replace(/(<([^>]+)>)/gi, ''); // Strip HTML if any
  if (stripped.length <= maxLength) return stripped;
  return stripped.substring(0, maxLength).trim() + '...';
};
