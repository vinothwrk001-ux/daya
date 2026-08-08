const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const cartRepo = require("../repositories/cart.repository");
const productRepo = require("../repositories/product.repository");
const { resolveBestVariant, resolveNextAvailableVariant } = require("./variantResolver.service");
const {
  normalizeProductId,
  getItemKey,
  getVariantAvailability,
  assertCanAddQuantity,
  assertCanSetQuantity,
} = require("../utils/cartStock");

function computeTotal(items = []) {
  return items.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0), 0);
}

function asObjectId(id, fieldName) {
  const checkId = id && typeof id === "object" && id._id ? id._id : id;
  if (!mongoose.isValidObjectId(checkId)) throw new AppError(`Invalid ${fieldName}`, 400, "VALIDATION_ERROR");
  return checkId;
}

function getVariantForProduct(product, variantId) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return null;
  if (!variantId) {
    return resolveBestVariant(product);
  }
  return variants.find((item) => item.variantId === variantId && item.isActive) || null;
}

function invalidatePreparedCheckoutCacheForUser(userId) {
  try {
    const checkoutService = require("./checkout.service");
    checkoutService.invalidatePreparedCheckoutCacheForUser?.(userId);
  } catch {
    // Ignore cache invalidation failures and still persist the cart change.
  }
}

function sanitizeCartItems(items = []) {
  return (Array.isArray(items) ? items : []).filter((item) => Boolean(normalizeProductId(item?.productId)));
}

function buildCartLineMeta(product, variant) {
  const itemImage =
    variant?.images?.find((image) => image.isPrimary)?.url ||
    variant?.images?.[0]?.url ||
    product.images?.find((image) => image.isPrimary)?.url ||
    product.images?.[0]?.url ||
    "";
  const itemPrice = Number(variant?.discountPrice || variant?.price || product.discountPrice || product.price || 0);

  return {
    price: itemPrice,
    image: itemImage,
    variantId: variant?.variantId || "",
    variantSku: variant?.sku || "",
    variantTitle: variant?.title || "",
    variantAttributes: variant?.attributes || {},
  };
}

class CartService {
  async getCart(userId) {
    await cartRepo.upsertEmpty(userId);
    const cart = await cartRepo.findByUserId(userId);
    if (cart && Array.isArray(cart.items)) {
      const sanitizedItems = sanitizeCartItems(cart.items);
      if (sanitizedItems.length !== cart.items.length) {
        cart.items = sanitizedItems;
        cart.totalAmount = computeTotal(cart.items);
        await cartRepo.save(cart);
      }
    }
    return cart;
  }

  async addItem(userId, { productId, quantity = 1, variantId = "" }) {
    asObjectId(productId, "productId");
    const qty = Number(quantity || 1);
    if (!Number.isFinite(qty) || qty < 1) throw new AppError("Quantity must be >= 1", 400, "VALIDATION_ERROR");

    const product = await productRepo.findById(productId);
    if (!product) throw new AppError("Product not found", 404, "NOT_FOUND");
    if (product.status !== "APPROVED" || product.isActive !== true) {
      throw new AppError("Product not available", 400, "NOT_AVAILABLE");
    }

    const cart = await cartRepo.upsertEmpty(userId);
    cart.items = sanitizeCartItems(cart.items);
    const resolverResult = variantId
      ? {
          variant: getVariantForProduct(product, variantId),
          availableStock: getVariantAvailability({
            productId,
            variant: getVariantForProduct(product, variantId),
            product,
            cartItems: cart.items,
          }).available,
        }
      : resolveNextAvailableVariant(product, cart.items);
    const variant = resolverResult?.variant || null;
    const resolvedVariantId = variant?.variantId || variantId || "";
    const itemKey = getItemKey(productId, resolvedVariantId);
    const existingIdx = cart.items.findIndex((x) => getItemKey(x.productId, x.variantId) === itemKey);
    const availability = getVariantAvailability({
      productId,
      variant,
      product,
      cartItems: cart.items,
    });

    if (!variant && Array.isArray(product?.variants) && product.variants.length && variantId) {
      throw new AppError("Selected variant is not available", 400, "NOT_AVAILABLE");
    }

    assertCanAddQuantity({ qty, availability, variant });

    const lineMeta = buildCartLineMeta(product, variant);
    const newItem = {
      productId,
      quantity: qty,
      ...lineMeta,
      maxQuantity: availability.sellable,
      availableStock: Math.max(0, availability.sellable - availability.inCart - qty),
    };

    if (existingIdx >= 0) {
      const nextQty = Number(cart.items[existingIdx].quantity || 0) + qty;
      const existingItem = cart.items[existingIdx];
      existingItem.quantity = nextQty;
      existingItem.price = lineMeta.price;
      existingItem.image = lineMeta.image;
      existingItem.variantId = lineMeta.variantId;
      existingItem.variantSku = lineMeta.variantSku;
      existingItem.variantTitle = lineMeta.variantTitle;
      existingItem.variantAttributes = lineMeta.variantAttributes;
      existingItem.maxQuantity = availability.sellable;
      existingItem.availableStock = Math.max(0, availability.sellable - nextQty);
      newItem.quantity = nextQty;
    } else {
      cart.items.push(newItem);
    }

    cart.totalAmount = computeTotal(cart.items);
    await cartRepo.save(cart);
    invalidatePreparedCheckoutCacheForUser(userId);
    const savedCart = await cartRepo.findByUserId(userId);
    return { cart: savedCart, addedItem: newItem };
  }

  async updateItem(userId, { productId, quantity, variantId = "" }) {
    asObjectId(productId, "productId");
    const qty = Number(quantity);
    if (!Number.isFinite(qty)) throw new AppError("Quantity is required", 400, "VALIDATION_ERROR");

    const cart = await cartRepo.upsertEmpty(userId);
    cart.items = sanitizeCartItems(cart.items);
    const idx = cart.items.findIndex((x) => getItemKey(x.productId, x.variantId) === getItemKey(productId, variantId));
    if (idx < 0) throw new AppError("Item not found in cart", 404, "NOT_FOUND");

    if (qty <= 0) {
      cart.items.splice(idx, 1);
      cart.totalAmount = computeTotal(cart.items);
      await cartRepo.save(cart);
      return await cartRepo.findByUserId(userId);
    }

    const product = await productRepo.findById(productId);
    if (!product) throw new AppError("Product not found", 404, "NOT_FOUND");
    if (product.status !== "APPROVED" || product.isActive !== true) {
      throw new AppError("Product not available", 400, "NOT_AVAILABLE");
    }

    const resolvedVariantId = variantId || cart.items[idx].variantId || "";
    const variant = getVariantForProduct(product, resolvedVariantId);
    const hasVariants = Array.isArray(product?.variants) && product.variants.length > 0;

    if (hasVariants && !variant) {
      throw new AppError("Selected variant is not available", 400, "NOT_AVAILABLE");
    }

    const currentQty = Number(cart.items[idx].quantity || 0);
    const availability = getVariantAvailability({
      productId,
      variant,
      product,
      cartItems: cart.items,
    });

    assertCanSetQuantity({
      qty,
      availability,
      variant,
      currentQty,
    });

    const lineMeta = buildCartLineMeta(product, variant);
    cart.items[idx].quantity = qty;
    cart.items[idx].price = lineMeta.price;
    cart.items[idx].image = lineMeta.image;
    cart.items[idx].maxQuantity = availability.sellable;
    cart.items[idx].availableStock = Math.max(0, availability.sellable - qty);
    if (variant) {
      cart.items[idx].variantId = lineMeta.variantId;
      cart.items[idx].variantSku = lineMeta.variantSku;
      cart.items[idx].variantTitle = lineMeta.variantTitle;
      cart.items[idx].variantAttributes = lineMeta.variantAttributes;
    }

    cart.totalAmount = computeTotal(cart.items);
    await cartRepo.save(cart);
    invalidatePreparedCheckoutCacheForUser(userId);
    return await cartRepo.findByUserId(userId);
  }

  async removeItem(userId, { productId, variantId = "" }) {
    asObjectId(productId, "productId");

    const cart = await cartRepo.upsertEmpty(userId);
    cart.items = sanitizeCartItems(cart.items);
    const before = cart.items.length;
    cart.items = cart.items.filter((x) => getItemKey(x.productId, x.variantId) !== getItemKey(productId, variantId));
    if (cart.items.length === before) throw new AppError("Item not found in cart", 404, "NOT_FOUND");

    cart.totalAmount = computeTotal(cart.items);
    await cartRepo.save(cart);
    invalidatePreparedCheckoutCacheForUser(userId);
    return await cartRepo.findByUserId(userId);
  }

  async clearCart(userId) {
    await cartRepo.upsertEmpty(userId);
    const clearedCart = await cartRepo.clear(userId);
    invalidatePreparedCheckoutCacheForUser(userId);
    return clearedCart;
  }
}

module.exports = new CartService();
