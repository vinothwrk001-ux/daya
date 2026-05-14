/**
 * Cart Merger Utility
 * Handles merging of guest and authenticated user carts
 * High-level orchestration for cart sync operations
 */

import { useCart } from "../hooks/useCart";
import { useWishlist } from "../hooks/useWishlist";
import useGuestCartStore from "../context/guestCartStore";
import useGuestWishlistStore from "../context/guestWishlistStore";

export const cartMerger = {
  /**
   * Perform complete post-login merge
   * Merges both cart and wishlist
   */
  mergeGuestDataOnLogin: async (authAPI) => {
    const guestCartItems = useGuestCartStore.getState().items;
    const guestWishlistItems = useGuestWishlistStore.getState().items;

    try {
      // Call backend merge endpoint
      const mergeResult = await authAPI.mergeGuestData({
        guestCartItems,
        guestWishlistItems,
      });

      // Clear guest stores after successful merge
      if (mergeResult.cartMerge?.success) {
        useGuestCartStore.getState().clearCart();
      }
      if (mergeResult.wishlistMerge?.success) {
        useGuestWishlistStore.getState().clearWishlist();
      }

      return mergeResult;
    } catch (err) {
      console.error("Failed to merge guest data:", err);
      throw err;
    }
  },

  /**
   * Get merge summary without performing merge
   * Shows user what will be merged
   */
  getMergeSummary: async (authAPI) => {
    const guestCartItems = useGuestCartStore.getState().items;
    const guestWishlistItems = useGuestWishlistStore.getState().items;

    try {
      const summary = await authAPI.getMergeSummary({
        guestCartItems,
        guestWishlistItems,
      });

      return summary;
    } catch (err) {
      console.error("Failed to get merge summary:", err);
      return null;
    }
  },

  /**
   * Check if there's guest data to merge
   */
  hasGuestData: () => {
    const hasCart = useGuestCartStore.getState().items.length > 0;
    const hasWishlist = useGuestWishlistStore.getState().items.length > 0;
    return hasCart || hasWishlist;
  },

  /**
   * Get guest data size (item counts)
   */
  getGuestDataSize: () => {
    return {
      cartItems: useGuestCartStore.getState().items.length,
      wishlistItems: useGuestWishlistStore.getState().items.length,
    };
  },

  /**
   * Clear all guest data (use carefully!)
   */
  clearGuestData: () => {
    useGuestCartStore.getState().clearCart();
    useGuestWishlistStore.getState().clearWishlist();
  },

  /**
   * Export guest data (for backup or debug)
   */
  exportGuestData: () => {
    return {
      cart: useGuestCartStore.getState().items,
      wishlist: useGuestWishlistStore.getState().items,
      exportedAt: new Date().toISOString(),
    };
  },
};

export default cartMerger;
