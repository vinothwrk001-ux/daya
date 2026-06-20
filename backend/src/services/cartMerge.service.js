const cartRepo = require("../repositories/cart.repository");
const guestCartService = require("./guestCart.service");
const productRepo = require("../repositories/product.repository");
const { getItemKey, getSellableStock, formatVariantLabel } = require("../utils/cartStock");
const { resolveBestVariant } = require("./variantResolver.service");

/**
 * Cart Merge Service
 * Handles merging guest cart (from localStorage) into authenticated user cart
 * Prevents duplicates, updates quantities intelligently, validates inventory
 */

function computeTotal(items = []) {
  return items.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0), 0);
}

function getVariantForProduct(product, variantId) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return null;
  if (!variantId) {
    return resolveBestVariant(product);
  }
  return variants.find((item) => item.variantId === variantId && item.isActive) || null;
}

async function resolveSellableQuantity(productId, variantId = "") {
  const product = await productRepo.findById(productId);
  if (!product) return 0;
  const variant = getVariantForProduct(product, variantId);
  return variant ? getSellableStock(variant) : getSellableStock(product);
}

class CartMergeService {
  /**
   * Merge guest cart items into user cart
   *
   * Strategy:
   * 1. Validate guest items against current DB state (inventory, pricing, availability)
   * 2. For existing items in user cart: ADD quantities together, capped to sellable stock
   * 3. For new items: add to user cart, capped to sellable stock
   * 4. Remove invalid items from merge
   * 5. Return merge result with conflicts/errors
   */
  async mergeGuestCartIntoUserCart(userId, guestCartItems = []) {
    if (!Array.isArray(guestCartItems) || guestCartItems.length === 0) {
      return {
        success: true,
        merged: 0,
        conflicts: [],
        errors: [],
        adjusted: false,
        userCart: await cartRepo.findByUserId(userId),
      };
    }

    const validation = await guestCartService.validateCartItems(guestCartItems);
    const validItems = validation.validatedItems;
    const userCart = await cartRepo.upsertEmpty(userId);

    const mergeResult = {
      success: true,
      merged: 0,
      conflicts: [],
      errors: validation.errors,
      adjusted: false,
    };

    for (const guestItem of validItems) {
      try {
        const itemKey = getItemKey(guestItem.productId, guestItem.variantId);
        const existingIdx = userCart.items.findIndex((x) => getItemKey(x.productId, x.variantId) === itemKey);
        const sellable = await resolveSellableQuantity(guestItem.productId, guestItem.variantId);
        const variantLabel = guestItem.variantTitle || formatVariantLabel({ variantId: guestItem.variantId });

        if (existingIdx >= 0) {
          const currentQty = Number(userCart.items[existingIdx].quantity || 0);
          const requestedQty = currentQty + Number(guestItem.quantity || 0);
          const mergedQty = Math.min(requestedQty, sellable);

          if (mergedQty < requestedQty) {
            mergeResult.adjusted = true;
            mergeResult.conflicts.push({
              productId: guestItem.productId,
              variantId: guestItem.variantId || "",
              reason: "Some quantities were adjusted due to stock availability",
              variantTitle: variantLabel,
              requestedQuantity: requestedQty,
              mergedQuantity: mergedQty,
              availableStock: sellable,
            });
          }

          if (mergedQty <= 0) {
            userCart.items.splice(existingIdx, 1);
            continue;
          }

          const enriched = await guestCartService.validateAndEnrichItem(
            guestItem.productId,
            mergedQty,
            guestItem.variantId
          );

          userCart.items[existingIdx].quantity = mergedQty;
          userCart.items[existingIdx].price = enriched.price;
          userCart.items[existingIdx].image = enriched.image;
          userCart.items[existingIdx].variantSku = enriched.variantSku;
          userCart.items[existingIdx].variantTitle = enriched.variantTitle;
          userCart.items[existingIdx].variantAttributes = enriched.variantAttributes;
          userCart.items[existingIdx].maxQuantity = sellable;
          userCart.items[existingIdx].availableStock = Math.max(0, sellable - mergedQty);
          mergeResult.merged++;
        } else {
          const requestedQty = Number(guestItem.quantity || 0);
          const mergedQty = Math.min(requestedQty, sellable);

          if (mergedQty < requestedQty) {
            mergeResult.adjusted = true;
            mergeResult.conflicts.push({
              productId: guestItem.productId,
              variantId: guestItem.variantId || "",
              reason: "Some quantities were adjusted due to stock availability",
              variantTitle: variantLabel,
              requestedQuantity: requestedQty,
              mergedQuantity: mergedQty,
              availableStock: sellable,
            });
          }

          if (mergedQty <= 0) {
            continue;
          }

          const enriched = await guestCartService.validateAndEnrichItem(
            guestItem.productId,
            mergedQty,
            guestItem.variantId
          );

          userCart.items.push({
            productId: guestItem.productId,
            quantity: mergedQty,
            price: enriched.price,
            image: enriched.image,
            variantId: enriched.variantId,
            variantSku: enriched.variantSku,
            variantTitle: enriched.variantTitle,
            variantAttributes: enriched.variantAttributes,
            maxQuantity: sellable,
            availableStock: Math.max(0, sellable - mergedQty),
          });
          mergeResult.merged++;
        }
      } catch (e) {
        mergeResult.errors.push({
          productId: guestItem.productId,
          error: e.message,
          code: e.code || "VALIDATION_ERROR",
        });
      }
    }

    userCart.totalAmount = computeTotal(userCart.items);
    await cartRepo.save(userCart);

    return {
      ...mergeResult,
      userCart: await cartRepo.findByUserId(userId),
    };
  }

  hasGuestCartItems(guestCartItems = []) {
    return Array.isArray(guestCartItems) && guestCartItems.length > 0;
  }

  async getMergeSummary(userId, guestCartItems = []) {
    const validation = await guestCartService.validateCartItems(guestCartItems);
    const userCart = await cartRepo.findByUserId(userId);

    const summary = {
      guestItemsCount: guestCartItems.length,
      validGuestItems: validation.validatedItems.length,
      invalidGuestItems: validation.errors.length,
      userCartItemsCount: userCart.items.length,
      duplicateItems: 0,
      newItems: 0,
      conflicts: [],
      adjusted: false,
    };

    for (const guestItem of validation.validatedItems) {
      const itemKey = getItemKey(guestItem.productId, guestItem.variantId);
      const existingIdx = userCart.items.findIndex((x) => getItemKey(x.productId, x.variantId) === itemKey);
      const sellable = await resolveSellableQuantity(guestItem.productId, guestItem.variantId);

      if (existingIdx >= 0) {
        summary.duplicateItems++;
        const mergedQuantity = Math.min(
          Number(userCart.items[existingIdx].quantity) + Number(guestItem.quantity),
          sellable
        );
        if (mergedQuantity < Number(userCart.items[existingIdx].quantity) + Number(guestItem.quantity)) {
          summary.adjusted = true;
        }
        summary.conflicts.push({
          productId: guestItem.productId,
          guestQuantity: guestItem.quantity,
          cartQuantity: userCart.items[existingIdx].quantity,
          mergedQuantity,
          availableStock: sellable,
        });
      } else {
        summary.newItems++;
        const mergedQuantity = Math.min(Number(guestItem.quantity || 0), sellable);
        if (mergedQuantity < Number(guestItem.quantity || 0)) {
          summary.adjusted = true;
        }
      }
    }

    return summary;
  }
}

module.exports = new CartMergeService();
