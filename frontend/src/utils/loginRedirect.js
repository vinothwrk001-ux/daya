/**
 * Login Redirect Utility
 * 
 * Manages storing and retrieving the redirect URL for post-login navigation.
 * Allows users to return to the page they were viewing before logging in.
 */

const STORAGE_KEY = "redirectAfterLogin";
const isDev = import.meta.env.DEV;

/**
 * Safe URLs that are allowed for redirects
 */
const SAFE_REDIRECT_PREFIXES = [
  "/product/",
  "/products",
  "/shop",
  "/cart",
  "/checkout",
  "/orders",
  "/wishlist",
  "/influencer/",
  "/user/",
  "/addresses",
  "/profile",
  "/reviews",
  "/support",
  "/notifications",
  "/settings",
  "/",
];

/**
 * Check if URL is safe for redirect
 */
function isSafeRedirectUrl(url) {
  if (!url || typeof url !== "string") return false;
  
  // Extract pathname from full URLs
  let pathname = url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      pathname = new URL(url).pathname;
    } catch {
      return false;
    }
  }
  
  // Check against safe prefixes
  return SAFE_REDIRECT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Save the current URL to redirect to after successful login
 * @param {string} url - The URL to redirect to after login
 */
export function saveRedirectAfterLogin(url) {
  if (typeof window === "undefined" || !url) return;
  
  try {
    // Only save safe URLs
    if (!isSafeRedirectUrl(url)) {
      return;
    }
    
    // Extract pathname and search from URL
    let target = url;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      try {
        const urlObj = new URL(url);
        target = urlObj.pathname + urlObj.search;
      } catch {
        return;
      }
    }
    
    // Use localStorage for persistence across sessions
    localStorage.setItem(STORAGE_KEY, target);
  } catch (error) {
    // Silently fail
    if (isDev) {
      console.debug("Failed to save redirect URL:", error);
    }
  }
}

/**
 * Retrieve and clear the stored redirect URL
 * @returns {string|null} The stored redirect URL or null if not found
 */
export function consumeRedirectAfterLogin() {
  if (typeof window === "undefined") return null;
  
  try {
    // Try localStorage first (persistent redirect)
    let redirect = localStorage.getItem(STORAGE_KEY);
    if (redirect) {
      localStorage.removeItem(STORAGE_KEY);
      if (isSafeRedirectUrl(redirect)) {
        return redirect;
      }
    }
    
    // Fall back to sessionStorage for backward compatibility
    redirect = window.sessionStorage.getItem(STORAGE_KEY) || null;
    if (redirect && isSafeRedirectUrl(redirect)) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return redirect;
    }
    
    return null;
  } catch (error) {
    // Silently fail
    if (isDev) {
      console.debug("Failed to consume redirect URL:", error);
    }
    return null;
  }
}

/**
 * Clear any stored redirect URL
 */
export function clearRedirectAfterLogin() {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    // Silently fail
    if (isDev) {
      console.debug("Failed to clear redirect URL:", error);
    }
  }
}
