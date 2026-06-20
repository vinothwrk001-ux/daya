const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const productRepo = require("../repositories/product.repository");
const { resolveBestVariant } = require("./variantResolver.service");
const {
  getSellableStock,
  getVariantAvailability,
  assertCanSetQuantity,
  formatVariantLabel,
} = require("../utils/cartStock");

/**
 * Guest Cart Service
 * Handles validation logic for guest carts (without database persistence)
 * Frontend stores actual cart data in localStorage
 */

function computeTotal(items = []) {
  return items.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0), 0);
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

class GuestCartService {
  /**
   * Validate and enrich an item being added to guest cart.
   * `quantity` is the desired total quantity for this cart line after the add.
   */
  async validateAndEnrichItem(productId, quantity = 1, variantId = "") {
    asObjectId(productId, "productId");
    const qty = Number(quantity || 1);
    if (!Number.isFinite(qty) || qty < 1) throw new AppError("Quantity must be >= 1", 400, "VALIDATION_ERROR");

    const product = await productRepo.findById(productId);
    if (!product) throw new AppError("Product not found", 404, "NOT_FOUND");
    if (product.status !== "APPROVED" || product.isActive !== true) {
      throw new AppError("Product not available", 400, "NOT_AVAILABLE");
    }

    const variant = getVariantForProduct(product, variantId);
    const availability = getVariantAvailability({
      productId,
      variant,
      product,
      cartItems: [],
      quantityInCart: 0,
    });

    if (!variant && Array.isArray(product?.variants) && product.variants.length && variantId) {
      throw new AppError("Selected variant is not available", 400, "NOT_AVAILABLE");
    }

    assertCanSetQuantity({
      qty,
      availability,
      variant,
      currentQty: 0,
    });

    const unitPrice = Number(variant?.discountPrice || variant?.price || product.discountPrice || product.price || 0);

    return {
      productId,
      quantity: qty,
      name: product.name,
      price: unitPrice,
      image:
        variant?.images?.find((image) => image.isPrimary)?.url ||
        variant?.images?.[0]?.url ||
        product.images?.find((image) => image.isPrimary)?.url ||
        product.images?.[0]?.url ||
        "",
      stock: availability.sellable,
      maxQuantity: availability.sellable,
      availableStock: Math.max(0, availability.sellable - qty),
      variantId: variant?.variantId || "",
      variantSku: variant?.sku || "",
      variantTitle: variant?.title || formatVariantLabel(variant),
      variantAttributes: variant?.attributes || {},
    };
  }

  /**
   * Validate existing cart items against current DB state
   * Used before checkout to ensure items are still valid
   */
  async validateCartItems(items = []) {
    const validatedItems = [];
    const errors = [];

    for (const item of items) {
      try {
        const productId = item?.productId?._id || item?.productId;
        const product = await productRepo.findById(productId);
        if (!product) {
          errors.push({ productId: item.productId, error: "Product not found" });
          continue;
        }
        if (product.status !== "APPROVED" || product.isActive !== true) {
          errors.push({ productId: item.productId, error: "Product not available" });
          continue;
        }

        const variant = getVariantForProduct(product, item.variantId);
        const availability = getVariantAvailability({
          productId,
          variant,
          product,
          cartItems: [],
          quantityInCart: 0,
        });

        if (availability.sellable === 0) {
          errors.push({
            productId: item.productId,
            variantId: item.variantId || "",
            error: `${formatVariantLabel(variant)} variant is out of stock`,
            code: "OUT_OF_STOCK",
            availableStock: 0,
          });
          continue;
        }

        if (item.quantity > availability.sellable) {
          errors.push({
            productId: item.productId,
            variantId: item.variantId || "",
            error:
              availability.sellable === 1
                ? `Only 1 left for ${formatVariantLabel(variant)}`
                : `Only ${availability.sellable} left for ${formatVariantLabel(variant)}`,
            code: "INSUFFICIENT_STOCK",
            availableStock: availability.sellable,
          });
          continue;
        }

        const currentPrice = Number(
          variant?.discountPrice || variant?.price || product.discountPrice || product.price || 0
        );

        validatedItems.push({
          ...item,
          productId,
          name: product.name,
          price: currentPrice,
          stock: availability.sellable,
          maxQuantity: availability.sellable,
          availableStock: Math.max(0, availability.sellable - Number(item.quantity || 0)),
          variantTitle: variant?.title || item.variantTitle || formatVariantLabel(variant),
          image:
            variant?.images?.find((image) => image.isPrimary)?.url ||
            variant?.images?.[0]?.url ||
            product.images?.find((image) => image.isPrimary)?.url ||
            product.images?.[0]?.url ||
            item.image || "",
        });
      } catch (e) {
        errors.push({ productId: item.productId, error: e.message, code: e.code || "VALIDATION_ERROR" });
      }
    }

    return {
      validatedItems,
      errors,
      totalAmount: computeTotal(validatedItems),
    };
  }

  /**
   * Get summary of cart items without full cart object
   * Lightweight response for mini-cart, navbar, etc.
   */
  async getCartSummary(items = []) {
    const validation = await this.validateCartItems(items);
    return {
      itemCount: validation.validatedItems.length,
      totalAmount: validation.totalAmount,
      items: validation.validatedItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
      })),
      errors: validation.errors,
    };
  }
}

module.exports = new GuestCartService();
