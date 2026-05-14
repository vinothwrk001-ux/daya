import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "../context/authStore";
import useGuestWishlistStore from "../context/guestWishlistStore";
import { wishlistService } from "../services/wishlistService";

/**
 * Unified Wishlist Hook
 * Works seamlessly for both authenticated and guest users
 *
 * For guests: uses localStorage wishlist via Zustand
 * For authenticated: uses backend wishlist API
 */
export const useWishlist = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guestWishlist = useGuestWishlistStore();
  const [authWishlist, setAuthWishlist] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const normalizeAuthWishlist = useCallback((response) => {
    const items = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
    return { items, itemCount: items.length };
  }, []);

  /**
   * Determine which wishlist to use
   */
  const isGuest = !isAuthenticated;

  /**
   * Get current wishlist (either guest or auth)
   */
  const getCurrentWishlist = useCallback(() => {
    if (isGuest) {
      return {
        items: guestWishlist.items,
        itemCount: guestWishlist.getItemCount(),
      };
    } else {
      return authWishlist || { items: [], itemCount: 0 };
    }
  }, [isGuest, guestWishlist, authWishlist]);

  /**
   * Fetch authenticated user's wishlist
   */
  const fetchAuthWishlist = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);
    try {
      const wishlist = await wishlistService.getWishlist();
      setAuthWishlist(normalizeAuthWishlist(wishlist));
    } catch (err) {
      setError(err.message);
      console.error("Failed to fetch wishlist:", err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, normalizeAuthWishlist]);

  /**
   * Initialize wishlist on mount (fetch if authenticated)
   */
  useEffect(() => {
    if (isAuthenticated) {
      fetchAuthWishlist();
    }
  }, [isAuthenticated, fetchAuthWishlist]);

  /**
   * Check if product is in wishlist
   */
  const isInWishlist = useCallback(
    async (productId) => {
      if (isGuest) {
        return guestWishlist.isInWishlist(productId);
      } else {
        try {
          const status = await wishlistService.checkWishlistStatus(productId);
          return Boolean(status?.saved ?? status?.inWishlist);
        } catch (err) {
          console.error("Failed to check wishlist status:", err);
          return false;
        }
      }
    },
    [isGuest, guestWishlist]
  );

  /**
   * Add item to wishlist
   */
  const addItem = useCallback(
    async (productId, variantId = "", selectedAttributes = {}) => {
      setError(null);

      if (isGuest) {
        // For guest: validate product first, then add
        try {
          const validatedProduct = await wishlistService.validateProduct(productId, variantId);
          guestWishlist.addItem({
            ...validatedProduct,
            selectedAttributes,
          });
          return validatedProduct;
        } catch (err) {
          setError(err.message);
          throw err;
        }
      } else {
        // For auth: use backend API
        try {
          setLoading(true);
          const result = await wishlistService.addToWishlist(productId, variantId, selectedAttributes);
          // Refresh wishlist after adding
          await fetchAuthWishlist();
          await wishlistService.syncWishlistBadge();
          return result;
        } catch (err) {
          setError(err.message);
          throw err;
        } finally {
          setLoading(false);
        }
      }
    },
    [isGuest, guestWishlist, fetchAuthWishlist]
  );

  /**
   * Remove item from wishlist
   */
  const removeItem = useCallback(
    async (productId) => {
      setError(null);

      if (isGuest) {
        // For guest: remove locally
        guestWishlist.removeItem(productId);
        return { success: true };
      } else {
        // For auth: use backend API
        try {
          setLoading(true);
          const result = await wishlistService.removeFromWishlist(productId);
          // Refresh wishlist after removal
          await fetchAuthWishlist();
          await wishlistService.syncWishlistBadge();
          return result;
        } catch (err) {
          setError(err.message);
          throw err;
        } finally {
          setLoading(false);
        }
      }
    },
    [isGuest, guestWishlist, fetchAuthWishlist]
  );

  /**
   * Clear wishlist
   */
  const clearWishlist = useCallback(() => {
    if (isGuest) {
      guestWishlist.clearWishlist();
      return { items: [] };
    }
    // For auth users, we'd need a backend endpoint
    // For now, just clear local state
  }, [isGuest, guestWishlist]);

  /**
   * Validate wishlist items (check if still available)
   */
  const validateWishlist = useCallback(async () => {
    const currentWishlist = getCurrentWishlist();

    if (currentWishlist.items.length === 0) {
      return { validatedItems: [], removedItems: [] };
    }

    try {
      setLoading(true);
      const validation = await wishlistService.validateWishlistItems(currentWishlist.items);

      // If guest, update with validated items and remove invalid ones
      if (isGuest) {
        if (validation.removedItems?.length > 0) {
          validation.removedItems.forEach((item) => {
            guestWishlist.removeItem(item.productId);
          });
        }
      }

      return validation;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isGuest, getCurrentWishlist, guestWishlist]);

  /**
   * Merge guest wishlist on login (called after authentication)
   */
  const mergeOnLogin = useCallback(async () => {
    if (isGuest || guestWishlist.isEmpty()) {
      return { merged: 0 };
    }

    try {
      setLoading(true);
      const guestItems = guestWishlist.items;

      // Call merge endpoint on backend
      const mergeResult = await wishlistService.mergeGuestWishlist(guestItems);

      // Update auth wishlist with merged result
      setAuthWishlist(normalizeAuthWishlist(mergeResult.userWishlist));

      // Clear guest wishlist
      guestWishlist.clearWishlist();

      return mergeResult;
    } catch (err) {
      setError(err.message);
      console.error("Wishlist merge failed:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isGuest, guestWishlist, normalizeAuthWishlist]);

  return {
    // State
    wishlist: getCurrentWishlist(),
    isGuest,
    loading,
    error,

    // Methods
    addItem,
    removeItem,
    clearWishlist,
    isInWishlist,
    validateWishlist,
    mergeOnLogin,
    refreshWishlist: fetchAuthWishlist,
  };
};
