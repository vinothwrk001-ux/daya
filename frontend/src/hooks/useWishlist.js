import { logger } from "../services/logger/logger.js";
import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "../context/authStore";
import useAuthWishlistStore from "../context/authWishlistStore";
import useGuestWishlistStore from "../context/guestWishlistStore";
import { wishlistService } from "../services/wishlistService";

let authWishlistBootstrapStarted = false;

/**
 * Unified Wishlist Hook
 * Works seamlessly for both authenticated and guest users
 *
 * For guests: uses localStorage wishlist via Zustand
 * For authenticated: uses backend wishlist API
 */
export const useWishlist = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guestWishlistItems = useGuestWishlistStore((state) => state.items);
  const guestIsInWishlist = useGuestWishlistStore((state) => state.isInWishlist);
  const guestAddItem = useGuestWishlistStore((state) => state.addItem);
  const guestRemoveItem = useGuestWishlistStore((state) => state.removeItem);
  const guestClearWishlist = useGuestWishlistStore((state) => state.clearWishlist);
  const guestWishlistIsEmpty = useGuestWishlistStore((state) => state.isEmpty);
  const authWishlistItems = useAuthWishlistStore((state) => state.items);
  const setAuthWishlistItems = useAuthWishlistStore((state) => state.setItems);
  const clearAuthWishlist = useAuthWishlistStore((state) => state.clear);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const normalizeAuthWishlist = useCallback((response) => {
    const items = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
    return items;
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
        items: guestWishlistItems,
        itemCount: guestWishlistItems.length,
      };
    }

    return {
      items: authWishlistItems,
      itemCount: authWishlistItems.length,
    };
  }, [authWishlistItems, guestWishlistItems, isGuest]);

  /**
   * Fetch authenticated user's wishlist
   */
  const fetchAuthWishlist = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);
    try {
      const wishlist = await wishlistService.getWishlist();
      const items = normalizeAuthWishlist(wishlist);
      setAuthWishlistItems(items);
      return items;
    } catch (err) {
      setError(err.message);
      logger.error("Failed to fetch wishlist:", { error: err });
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, normalizeAuthWishlist, setAuthWishlistItems]);

  useEffect(() => {
    if (!isAuthenticated) {
      authWishlistBootstrapStarted = false;
      clearAuthWishlist();
      return;
    }

    if (authWishlistBootstrapStarted) return;
    authWishlistBootstrapStarted = true;
    fetchAuthWishlist();
  }, [clearAuthWishlist, isAuthenticated, fetchAuthWishlist]);

  /**
   * Check if product is in wishlist
   */
  const isInWishlist = useCallback(
    async (productId) => {
      if (isGuest) {
        return guestIsInWishlist(productId);
      }

      return authWishlistItems.some(
        (item) => String(item?.productId || item?._id || item?.product?._id) === String(productId)
      );
    },
    [authWishlistItems, guestIsInWishlist, isGuest]
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
          guestAddItem({
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
    [guestAddItem, fetchAuthWishlist, isGuest]
  );

  /**
   * Remove item from wishlist
   */
  const removeItem = useCallback(
    async (productId) => {
      setError(null);

      if (isGuest) {
        // For guest: remove locally
        guestRemoveItem(productId);
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
    [guestRemoveItem, fetchAuthWishlist, isGuest]
  );

  /**
   * Clear wishlist
   */
  const clearWishlist = useCallback(() => {
    if (isGuest) {
      guestClearWishlist();
      return { items: [] };
    }
    clearAuthWishlist();
    return { items: [] };
  }, [clearAuthWishlist, guestClearWishlist, isGuest]);

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
            guestRemoveItem(item.productId);
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
  }, [getCurrentWishlist, guestRemoveItem, isGuest]);

  /**
   * Merge guest wishlist on login (called after authentication)
   */
  const mergeOnLogin = useCallback(async () => {
    if (isGuest || guestWishlistIsEmpty()) {
      return { merged: 0 };
    }

    try {
      setLoading(true);
      const guestItems = guestWishlistItems;

      const mergeResult = await wishlistService.mergeGuestWishlist(guestItems);
      setAuthWishlistItems(normalizeAuthWishlist(mergeResult.userWishlist));
      guestClearWishlist();

      return mergeResult;
    } catch (err) {
      setError(err.message);
      logger.error("Wishlist merge failed:", { error: err });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [guestClearWishlist, guestWishlistIsEmpty, guestWishlistItems, isGuest, normalizeAuthWishlist, setAuthWishlistItems]);

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
