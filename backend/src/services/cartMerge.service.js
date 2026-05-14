const { AppError } = require("../utils/AppError");
const cartRepo = require("../repositories/cart.repository");
const guestCartService = require("./guestCart.service");

/**
 * Cart Merge Service
 * Handles merging guest cart (from localStorage) into authenticated user cart
 * Prevents duplicates, updates quantities intelligently, validates inventory
 */

function getItemKey(productId, variantId = "") {
  return `${String(productId)}::${String(variantId || "")}`;
}

function computeTotal(items = []) {
  return items.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0), 0);
}

class CartMergeService {
  /**
   * Merge guest cart items into user cart
   *
   * Strategy:
   * 1. Validate guest items against current DB state (inventory, pricing, availability)
   * 2. For existing items in user cart: ADD quantities together
   * 3. For new items: add to user cart
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
        userCart: await cartRepo.findByUserId(userId),
      };
    }

    // Validate all guest items
    const validation = await guestCartService.validateCartItems(guestCartItems);
    if (validation.errors.length > 0) {
      // Continue with valid items, report errors
    }

    const validItems = validation.validatedItems;
    const userCart = await cartRepo.upsertEmpty(userId);

    const mergeResult = {
      success: true,
      merged: 0,
      conflicts: [],
      errors: validation.errors,
    };

    // Merge each valid guest item
    for (const guestItem of validItems) {
      try {
        const itemKey = getItemKey(guestItem.productId, guestItem.variantId);
        const existingIdx = userCart.items.findIndex((x) => getItemKey(x.productId, x.variantId) === itemKey);

        if (existingIdx >= 0) {
          // Item already in user cart - merge quantities
          const currentQty = Number(userCart.items[existingIdx].quantity || 0);
          const newQty = currentQty + Number(guestItem.quantity || 0);

          // Validate merged quantity doesn't exceed stock
          // Re-validate to get latest stock from DB
          try {
            const enriched = await guestCartService.validateAndEnrichItem(
              guestItem.productId,
              newQty,
              guestItem.variantId
            );

            userCart.items[existingIdx].quantity = newQty;
            userCart.items[existingIdx].price = enriched.price;
            userCart.items[existingIdx].image = enriched.image;
            userCart.items[existingIdx].variantSku = enriched.variantSku;
            userCart.items[existingIdx].variantTitle = enriched.variantTitle;
            userCart.items[existingIdx].variantAttributes = enriched.variantAttributes;
            mergeResult.merged++;
          } catch (validationError) {
            // Quantity too high, keep user's current quantity but report conflict
            mergeResult.conflicts.push({
              productId: guestItem.productId,
              reason: `Merged quantity (${newQty}) exceeds available stock. Kept existing quantity (${currentQty})`,
              guestQuantity: guestItem.quantity,
              cartQuantity: currentQty,
            });
          }
        } else {
          // New item - add to user cart
          userCart.items.push({
            productId: guestItem.productId,
            sellerId: guestItem.vendorId,
            quantity: guestItem.quantity,
            price: guestItem.price,
            image: guestItem.image,
            variantId: guestItem.variantId,
            variantSku: guestItem.variantSku,
            variantTitle: guestItem.variantTitle,
            variantAttributes: guestItem.variantAttributes,
          });
          mergeResult.merged++;
        }
      } catch (e) {
        mergeResult.errors.push({
          productId: guestItem.productId,
          error: e.message,
        });
      }
    }

    // Save merged cart
    userCart.totalAmount = computeTotal(userCart.items);
    await cartRepo.save(userCart);

    return {
      ...mergeResult,
      userCart: await cartRepo.findByUserId(userId),
    };
  }

  /**
   * Check if merge is needed (guest cart has items)
   */
  hasGuestCartItems(guestCartItems = []) {
    return Array.isArray(guestCartItems) && guestCartItems.length > 0;
  }

  /**
   * Get merge summary without actually merging
   * Useful for showing user what will happen
   */
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
    };

    // Count duplicates and new items
    for (const guestItem of validation.validatedItems) {
      const itemKey = getItemKey(guestItem.productId, guestItem.variantId);
      const existingIdx = userCart.items.findIndex((x) => getItemKey(x.productId, x.variantId) === itemKey);

      if (existingIdx >= 0) {
        summary.duplicateItems++;
        summary.conflicts.push({
          productId: guestItem.productId,
          guestQuantity: guestItem.quantity,
          cartQuantity: userCart.items[existingIdx].quantity,
          mergedQuantity: Number(userCart.items[existingIdx].quantity) + Number(guestItem.quantity),
        });
      } else {
        summary.newItems++;
      }
    }

    return summary;
  }
}

module.exports = new CartMergeService();
