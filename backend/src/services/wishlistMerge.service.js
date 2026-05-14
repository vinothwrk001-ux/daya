const { Wishlist } = require("../models/Wishlist");
const wishlistService = require("./wishlist.service");
const guestWishlistService = require("./guestWishlist.service");

/**
 * Wishlist Merge Service
 * Handles merging guest wishlist (from localStorage) into authenticated user wishlist
 * Prevents duplicates, ensures items are still available
 */

class WishlistMergeService {
  /**
   * Merge guest wishlist items into user wishlist
   *
   * Strategy:
   * 1. Validate guest items against current DB state
   * 2. Prevent duplicates (same productId = duplicate)
   * 3. Skip invalid items
   * 4. Return merge result with stats
   */
  async mergeGuestWishlistIntoUserWishlist(userId, guestWishlistItems = []) {
    if (!Array.isArray(guestWishlistItems) || guestWishlistItems.length === 0) {
      const userWishlist = await wishlistService.listWishlist(userId);
      return {
        success: true,
        merged: 0,
        skipped: 0,
        errors: [],
        userWishlist,
      };
    }

    // Validate all guest items
    const validation = await guestWishlistService.validateWishlistItems(guestWishlistItems);

    const validItems = validation.validatedItems;
    const userWishlist = await Wishlist.find({ userId }).select("productId variantId selectedAttributes");

    const mergeResult = {
      success: true,
      merged: 0,
      skipped: 0,
      duplicates: 0,
      errors: validation.removedItems.map((item) => ({
        productId: item.productId,
        error: "Product no longer available",
      })),
    };

    // Merge each valid guest item
    for (const guestItem of validItems) {
      try {
        const productId = guestItem.productId;

        // Check if already in user wishlist
        const existingIdx = userWishlist.findIndex((w) => String(w.productId) === String(productId));

        if (existingIdx >= 0) {
          // Item already in wishlist - skip
          mergeResult.duplicates++;
          mergeResult.skipped++;
        } else {
          // New item - add to user wishlist
          await wishlistService.addToWishlist(
            userId,
            productId,
            guestItem.variantId || null,
            guestItem.selectedAttributes || {}
          );
          mergeResult.merged++;
        }
      } catch (e) {
        mergeResult.errors.push({
          productId: guestItem.productId,
          error: e.message,
        });
      }
    }

    return {
      ...mergeResult,
      userWishlist: await wishlistService.listWishlist(userId),
    };
  }

  /**
   * Check if merge is needed (guest wishlist has items)
   */
  hasGuestWishlistItems(guestWishlistItems = []) {
    return Array.isArray(guestWishlistItems) && guestWishlistItems.length > 0;
  }

  /**
   * Get merge summary without actually merging
   */
  async getMergeSummary(userId, guestWishlistItems = []) {
    const validation = await guestWishlistService.validateWishlistItems(guestWishlistItems);
    const userWishlist = await Wishlist.find({ userId }).select("productId");

    const summary = {
      guestItemsCount: guestWishlistItems.length,
      validGuestItems: validation.validatedItems.length,
      invalidGuestItems: validation.removedItems.length,
      userWishlistItemsCount: userWishlist.length,
      duplicateItems: 0,
      newItems: 0,
    };

    // Count duplicates and new items
    for (const guestItem of validation.validatedItems) {
      const existingIdx = userWishlist.findIndex((w) => String(w.productId) === String(guestItem.productId));
      if (existingIdx >= 0) {
        summary.duplicateItems++;
      } else {
        summary.newItems++;
      }
    }

    return summary;
  }
}

module.exports = new WishlistMergeService();
