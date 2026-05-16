export function getCartItemKey(productId, variantId = "") {
  return `${String(productId || "")}::${String(variantId || "")}`;
}

export function extractProductId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return String(value._id || value.id || value.productId || "");
  }
  return "";
}

export function extractVariantId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return String(value.variantId || value.id || "");
  }
  return "";
}

export function getCartSubtotal(items = []) {
  return items.reduce((sum, item) => {
    const price = Number(item?.discountedPrice ?? item?.price ?? 0);
    const quantity = Number(item?.quantity || 0);
    return sum + price * quantity;
  }, 0);
}

export function getCartTotalQuantity(items = []) {
  return items.reduce((sum, item) => sum + Number(item?.quantity || 0), 0);
}

export function normalizeCartPayload(payload) {
  const candidate =
    payload?.data && Array.isArray(payload.data.items)
      ? payload.data
      : payload?.userCart && Array.isArray(payload.userCart.items)
        ? payload.userCart
        : payload;

  const items = Array.isArray(candidate?.items) ? candidate.items : [];
  const totalAmount = Number(candidate?.totalAmount ?? getCartSubtotal(items));
  const totalQuantity = Number(candidate?.totalQuantity ?? getCartTotalQuantity(items));
  const itemCount = Number(candidate?.itemCount ?? items.length);

  return {
    ...(candidate && typeof candidate === "object" ? candidate : {}),
    items,
    totalAmount,
    totalQuantity,
    itemCount,
  };
}

function parseSortOrder(value) {
  const order = Number(value);
  return Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
}

function getVariantSizePriority(variant) {
  const priorityOrder = ["S", "M", "L", "XL", "XXL", "XXXL", "XS", "XXS"];
  const priorityMap = new Map(priorityOrder.map((value, index) => [value.trim().toLowerCase(), index]));
  const sizeValue = String(variant?.attributes?.size || variant?.title || "").trim().toLowerCase();
  return priorityMap.has(sizeValue) ? priorityMap.get(sizeValue) : priorityOrder.length;
}

export function getAvailableProductVariant(product, cartItems = []) {
  const variants = Array.isArray(product?.variants)
    ? product.variants.filter((item) => item?.isActive !== false)
    : [];

  const variantCounts = new Map();
  for (const item of Array.isArray(cartItems) ? cartItems : []) {
    if (String(extractProductId(item?.productId || item)) !== String(product?._id)) continue;
    const variantId = String(extractVariantId(item) || "");
    variantCounts.set(variantId, (variantCounts.get(variantId) || 0) + Number(item?.quantity || 0));
  }

  if (!variants.length) {
    const totalReserved = Array.from(variantCounts.values()).reduce((sum, value) => sum + value, 0);
    const stock = Number.isFinite(product?.stock) ? Number(product.stock) : 0;
    const reservedStock = Number.isFinite(product?.reservedStock) ? Number(product.reservedStock) : 0;
    const availableStock = Math.max(stock - reservedStock - totalReserved, 0);
    return {
      selectedVariant: null,
      hasAvailableVariants: availableStock > 0,
      availableStock,
    };
  }

  const scoredVariants = variants
    .map((variant, index) => {
      const variantId = String(variant.variantId || "");
      const inCartQty = Number(variantCounts.get(variantId) || 0);
      const stock = Number.isFinite(variant.stock) ? Number(variant.stock) : 0;
      const reservedStock = Number.isFinite(variant.reservedStock) ? Number(variant.reservedStock) : 0;
      const availableStock = Math.max(stock - reservedStock - inCartQty, 0);
      return {
        variant,
        availableStock,
        sortOrder: parseSortOrder(variant.sortOrder),
        sizePriority: getVariantSizePriority(variant),
        title: String(variant.title || variant.variantId || "").trim().toLowerCase(),
        index,
      };
    })
    .filter((entry) => entry.availableStock > 0);

  if (!scoredVariants.length) {
    return {
      selectedVariant: null,
      hasAvailableVariants: false,
      availableStock: 0,
    };
  }

  scoredVariants.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    if (a.sizePriority !== b.sizePriority) return a.sizePriority - b.sizePriority;
    if (a.availableStock !== b.availableStock) return b.availableStock - a.availableStock;
    if (a.title !== b.title) return a.title.localeCompare(b.title);
    return a.index - b.index;
  });

  return {
    selectedVariant: scoredVariants[0].variant,
    hasAvailableVariants: true,
    availableStock: scoredVariants[0].availableStock,
  };
}

export function emitCartChanged(cartLike) {
  if (typeof window === "undefined") return;
  const detail = normalizeCartPayload(cartLike);
  window.dispatchEvent(new CustomEvent("cart:changed", { detail }));
}
