const { AppError } = require("./AppError");
const { logger } = require("./logger");

/**
 * Cart Weight Calculation Utilities
 * Handles weight aggregation for shipping calculations
 */

/**
 * Calculate total weight from cart items
 * @param {Array} cartItems - Array of cart items with product data
 * @returns {number} Total weight in kg
 */
function calculateCartWeight(cartItems) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return 0;
  }

  try {
    let totalWeight = 0;

    for (const item of cartItems) {
      const productWeight = getItemWeight(item);
      const itemTotalWeight = productWeight * (item.quantity || 1);
      totalWeight += itemTotalWeight;
    }

    // Preserve gram-level precision in kg values.
    return Math.round(totalWeight * 1000) / 1000;
  } catch (error) {
    throw new AppError(
      `Error calculating cart weight: ${error.message}`,
      400,
      "WEIGHT_CALCULATION_ERROR"
    );
  }
}

/**
 * Get weight of a single item
 * @param {Object} item - Cart item object
 * @returns {number} Weight in kg (defaults to 0.5kg if not specified)
 */
function getItemWeight(item) {
  if (item?.weight && typeof item.weight === "object") {
    const snapshotWeight = Number(item.weight.value);
    if (Number.isFinite(snapshotWeight) && snapshotWeight > 0) {
      return snapshotWeight;
    }
  }

  const product = item.product || item;

  // Try structured weight field first
  if (product.weight && typeof product.weight === "object") {
    const weight = product.weight.value;
    if (typeof weight === "number" && weight > 0) {
      return weight;
    }
  }

  // Fallback for legacy weight field (number)
  if (typeof product.weight === "number" && product.weight > 0) {
    return product.weight;
  }

  // Default weight for products without weight specified (0.5kg)
  logger.warn("Product weight missing; using default shipment weight", {
    source: "cartWeightCalculator",
    event: "product_weight_missing",
    productId: product._id ? String(product._id) : null,
  });
  return 0.5;
}

/**
 * Validate that cart has items
 * @param {Array} cartItems - Array of cart items
 * @throws {AppError} If cart is empty
 */
function validateAllItemsHaveWeight(cartItems) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new AppError("Cart is empty", 400, "EMPTY_CART");
  }
}

/**
 * Get weight breakdown by item
 * Useful for debugging and detailed calculations
 * @param {Array} cartItems - Array of cart items
 * @returns {Array} Array of {itemName, quantity, weight, totalWeight}
 */
function getWeightBreakdown(cartItems) {
  if (!Array.isArray(cartItems)) {
    return [];
  }

  return cartItems.map((item) => {
    const product = item.product || item;
    const itemWeight = getItemWeight(item);
    const quantity = item.quantity || 1;

    return {
      productId: product._id || product.id,
      productName: product.name || "Unknown",
      quantity,
      weightPerUnit: itemWeight,
      totalWeight: Math.round(itemWeight * quantity * 1000) / 1000,
    };
  });
}

module.exports = {
  calculateCartWeight,
  getItemWeight,
  validateAllItemsHaveWeight,
  getWeightBreakdown,
};
