const mongoose = require("mongoose");
const { AppError } = require("../../utils/AppError");
const { Product } = require("../../models/Product");

const MAX_LINKED_PRODUCTS = Number(process.env.REEL_MAX_LINKED_PRODUCTS || 20);

const PUBLIC_PRODUCT_FILTER = { status: "APPROVED", isActive: true };

function asPlainReel(reel) {
  return reel?.toObject ? reel.toObject() : reel || {};
}

function resolveReelProductLinks(reel) {
  const doc = asPlainReel(reel);
  const linked = (doc.linkedProducts || []).filter((link) => link.active !== false);
  if (linked.length) {
    return [...linked].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  return (doc.associatedProducts || []).map((productId, index) => ({
    productId,
    sortOrder: index,
    featured: index === 0,
    active: true,
  }));
}

function resolveReelProductIds(reel) {
  return resolveReelProductLinks(reel).map((link) => String(link.productId?._id || link.productId));
}

function isProductLinkedToReel(reel, productId) {
  return resolveReelProductIds(reel).includes(String(productId));
}

function buildLinkedFromProductIds(productIds = []) {
  return productIds.map((productId, index) => ({
    productId,
    sortOrder: index,
    featured: index === 0,
    active: true,
  }));
}

function normalizeLinkedProductsInput(items = []) {
  if (!Array.isArray(items)) {
    throw new AppError("linkedProducts must be an array", 400, "VALIDATION_ERROR");
  }

  if (items.length > MAX_LINKED_PRODUCTS) {
    throw new AppError(`Maximum ${MAX_LINKED_PRODUCTS} linked products allowed`, 400, "VALIDATION_ERROR");
  }

  const seen = new Set();
  const normalized = [];

  items.forEach((item, index) => {
    const productId = item?.productId || item?.value || item;
    if (!mongoose.isValidObjectId(productId)) {
      throw new AppError("Invalid productId in linkedProducts", 400, "VALIDATION_ERROR");
    }

    const key = String(productId);
    if (seen.has(key)) return;
    seen.add(key);

    normalized.push({
      productId,
      sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
      featured: Boolean(item.featured),
      active: item.active !== false,
    });
  });

  if (!normalized.some((item) => item.featured) && normalized.length) {
    normalized[0].featured = true;
  }

  return normalized;
}

async function validateLinkedProductIds(productIds = []) {
  if (!productIds.length) return;
  const count = await Product.countDocuments({ _id: { $in: productIds } });
  if (count !== productIds.length) {
    throw new AppError("One or more products not found", 400, "VALIDATION_ERROR");
  }
}

function getStockStatus(product) {
  const stock = Number(product?.totalStock ?? product?.stock ?? 0);
  if (stock <= 0) return "out_of_stock";
  if (stock <= 5) return "low_stock";
  return "in_stock";
}

function resolveProductImage(images = []) {
  const first = images?.[0];
  if (!first) return null;
  if (typeof first === "string") return first;
  return first.url || first.secure_url || null;
}

function serializeFeedProduct(product, link) {
  const price = Number(product.price ?? 0);
  const salePrice = product.salePrice ?? product.discountPrice ?? null;
  const category = product.category;

  return {
    productId: product._id,
    name: product.name,
    slug: product.slug,
    image: resolveProductImage(product.images),
    images: product.images,
    price,
    salePrice: salePrice != null ? Number(salePrice) : null,
    stockStatus: getStockStatus(product),
    category: typeof category === "object" ? category?.name || "" : category || "",
    sortOrder: link.sortOrder ?? 0,
    featured: Boolean(link.featured),
    rating: product.rating,
    reviewCount: product.reviewCount,
    sku: product.sku,
    variants: product.variants || [],
  };
}

function serializeLegacyProduct(feedProduct) {
  return {
    _id: feedProduct.productId,
    name: feedProduct.name,
    slug: feedProduct.slug,
    price: feedProduct.price,
    salePrice: feedProduct.salePrice,
    images: feedProduct.images,
    image: feedProduct.image,
    rating: feedProduct.rating,
    reviewCount: feedProduct.reviewCount,
    sku: feedProduct.sku,
    stockStatus: feedProduct.stockStatus,
    category: feedProduct.category,
    variants: feedProduct.variants,
    sortOrder: feedProduct.sortOrder,
    featured: feedProduct.featured,
  };
}

async function fetchProductsMap(productIds = []) {
  if (!productIds.length) return new Map();

  const products = await Product.find({ _id: { $in: productIds }, ...PUBLIC_PRODUCT_FILTER })
    .select(
      "name slug price salePrice discountPrice images rating reviewCount sku stock totalStock category variants"
    )
    .populate("category", "name slug")
    .lean();

  return new Map(products.map((product) => [String(product._id), product]));
}

async function populateReelProducts(reels = []) {
  const list = Array.isArray(reels) ? reels : [reels];
  const allIds = [...new Set(list.flatMap((reel) => resolveReelProductIds(reel)))];
  const productMap = await fetchProductsMap(allIds);

  return list.map((reel) => {
    const doc = asPlainReel(reel);
    const links = resolveReelProductLinks(doc);
    const linkedProducts = links
      .map((link) => {
        const product = productMap.get(String(link.productId?._id || link.productId));
        if (!product) return null;
        return serializeFeedProduct(product, link);
      })
      .filter(Boolean);

    return {
      ...doc,
      linkedProducts,
      products: linkedProducts.map(serializeLegacyProduct),
    };
  });
}

async function enrichAdminLinkedProducts(reel) {
  const doc = asPlainReel(reel);
  const links = resolveReelProductLinks(doc);
  const productIds = links.map((link) => link.productId?._id || link.productId);
  const products = await Product.find({ _id: { $in: productIds } })
    .select("name slug sku price salePrice discountPrice images status isActive category")
    .populate("category", "name")
    .lean();
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  return links
    .map((link) => {
      const product = productMap.get(String(link.productId?._id || link.productId));
      if (!product) return null;
      return {
        productId: product._id,
        sortOrder: link.sortOrder ?? 0,
        featured: Boolean(link.featured),
        active: link.active !== false,
        product,
      };
    })
    .filter(Boolean);
}

module.exports = {
  MAX_LINKED_PRODUCTS,
  PUBLIC_PRODUCT_FILTER,
  resolveReelProductLinks,
  resolveReelProductIds,
  isProductLinkedToReel,
  buildLinkedFromProductIds,
  normalizeLinkedProductsInput,
  validateLinkedProductIds,
  getStockStatus,
  serializeFeedProduct,
  serializeLegacyProduct,
  fetchProductsMap,
  populateReelProducts,
  enrichAdminLinkedProducts,
};
