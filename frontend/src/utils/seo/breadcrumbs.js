import { getAbsoluteUrl } from "./urls";

export const buildBreadcrumbSchema = (breadcrumbs, currentUrl) => {
  if (!breadcrumbs || !Array.isArray(breadcrumbs) || breadcrumbs.length === 0) {
    return null;
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": crumb.name,
      "item": crumb.url ? getAbsoluteUrl(crumb.url) : currentUrl,
    })),
  };
};
