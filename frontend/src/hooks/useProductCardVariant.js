import { useCallback, useEffect, useMemo, useState } from "react";
import { resolveApiAssetUrl } from "../utils/resolveUrl";
import { getDefaultVariant } from "../utils/productVariants";
import {
  buildProductDetailUrl,
  collectVariantImageUrls,
  findVariantForAttributeValue,
  getCardSwatchGroup,
  getVariantPricing,
  getVariantPrimaryImageUrl,
  getVariantSecondaryImageUrl,
  getVariantStock,
  preloadImageUrls,
  resolveActiveVariant,
  normalizeVariantAttributes,
} from "../utils/variantDisplay";
import { extractProductId } from "../utils/cartState";

export function useProductCardVariant(product) {
  const productId = useMemo(() => extractProductId(product), [product]);
  const swatchGroup = useMemo(() => getCardSwatchGroup(product), [product]);
  const defaultVariant = useMemo(() => getDefaultVariant(product), [product]);
  const variantSignature = useMemo(
    () => (Array.isArray(product?.variants) ? product.variants.map((item) => item?.variantId).join("|") : ""),
    [product?.variants]
  );

  const [selectedAttributes, setSelectedAttributes] = useState(() => normalizeVariantAttributes(defaultVariant));

  // Reset only when the product (or its variant list) changes — not on every parent re-render.
  useEffect(() => {
    setSelectedAttributes(normalizeVariantAttributes(getDefaultVariant(product)));
  }, [productId, variantSignature]);

  useEffect(() => {
    preloadImageUrls(collectVariantImageUrls(product, swatchGroup));
  }, [product, swatchGroup]);

  const activeVariant = useMemo(
    () => resolveActiveVariant(product, selectedAttributes),
    [product, selectedAttributes]
  );

  const imageUrl = useMemo(
    () => resolveApiAssetUrl(getVariantPrimaryImageUrl(activeVariant, product)),
    [activeVariant, product]
  );

  const hoverImageUrl = useMemo(() => {
    const secondary = getVariantSecondaryImageUrl(activeVariant, product);
    if (secondary) return resolveApiAssetUrl(secondary);

    // HOVER card type: fall back to product-level hover only when variant has no images of its own
    const variantImages = Array.isArray(activeVariant?.images)
      ? activeVariant.images.filter((image) => image?.url)
      : [];
    if (product?.cardType === "HOVER" && variantImages.length === 0) {
      const productHover = product?.hoverImage?.[0]?.url || product?.hoverImage?.[0] || "";
      return productHover ? resolveApiAssetUrl(productHover) : "";
    }

    return "";
  }, [activeVariant, product]);

  const pricing = useMemo(() => getVariantPricing(activeVariant, product), [activeVariant, product]);
  const stock = useMemo(() => getVariantStock(activeVariant, product), [activeVariant, product]);
  const inStock = stock > 0;
  const detailUrl = useMemo(
    () => buildProductDetailUrl(productId, activeVariant?.variantId),
    [productId, activeVariant?.variantId]
  );

  const selectSwatchValue = useCallback(
    (value) => {
      if (!swatchGroup?.key) return;
      setSelectedAttributes((current) => {
        const matchedVariant = findVariantForAttributeValue(product, swatchGroup.key, value, current);
        if (matchedVariant) {
          return normalizeVariantAttributes(matchedVariant);
        }
        return { ...current, [swatchGroup.key]: value };
      });
    },
    [product, swatchGroup?.key]
  );

  useEffect(() => {
    const urls = [imageUrl, hoverImageUrl].filter(Boolean);
    preloadImageUrls(urls);
  }, [imageUrl, hoverImageUrl]);

  return {
    productId,
    swatchGroup,
    swatchOptions: swatchGroup?.values || [],
    selectedAttributes,
    selectedSwatchValue: swatchGroup?.key ? selectedAttributes?.[swatchGroup.key] : "",
    activeVariant,
    imageUrl,
    hoverImageUrl,
    pricing,
    stock,
    inStock,
    detailUrl,
    selectSwatchValue,
  };
}
