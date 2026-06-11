const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const cartRepo = require("../repositories/cart.repository");
const productRepo = require("../repositories/product.repository");
const { resolveBestVariant, resolveNextAvailableVariant } = require("./variantResolver.service");

function computeTotal(items = []) {
  return items.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0), 0);
}

function getItemKey(productId, variantId = "") {
  return `${String(productId)}::${String(variantId || "")}`;
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

function getVariantAvailableQuantity(productId, variant, cartItems = []) {
  const key = getItemKey(productId || "", variant?.variantId || "");
  const inCartQty = Number(buildCartItemCounts(cartItems).get(key) || 0);
  const stock = Number(variant.stock || 0);
  const reservedStock = Number(variant.reservedStock || 0);
  return Math.max(0, stock - reservedStock - inCartQty);
}

function getAvailableLegacyQuantity(product, cartItems = []) {
  const key = getItemKey(product?._id || product?.id || "", "");
  const inCartQty = Number(buildCartItemCounts(cartItems).get(key) || 0);
  const stock = Number(product.stock || 0);
  const reservedStock = Number(product.reservedStock || 0);
  return Math.max(0, stock - reservedStock - inCartQty);
}

function asObjectId(id, fieldName) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(`Invalid ${fieldName}`, 400, "VALIDATION_ERROR");
  return id;
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

class CartService {
  async getCart(userId) {
    await cartRepo.upsertEmpty(userId);
    const cart = await cartRepo.findByUserId(userId);
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
    const resolverResult = variantId
      ? {
          variant: getVariantForProduct(product, variantId),
          availableStock: getVariantAvailableQuantity(productId, getVariantForProduct(product, variantId), cart.items),
        }
      : resolveNextAvailableVariant(product, cart.items);
    const variant = resolverResult?.variant || null;
    const availableStock = Number(resolverResult?.availableStock || 0);
    const itemKey = getItemKey(productId, variant?.variantId || variantId);
    const existingIdx = cart.items.findIndex((x) => getItemKey(x.productId, x.variantId) === itemKey);

    if (!variant && Array.isArray(product?.variants) && product.variants.length && variantId) {
      throw new AppError("Selected variant is not available", 400, "NOT_AVAILABLE");
    }
    if (availableStock <= 0) {
      throw new AppError("Product is out of stock", 400, "OUT_OF_STOCK");
    }
    if (availableStock < qty) {
      throw new AppError(`Only ${availableStock} item${availableStock === 1 ? "" : "s"} available`, 400, "INSUFFICIENT_STOCK");
    }
    const itemImage =
      variant?.images?.find((image) => image.isPrimary)?.url ||
      variant?.images?.[0]?.url ||
      product.images?.find((image) => image.isPrimary)?.url ||
      product.images?.[0]?.url ||
      "";
    const itemPrice = Number(variant?.discountPrice || variant?.price || product.discountPrice || product.price || 0);
    const newItem = {
      productId,
      quantity: qty,
      price: itemPrice,
      image: itemImage,
      variantId: variant?.variantId || "",
      variantSku: variant?.sku || "",
      variantTitle: variant?.title || "",
      variantAttributes: variant?.attributes || {},
    };

    if (existingIdx >= 0) {
      const nextQty = Number(cart.items[existingIdx].quantity || 0) + qty;
      if (availableStock === 0) {
        throw new AppError("Product is out of stock", 400, "OUT_OF_STOCK");
      }
      if (availableStock < nextQty) {
        throw new AppError(`Only ${availableStock} item${availableStock === 1 ? "" : "s"} available`, 400, "INSUFFICIENT_STOCK");
      }
      cart.items[existingIdx] = {
        ...cart.items[existingIdx],
        quantity: nextQty,
        price: itemPrice,
        image: itemImage,
        variantId: variant?.variantId || "",
        variantSku: variant?.sku || "",
        variantTitle: variant?.title || "",
        variantAttributes: variant?.attributes || {},
      };
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
    const variant = getVariantForProduct(product, variantId || cart.items[idx].variantId);
    if (!variant) {
      throw new AppError("Selected variant is not available", 400, "NOT_AVAILABLE");
    }

    const currentQty = Number(cart.items[idx].quantity || 0);
    const availableExtra = getVariantAvailableQuantity(productId, variant, cart.items);
    const maxAllowedQuantity = currentQty + availableExtra;

    if (availableExtra <= 0 && qty > currentQty) {
      throw new AppError("Product is out of stock", 400, "OUT_OF_STOCK");
    }
    if (qty > maxAllowedQuantity) {
      throw new AppError(`Only ${maxAllowedQuantity} item${maxAllowedQuantity === 1 ? "" : "s"} available`, 400, "INSUFFICIENT_STOCK");
    }
    cart.items[idx].quantity = qty;
    cart.items[idx].price = Number(variant?.discountPrice || variant?.price || product.discountPrice || product.price || 0);
    cart.items[idx].image =
      variant?.images?.find((image) => image.isPrimary)?.url ||
      variant?.images?.[0]?.url ||
      product.images?.find((image) => image.isPrimary)?.url ||
      product.images?.[0]?.url ||
      "";
    cart.items[idx].variantId = variant?.variantId || "";
    cart.items[idx].variantSku = variant?.sku || "";
    cart.items[idx].variantTitle = variant?.title || "";
    cart.items[idx].variantAttributes = variant?.attributes || {};

    cart.totalAmount = computeTotal(cart.items);
    await cartRepo.save(cart);
    invalidatePreparedCheckoutCacheForUser(userId);
    return await cartRepo.findByUserId(userId);
  }

  async removeItem(userId, { productId, variantId = "" }) {
    asObjectId(productId, "productId");

    const cart = await cartRepo.upsertEmpty(userId);
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

