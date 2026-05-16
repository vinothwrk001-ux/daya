const { AppError } = require("../utils/AppError");

const DEFAULT_SIZE_PRIORITY = ["M", "L", "S", "XL", "XXL", "XXXL", "XS", "XXS"];

function normalizeAttributeValue(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getVariantSizePriority(variant, sizePriority = DEFAULT_SIZE_PRIORITY) {
  const variantSize = normalizeAttributeValue(variant?.attributes?.size || variant?.size || "");
  const priorityMap = new Map(sizePriority.map((value, index) => [value.trim().toLowerCase(), index]));
  return priorityMap.has(variantSize) ? priorityMap.get(variantSize) : sizePriority.length;
}

function parseSortOrder(variant) {
  const order = Number(variant?.sortOrder);
  return Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
}

function getVariantAvailableQuantity(productId, variant, cartItemCounts = new Map()) {
  const stock = Number(variant.stock || 0);
  const reservedStock = Number(variant.reservedStock || 0);
  const key = getCartItemKey(productId, variant?.variantId || "");
  const inCart = Number(cartItemCounts.get(key) || 0);
  return Math.max(0, stock - reservedStock - inCart);
}

function getCartItemKey(productId, variantId = "") {
  return `${String(productId || "")}::${String(variantId || "")}`;
}

function buildCartItemCounts(cartItems = []) {
  const map = new Map();
  for (const item of Array.isArray(cartItems) ? cartItems : []) {
    const productId = item?.productId?._id || item?.productId;
    if (!productId) continue;
    const variantId = String(item.variantId || item.variant?.variantId || "");
    const quantity = Number(item?.quantity || 0);
    if (!quantity) continue;
    const key = getCartItemKey(productId, variantId);
    map.set(key, (map.get(key) || 0) + quantity);
  }
  return map;
}

function isVariantAvailable(variant) {
  return Boolean(variant && variant.isActive && Number(variant.stock || 0) > 0);
}

function resolveBestVariant(product, options = {}) {
  if (!product) throw new AppError("Product is required for variant selection", 400, "VALIDATION_ERROR");
  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (!variants.length) return null;

  const availableVariants = variants.filter(isVariantAvailable);
  if (!availableVariants.length) return null;

  const defaultVariant = availableVariants.find((variant) => variant.isDefault === true);
  if (defaultVariant) return defaultVariant;

  const sizePriority = Array.isArray(options.sizePriority) && options.sizePriority.length
    ? options.sizePriority
    : DEFAULT_SIZE_PRIORITY;

  const ranked = availableVariants
    .map((variant, index) => ({
      variant,
      priority: getVariantSizePriority(variant, sizePriority),
      stock: Number(variant.stock || 0),
      index,
    }))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.stock !== b.stock) return b.stock - a.stock;
      return a.index - b.index;
    });

  return ranked[0]?.variant || availableVariants[0] || null;
}

function resolveNextAvailableVariant(product, cartItems = [], options = {}) {
  if (!product) throw new AppError("Product is required for variant selection", 400, "VALIDATION_ERROR");
  const activeVariants = Array.isArray(product.variants)
    ? product.variants.filter((variant) => variant?.isActive !== false)
    : [];

  const cartItemCounts = buildCartItemCounts(cartItems);
  const sizePriority = Array.isArray(options.sizePriority) && options.sizePriority.length
    ? options.sizePriority
    : DEFAULT_SIZE_PRIORITY;

  if (!activeVariants.length) {
    const productCartQty = Number(cartItemCounts.get(getCartItemKey(product._id, "")) || 0);
    const stock = Number(product.stock || 0);
    const reservedStock = Number(product.reservedStock || 0);
    const availableStock = Math.max(0, stock - reservedStock - productCartQty);
    return { variant: null, availableStock };
  }

  const prioritized = activeVariants
    .map((variant, index) => ({
      variant,
      available: getVariantAvailableQuantity(product._id, variant, cartItemCounts),
      sortOrder: parseSortOrder(variant),
      sizePriority: getVariantSizePriority(variant, sizePriority),
      title: String(variant.title || variant.variantId || "").trim().toLowerCase(),
      index,
    }))
    .filter((entry) => entry.available > 0)
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      if (a.sizePriority !== b.sizePriority) return a.sizePriority - b.sizePriority;
      if (a.available !== b.available) return b.available - a.available;
      if (a.title !== b.title) return a.title.localeCompare(b.title);
      return a.index - b.index;
    });

  return {
    variant: prioritized[0]?.variant || null,
    availableStock: prioritized[0]?.available || 0,
  };
}

module.exports = {
  resolveBestVariant,
  resolveNextAvailableVariant,
  isVariantAvailable,
};
