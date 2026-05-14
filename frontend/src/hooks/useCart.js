import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "../context/authStore";
import useGuestCartStore from "../context/guestCartStore";
import { cartService } from "../services/cartService";

/**
 * Unified Cart Hook
 * Works seamlessly for both authenticated and guest users
 *
 * For guests: uses localStorage cart via Zustand
 * For authenticated: uses backend cart API
 */
export const useCart = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guestCart = useGuestCartStore();
  const [authCart, setAuthCart] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const normalizeAuthCart = useCallback((response) => {
    return response?.data || response || { items: [], totalAmount: 0, itemCount: 0, totalQuantity: 0 };
  }, []);

  /**
   * Determine which cart to use
   */
  const isGuest = !isAuthenticated;

  /**
   * Get current cart (either guest or auth)
   */
  const getCurrentCart = useCallback(() => {
    if (isGuest) {
      return {
        items: guestCart.items,
        totalAmount: guestCart.totalAmount,
        itemCount: guestCart.getItemCount(),
        totalQuantity: guestCart.getTotalQuantity(),
      };
    } else {
      const current = authCart || { items: [], totalAmount: 0, itemCount: 0, totalQuantity: 0 };
      return {
        ...current,
        itemCount: current.itemCount ?? current.items?.length ?? 0,
        totalQuantity:
          current.totalQuantity ??
          (Array.isArray(current.items)
            ? current.items.reduce((sum, item) => sum + Number(item?.quantity || 0), 0)
            : 0),
      };
    }
  }, [isGuest, guestCart, authCart]);

  /**
   * Fetch authenticated user's cart
   */
  const fetchAuthCart = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);
    try {
      const cart = await cartService.getCart();
      const normalized = normalizeAuthCart(cart);
      setAuthCart(normalized);
      return normalized;
    } catch (err) {
      setError(err.message);
      console.error("Failed to fetch cart:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, normalizeAuthCart]);

  /**
   * Initialize cart on mount (fetch if authenticated)
   */
  useEffect(() => {
    if (isAuthenticated) {
      fetchAuthCart();
    }
  }, [isAuthenticated, fetchAuthCart]);

  /**
   * Add item to cart
   */
  const addItem = useCallback(
    async (productId, quantity = 1, variantId = "") => {
      setError(null);

      if (isGuest) {
        // For guest: validate item first, then add
        try {
          const enrichedItem = await cartService.validateItem(productId, quantity, variantId);
          guestCart.addItem(enrichedItem);
          return enrichedItem;
        } catch (err) {
          setError(err.message);
          throw err;
        }
      } else {
        // For auth: use backend API
        try {
          setLoading(true);
          const updatedCart = await cartService.addToCart(productId, quantity, variantId);
          const normalized = normalizeAuthCart(updatedCart);
          setAuthCart(normalized);
          return normalized;
        } catch (err) {
          setError(err.message);
          throw err;
        } finally {
          setLoading(false);
        }
      }
    },
    [isGuest, guestCart, normalizeAuthCart]
  );

  /**
   * Update item quantity
   */
  const updateItem = useCallback(
    async (productId, quantity, variantId = "") => {
      setError(null);

      if (isGuest) {
        // For guest: update locally
        guestCart.updateItem(productId, variantId, quantity);
        return guestCart.getCart();
      } else {
        // For auth: use backend API
        try {
          setLoading(true);
          const updatedCart = await cartService.updateCartItem(productId, quantity, variantId);
          const normalized = normalizeAuthCart(updatedCart);
          setAuthCart(normalized);
          return normalized;
        } catch (err) {
          setError(err.message);
          throw err;
        } finally {
          setLoading(false);
        }
      }
    },
    [isGuest, guestCart, normalizeAuthCart]
  );

  /**
   * Remove item from cart
   */
  const removeItem = useCallback(
    async (productId, variantId = "") => {
      setError(null);

      if (isGuest) {
        // For guest: remove locally
        guestCart.removeItem(productId, variantId);
        return guestCart.getCart();
      } else {
        // For auth: use backend API
        try {
          setLoading(true);
          const updatedCart = await cartService.removeCartItem(productId, variantId);
          const normalized = normalizeAuthCart(updatedCart);
          setAuthCart(normalized);
          return normalized;
        } catch (err) {
          setError(err.message);
          throw err;
        } finally {
          setLoading(false);
        }
      }
    },
    [isGuest, guestCart, normalizeAuthCart]
  );

  /**
   * Clear cart
   */
  const clearCart = useCallback(async () => {
    setError(null);

    if (isGuest) {
      guestCart.clearCart();
      return { items: [], totalAmount: 0 };
    } else {
      try {
        setLoading(true);
        const result = await cartService.clearCart();
        const normalized = normalizeAuthCart(result);
        setAuthCart(normalized);
        return normalized;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    }
  }, [isGuest, guestCart, normalizeAuthCart]);

  /**
   * Validate cart (recheck inventory, pricing)
   */
  const validateCart = useCallback(async () => {
    const currentCart = getCurrentCart();

    if (currentCart.items.length === 0) {
      return { validatedItems: [], errors: [] };
    }

    try {
      setLoading(true);
      const validation = await cartService.validateCart(currentCart.items);

      // If guest, update with validated items
      if (isGuest) {
        guestCart.setValidatedItems(validation.validatedItems);
      }

      return validation;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isGuest, getCurrentCart, guestCart]);

  /**
   * Merge guest cart on login (called after authentication)
   */
  const mergeOnLogin = useCallback(async () => {
    if (isGuest || guestCart.isEmpty()) {
      return { merged: 0 };
    }

    try {
      setLoading(true);
      const guestItems = guestCart.items;

      // Call merge endpoint on backend
      const mergeResult = await cartService.mergeGuestCart(guestItems);

      // Update auth cart with merged result
      setAuthCart(normalizeAuthCart(mergeResult.userCart));

      // Clear guest cart
      guestCart.clearCart();

      return mergeResult;
    } catch (err) {
      setError(err.message);
      console.error("Cart merge failed:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isGuest, guestCart, normalizeAuthCart]);

  return {
    // State
    cart: getCurrentCart(),
    isGuest,
    loading,
    error,

    // Methods
    addItem,
    updateItem,
    removeItem,
    clearCart,
    validateCart,
    mergeOnLogin,
    refreshCart: fetchAuthCart,
  };
};
