import { resolveApiAssetUrl } from "./resolveUrl";
import { findMatchingVariant, getDefaultVariant, getVariantGroups } from "./productVariants";

const SWATCH_COLOR_MAP = {
  black: "#111827",
  white: "#f8fafc",
  red: "#dc2626",
  blue: "#2563eb",
  green: "#16a34a",
  yellow: "#facc15",
  orange: "#f97316",
  purple: "#7c3aed",
  violet: "#8b5cf6",
  pink: "#ec4899",
  gray: "#6b7280",
  grey: "#6b7280",
  silver: "#cbd5e1",
  gold: "#d4af37",
  navy: "#1e3a8a",
  brown: "#92400e",
  beige: "#d6d3d1",
  cream: "#f5f5dc",
  maroon: "#7f1d1d",
  teal: "#0f766e",
};

export function resolveSwatchColor(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.startsWith("#")) return normalized;
  return SWATCH_COLOR_MAP[normalized] || null;
}

export function isColorLikeGroup(group) {
  const key = String(group?.key || "").toLowerCase();
  const name = String(group?.name || "").toLowerCase();
  return key.includes("color") || key.includes("colour") || name.includes("color") || name.includes("colour");
}

export function getCardSwatchGroup(product) {
  const groups = getVariantGroups(product);
  if (!groups.length) return null;
  return groups.find(isColorLikeGroup) || null;
}

export function getActiveVariants(product) {
  return Array.isArray(product?.variants) ? product.variants.filter((item) => item?.isActive !== false) : [];
}

export function getVariantAttributeValue(variant, attributeKey) {
  const attributes = variant?.attributes;
  if (!attributes || !attributeKey) return undefined;
  if (attributes instanceof Map) {
    return attributes.get(attributeKey);
  }
  return attributes[attributeKey];
}

export function findVariantForAttributeValue(product, attributeKey, attributeValue, preferredAttributes = {}) {
  const variants = getActiveVariants(product);
  const matches = variants.filter(
    (variant) => getVariantAttributeValue(variant, attributeKey) === attributeValue
  );
  if (!matches.length) return null;

  const compatible = matches.filter((variant) =>
    Object.entries(preferredAttributes).every(([key, value]) => {
      if (!value || key === attributeKey) return true;
      return getVariantAttributeValue(variant, key) === value;
    })
  );

  const pool = compatible.length ? compatible : matches;
  return pool.find((variant) => Number(variant?.stock || 0) > 0) || pool[0] || null;
}

export function resolveActiveVariant(product, selectedAttributes = {}) {
  const variants = getActiveVariants(product);
  if (!variants.length) return null;

  return (
    findMatchingVariant(variants, selectedAttributes) ||
    findVariantForAttributeValue(
      product,
      getCardSwatchGroup(product)?.key,
      selectedAttributes?.[getCardSwatchGroup(product)?.key],
      selectedAttributes
    ) ||
    getDefaultVariant(product)
  );
}

export function getVariantPrimaryImageUrl(variant, product) {
  const variantImages = Array.isArray(variant?.images) ? variant.images : [];
  const primaryVariantImage =
    variantImages.find((image) => image?.isPrimary && image?.url)?.url ||
    variantImages.find((image) => image?.url)?.url ||
    "";

  if (primaryVariantImage) {
    return primaryVariantImage;
  }

  return product?.images?.find((image) => image?.url)?.url || product?.images?.[0]?.url || "";
}

export function getVariantSecondaryImageUrl(variant, product) {
  const variantImages = (Array.isArray(variant?.images) ? variant.images : [])
    .filter((image) => image?.url)
    .sort((a, b) => Number(a?.sortOrder ?? 0) - Number(b?.sortOrder ?? 0));

  if (variantImages.length > 1) {
    const primary =
      variantImages.find((image) => image?.isPrimary)?.url || variantImages[0]?.url || "";
    const secondary =
      variantImages.find((image) => image.url !== primary)?.url ||
      variantImages[1]?.url ||
      "";
    return secondary;
  }

  // Never fall back to product-level hover when this variant already has its own image —
  // that global hover image belongs to the default/listing view, not other color variants.
  if (variantImages.length === 1) {
    return "";
  }

  const hoverImage = product?.hoverImage?.[0]?.url || product?.hoverImage?.[0] || "";
  return hoverImage || "";
}

export function getVariantPricing(variant, product) {
  const price = Number(variant?.price ?? product?.price ?? 0);
  const salePrice = Number(variant?.discountPrice ?? product?.discountPrice ?? price);
  const hasDiscount = salePrice > 0 && price > salePrice;
  return {
    price,
    salePrice,
    hasDiscount,
    discountPercent: hasDiscount ? Math.round(((price - salePrice) / price) * 100) : 0,
  };
}

export function getVariantStock(variant, product) {
  return Number(variant?.stock ?? product?.stock ?? 0);
}

export function buildProductDetailUrl(productId, variantId = "") {
  if (!productId) return "/shop";
  const params = new URLSearchParams();
  if (variantId) params.set("variantId", String(variantId));
  const query = params.toString();
  return query ? `/product/${productId}?${query}` : `/product/${productId}`;
}

export function resolveInitialSelectedAttributes(product, variantIdFromUrl = "") {
  const variants = getActiveVariants(product);
  if (!variants.length) return {};

  if (variantIdFromUrl) {
    const matched = variants.find((variant) => String(variant.variantId) === String(variantIdFromUrl));
    if (matched?.attributes) {
      return { ...matched.attributes };
    }
  }

  const defaultVariant = getDefaultVariant(product);
  return defaultVariant?.attributes ? { ...defaultVariant.attributes } : {};
}

export function preloadImageUrls(urls = []) {
  if (typeof window === "undefined") return;
  for (const rawUrl of urls) {
    const url = resolveApiAssetUrl(rawUrl);
    if (!url) continue;
    const image = new window.Image();
    image.src = url;
  }
}

export function collectVariantImageUrls(product, swatchGroup) {
  if (!swatchGroup?.key) return [];
  const urls = new Set();

  for (const option of swatchGroup.values || []) {
    const variant = findVariantForAttributeValue(product, swatchGroup.key, option.value);
    const primary = getVariantPrimaryImageUrl(variant, product);
    const secondary = getVariantSecondaryImageUrl(variant, product);
    if (primary) urls.add(primary);
    if (secondary) urls.add(secondary);
  }

  return [...urls];
}

export function normalizeVariantAttributes(variant) {
  if (!variant?.attributes) return {};
  if (variant.attributes instanceof Map) {
    return Object.fromEntries(variant.attributes.entries());
  }
  if (typeof variant.attributes === "object") {
    return { ...variant.attributes };
  }
  return {};
}
