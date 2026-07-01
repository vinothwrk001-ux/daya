export function getReelLinkedProducts(reel) {
  if (!reel) return [];
  if (Array.isArray(reel.linkedProducts) && reel.linkedProducts.length) {
    return reel.linkedProducts;
  }
  if (Array.isArray(reel.products) && reel.products.length) {
    return reel.products.map((product, index) => ({
      productId: product._id || product.productId,
      name: product.name,
      slug: product.slug,
      image: product.image || product.images?.[0]?.url || product.images?.[0],
      images: product.images,
      price: product.price,
      salePrice: product.salePrice,
      stockStatus: product.stockStatus,
      category: product.category,
      sortOrder: product.sortOrder ?? index,
      featured: product.featured ?? index === 0,
      rating: product.rating,
      variants: product.variants,
      sku: product.sku,
    }));
  }
  return [];
}

export function getReelProductCount(reel) {
  return getReelLinkedProducts(reel).length;
}

export function buildReelProductPath(product, reelId, variantId = "") {
  const productKey = product.slug || product._id || product.productId;
  const params = new URLSearchParams({ reel: reelId });
  if (variantId) params.set("variantId", String(variantId));
  return `/product/${productKey}?${params.toString()}`;
}

export const REEL_MAX_LINKED_PRODUCTS = 20;
