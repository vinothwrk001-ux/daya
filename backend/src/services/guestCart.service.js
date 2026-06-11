const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const productRepo = require("../repositories/product.repository");
const { resolveBestVariant } = require("./variantResolver.service");

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

function getVariantAvailableQuantity(product, variant, quantityInCart = 0) {
  if (!variant) return 0;
  const stock = Number(variant.stock || 0);
  const reservedStock = Number(variant.reservedStock || 0);
  return Math.max(0, stock - reservedStock - Number(quantityInCart || 0));
}

function getAvailableLegacyQuantity(product, quantityInCart = 0) {
  const stock = Number(product.stock || 0);
  const reservedStock = Number(product.reservedStock || 0);
  return Math.max(0, stock - reservedStock - Number(quantityInCart || 0));
}

function getItemKey(productId, variantId = "") {
  return `${String(productId)}::${String(variantId || "")}`;
}

class GuestCartService {
  /**
   * Validate and enrich an item being added to guest cart
   * Returns product details needed for cart (without modifying actual cart)
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
    const availableStock = variant
      ? getVariantAvailableQuantity(product, variant, 0)
      : getAvailableLegacyQuantity(product, 0);

    if (!variant && Array.isArray(product?.variants) && product.variants.length && variantId) {
      throw new AppError("Selected variant is not available", 400, "NOT_AVAILABLE");
    }
    if (availableStock === 0) {
      throw new AppError("Product is out of stock", 400, "OUT_OF_STOCK");
    }
    if (availableStock < qty) {
      throw new AppError(`Only ${availableStock} item${availableStock === 1 ? "" : "s"} available`, 400, "INSUFFICIENT_STOCK");
    }

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
      stock: availableStock,
      variantId: variant?.variantId || "",
      variantSku: variant?.sku || "",
      variantTitle: variant?.title || "",
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
        const product = await productRepo.findById(item.productId);
        if (!product) {
          errors.push({ productId: item.productId, error: "Product not found" });
          continue;
        }
        if (product.status !== "APPROVED" || product.isActive !== true) {
          errors.push({ productId: item.productId, error: "Product not available" });
          continue;
        }

        const variant = getVariantForProduct(product, item.variantId);
        const availableStock = variant
          ? getVariantAvailableQuantity(product, variant, 0)
          : getAvailableLegacyQuantity(product, 0);

        if (availableStock === 0) {
          errors.push({
            productId: item.productId,
            error: "Out of stock",
            code: "OUT_OF_STOCK",
            availableStock,
          });
          continue;
        }
        if (availableStock < item.quantity) {
          errors.push({
            productId: item.productId,
            error: `Only ${availableStock} item${availableStock === 1 ? "" : "s"} available`,
            code: "INSUFFICIENT_STOCK",
            availableStock,
          });
          continue;
        }

        // Refresh price from DB
        const currentPrice = Number(
          variant?.discountPrice || variant?.price || product.discountPrice || product.price || 0
        );

        validatedItems.push({
          ...item,
          name: product.name,
          price: currentPrice,
          stock: availableStock,
          image:
            variant?.images?.find((image) => image.isPrimary)?.url ||
            variant?.images?.[0]?.url ||
            product.images?.find((image) => image.isPrimary)?.url ||
            product.images?.[0]?.url ||
            item.image || "",
        });
      } catch (e) {
        errors.push({ productId: item.productId, error: e.message });
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
