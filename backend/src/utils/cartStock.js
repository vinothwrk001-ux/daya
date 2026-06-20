const { AppError } = require("./AppError");

function normalizeProductId(productId) {
  if (!productId) return "";
  if (typeof productId === "object") {
    return String(productId._id || productId.id || "");
  }
  return String(productId);
}

function getItemKey(productId, variantId = "") {
  return `${normalizeProductId(productId)}::${String(variantId || "")}`;
}

function buildCartItemCounts(cartItems = []) {
  const counts = new Map();
  for (const item of Array.isArray(cartItems) ? cartItems : []) {
    const productId = item?.productId?._id || item?.productId;
    const variantId = String(item?.variantId || item?.variant?.variantId || "");
    const quantity = Number(item?.quantity || 0);
    if (!productId || quantity <= 0) continue;
    const key = getItemKey(productId, variantId);
    counts.set(key, (counts.get(key) || 0) + quantity);
  }
  return counts;
}

function getSellableStock(entity = {}) {
  return Math.max(0, Number(entity?.stock || 0) - Number(entity?.reservedStock || 0));
}

function getInCartQuantity(cartItems = [], productId, variantId = "") {
  return Number(buildCartItemCounts(cartItems).get(getItemKey(productId, variantId)) || 0);
}

function getVariantAvailability({ productId, variant = null, product = null, cartItems = [], quantityInCart = null }) {
  const resolvedVariantId = variant?.variantId || "";
  const inCart =
    quantityInCart != null
      ? Number(quantityInCart || 0)
      : getInCartQuantity(cartItems, productId, resolvedVariantId);
  const sellable = variant ? getSellableStock(variant) : getSellableStock(product || {});
  const available = Math.max(0, sellable - inCart);

  return {
    sellable,
    inCart,
    available,
    variantId: resolvedVariantId,
  };
}

function formatVariantLabel(variant = null) {
  if (!variant) return "This item";
  const title = String(variant.title || variant.variantTitle || "").trim();
  if (title) return title;
  const attributes = variant.attributes || variant.variantAttributes || {};
  const color = attributes.color || attributes.Color || attributes.colour || attributes.Colour;
  if (color) return String(color);
  const size = attributes.size || attributes.Size;
  if (size) return String(size);
  const variantId = String(variant.variantId || "").trim();
  if (variantId) return variantId;
  return "This variant";
}

function buildStockErrorMessage({ code, variant, available, requested, increment = false }) {
  const label = formatVariantLabel(variant);

  if (code === "OUT_OF_STOCK" || available <= 0) {
    return `${label} variant is out of stock`;
  }

  if (increment && requested > available) {
    return available === 1 ? `Only 1 left for ${label}` : `Only ${available} left for ${label}`;
  }

  if (requested > available) {
    return available === 1 ? `Only 1 left for ${label}` : `Only ${available} left for ${label}`;
  }

  return `${label} variant is out of stock`;
}

function throwStockError({ code, variant, availability, requested, increment = false }) {
  const available = Number(availability?.available ?? 0);
  const sellable = Number(availability?.sellable ?? 0);
  const inCart = Number(availability?.inCart ?? 0);
  const message = buildStockErrorMessage({ code, variant, available, requested, increment });

  throw new AppError(message, 409, code, {
    available,
    requested,
    sellable,
    inCart,
    variantId: variant?.variantId || "",
    variantTitle: formatVariantLabel(variant),
  });
}

function assertCanAddQuantity({ qty, availability, variant }) {
  const requested = Number(qty || 0);
  if (requested <= 0) {
    throw new AppError("Quantity must be >= 1", 400, "VALIDATION_ERROR");
  }

  if (availability.available <= 0) {
    throwStockError({
      code: "OUT_OF_STOCK",
      variant,
      availability,
      requested,
      increment: true,
    });
  }

  if (requested > availability.available) {
    throwStockError({
      code: "INSUFFICIENT_STOCK",
      variant,
      availability,
      requested,
      increment: true,
    });
  }
}

function assertCanSetQuantity({ qty, availability, variant, currentQty = 0 }) {
  const requested = Number(qty || 0);
  if (requested <= 0) return;

  const sellable = Number(availability.sellable || 0);
  const maxAllowed = sellable;

  if (requested > maxAllowed) {
    throwStockError({
      code: "INSUFFICIENT_STOCK",
      variant,
      availability: {
        ...availability,
        available: Math.max(0, maxAllowed - Number(currentQty || 0)),
      },
      requested,
      increment: requested > currentQty,
    });
  }
}

module.exports = {
  normalizeProductId,
  getItemKey,
  buildCartItemCounts,
  getSellableStock,
  getInCartQuantity,
  getVariantAvailability,
  formatVariantLabel,
  buildStockErrorMessage,
  assertCanAddQuantity,
  assertCanSetQuantity,
};
