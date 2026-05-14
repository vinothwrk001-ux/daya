const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const productRepo = require("../repositories/product.repository");
const vendorRepo = require("../repositories/vendor.repository");

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
    return (
      variants.find((item) => item.isDefault && item.isActive && item.stock > 0) ||
      variants.find((item) => item.isActive && item.stock > 0) ||
      variants.find((item) => item.isActive) ||
      null
    );
  }
  return variants.find((item) => item.variantId === variantId && item.isActive) || null;
}

function getItemKey(productId, variantId = "") {
  return `${String(productId)}::${String(variantId || "")}`;
}

async function resolveSellerIdForProduct(product) {
  if (product?.sellerId) return product.sellerId;
  if (product?.creatorType === "ADMIN" && product?.createdBy?._id) {
    const vendor = await vendorRepo.upsertByUserId(product.createdBy._id, {
      status: "approved",
      stepCompleted: 4,
      companyName: "Platform Store",
      shopName: "Platform Store",
      storeDescription: "Products sold directly by the platform.",
    });
    return vendor._id;
  }
  return null;
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
    const availableStock = variant ? Number(variant.stock || 0) : Number(product.stock || 0);

    if (!variant && Array.isArray(product?.variants) && product.variants.length && variantId) {
      throw new AppError("Selected variant is not available", 400, "NOT_AVAILABLE");
    }
    if (availableStock < qty) throw new AppError("Insufficient stock", 400, "INSUFFICIENT_STOCK");

    const resolvedSellerId = await resolveSellerIdForProduct(product);
    if (!resolvedSellerId) throw new AppError("Seller not found for product", 400, "INVALID_PRODUCT");

    const unitPrice = Number(variant?.discountPrice || variant?.price || product.discountPrice || product.price || 0);

    return {
      productId,
      vendorId: resolvedSellerId,
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
        const availableStock = variant ? Number(variant.stock || 0) : Number(product.stock || 0);

        if (availableStock < item.quantity) {
          errors.push({
            productId: item.productId,
            error: `Only ${availableStock} items available`,
          });
          continue;
        }

        const resolvedSellerId = await resolveSellerIdForProduct(product);
        if (!resolvedSellerId) {
          errors.push({ productId: item.productId, error: "Seller not found" });
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
          vendorId: resolvedSellerId,
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
        vendorId: item.vendorId,
      })),
      errors: validation.errors,
    };
  }
}

module.exports = new GuestCartService();
