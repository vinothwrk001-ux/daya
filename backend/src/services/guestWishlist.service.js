const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const productRepo = require("../repositories/product.repository");

/**
 * Guest Wishlist Service
 * Handles validation logic for guest wishlist (without database persistence)
 * Frontend stores actual wishlist data in localStorage
 */

class GuestWishlistService {
  /**
   * Validate product before adding to wishlist
   */
  async validateProduct(productId, variantId = "") {
    if (!mongoose.isValidObjectId(productId)) {
      throw new AppError("Invalid productId", 400, "VALIDATION_ERROR");
    }

    const product = await productRepo.findById(productId);
    if (!product) throw new AppError("Product not found", 404, "NOT_FOUND");
    if (product.status !== "APPROVED" || product.isActive !== true) {
      throw new AppError("Product not available", 400, "NOT_AVAILABLE");
    }

    // If variant specified, validate it exists
    if (variantId) {
      const variant = product.variants?.find((v) => v.variantId === variantId && v.isActive);
      if (!variant) {
        throw new AppError("Selected variant is not available", 400, "NOT_AVAILABLE");
      }
    }

    return {
      productId,
      variantId: variantId || null,
      name: product.name,
      image:
        product.images?.find((image) => image.isPrimary)?.url ||
        product.images?.[0]?.url ||
        "",
      price: product.discountPrice || product.price,
    };
  }

  /**
   * Validate if product is available in wishlist format
   */
  async getProductStatus(productId) {
    if (!mongoose.isValidObjectId(productId)) {
      throw new AppError("Invalid productId", 400, "VALIDATION_ERROR");
    }

    const product = await productRepo.findById(productId);
    if (!product) {
      return { exists: false, isAvailable: false };
    }

    return {
      exists: true,
      isAvailable: product.status === "APPROVED" && product.isActive === true,
      price: product.discountPrice || product.price,
      image:
        product.images?.find((image) => image.isPrimary)?.url ||
        product.images?.[0]?.url ||
        "",
    };
  }

  /**
   * Validate wishlist items (e.g., after loading from localStorage)
   * Remove items that no longer exist or are unavailable
   */
  async validateWishlistItems(items = []) {
    const validatedItems = [];
    const removedItems = [];

    for (const item of items) {
      try {
        const status = await this.getProductStatus(item.productId);
        if (status.exists && status.isAvailable) {
          validatedItems.push(item);
        } else {
          removedItems.push(item);
        }
      } catch (e) {
        removedItems.push(item);
      }
    }

    return {
      validatedItems,
      removedItems,
    };
  }
}

module.exports = new GuestWishlistService();
