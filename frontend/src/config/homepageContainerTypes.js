function normalizeContainerType(type) {
  return String(type || "").trim().toUpperCase();
}

export function isVendorStorefrontContainerType(type) {
  const next = normalizeContainerType(type);
  return next.startsWith("VENDOR_") && (next.includes("STOREFRONT") || next.endsWith("_STORES"));
}

export function isInfluencerStorefrontContainerType(type) {
  const next = normalizeContainerType(type);
  return next.startsWith("INFLUENCER_") && (next.includes("STOREFRONT") || next.endsWith("_CREATORS"));
}

export function isStorefrontDiscoveryContainerType(type) {
  return isVendorStorefrontContainerType(type) || isInfluencerStorefrontContainerType(type);
}
