import { getAbsoluteUrl } from "./urls";

export const getCanonicalUrl = (url) => {
  // Always use the absolute URL version (which already enforces HTTPS and trailing slash removal)
  const baseCanonical = getAbsoluteUrl(url || (typeof window !== "undefined" ? window.location.pathname : ""));
  
  try {
    const urlObj = new URL(baseCanonical);
    
    // Completely strip all query parameters to prevent duplicate indexing
    // (e.g. ?route=, ?ref=, ?utm_source=)
    urlObj.search = "";
    
    // Completely strip all hash fragments (e.g. #section-1)
    urlObj.hash = "";
    
    // Convert back to string and remove any lingering trailing slashes 
    // that the URL object might append to the origin (e.g. https://domain.com/ -> https://domain.com)
    let finalUrl = urlObj.toString();
    if (finalUrl.endsWith("/") && finalUrl.split("/").length > 3) {
       finalUrl = finalUrl.slice(0, -1);
    }
    
    return finalUrl;
  } catch (error) {
    // Fallback if URL parsing fails
    return baseCanonical;
  }
};
