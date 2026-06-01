import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "../context/authStore";
import useAuthCartStore from "../context/authCartStore";
import useGuestCartStore from "../context/guestCartStore";
import { cartService } from "../services/cartService";
import { normalizeCartPayload, getCartItemKey } from "../utils/cartState";

const pendingAddItemRequests = new Map();

/**
 * Unified Cart Hook
 * Works seamlessly for both authenticated and guest users
 *
 * For guests: uses localStorage cart via Zustand
 * For authenticated: uses backend cart API
 */
export const useCart = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authCart = useAuthCartStore((state) => state.cart);
  const setAuthCart = useAuthCartStore((state) => state.setCart);
  const clearAuthCart = useAuthCartStore((state) => state.clearCart);
  const guestCart = useGuestCartStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
      return normalizeCartPayload(authCart);
    }
  }, [authCart, guestCart, isGuest]);

  /**
   * Fetch authenticated user's cart
   */
  const fetchAuthCart = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);
    try {
      const cart = await cartService.getCart();
      const normalized = normalizeCartPayload(cart);
      setAuthCart(normalized);
      return normalized;
    } catch (err) {
      setError(err.message);
      console.error("Failed to fetch cart:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, setAuthCart]);

  /**
   * Initialize cart on mount (fetch if authenticated)
   */
  useEffect(() => {
    if (isAuthenticated) {
      fetchAuthCart();
    } else {
      clearAuthCart();
    }
  }, [clearAuthCart, isAuthenticated, fetchAuthCart]);

  /**
   * Add item to cart
   */
  const addItem = useCallback(
    async (productId, quantity = 1, variantId = "") => {
      setError(null);
      const requestKey = `${isGuest ? "guest" : "auth"}:${getCartItemKey(productId, variantId)}`;

      if (pendingAddItemRequests.has(requestKey)) {
        return pendingAddItemRequests.get(requestKey);
      }

      const request = (async () => {
        if (isGuest) {
          try {
            const existingItem = guestCart.items.find(
              (item) =>
                String(item.productId) === String(productId) &&
                String(item.variantId || "") === String(variantId || "")
            );
            const addQuantity = Number(quantity || 1);
            const totalQuantity = (existingItem?.quantity || 0) + addQuantity;
            const enrichedItem = await cartService.validateItem(productId, totalQuantity, variantId);
            guestCart.addItem({
              ...enrichedItem,
              quantity: addQuantity,
            });
            return {
              ...enrichedItem,
              variant: {
                variantId: enrichedItem.variantId || "",
                title: enrichedItem.variantTitle || "",
                selectedAttributes: enrichedItem.variantAttributes || {},
              },
            };
          } catch (err) {
            setError(err.message);
            throw err;
          }
        }

        try {
          setLoading(true);
          const result = await cartService.addToCart(productId, quantity, variantId);
          const normalized = normalizeCartPayload(result?.cart || result);
          setAuthCart(normalized);
          const addedItem = result?.addedItem || normalized;
          return {
            ...addedItem,
            variant: addedItem?.variant || {
              variantId: addedItem?.variantId || "",
              title: addedItem?.variantTitle || "",
              selectedAttributes: addedItem?.variantAttributes || {},
            },
            cart: normalized,
          };
        } catch (err) {
          setError(err.message);
          throw err;
        } finally {
          setLoading(false);
        }
      })();

      pendingAddItemRequests.set(requestKey, request);
      try {
        return await request;
      } finally {
        pendingAddItemRequests.delete(requestKey);
      }
    },
    [guestCart, isGuest, setAuthCart]
  );

  /**
   * Update item quantity
   */
  const updateItem = useCallback(
    async (productId, quantity, variantId = "") => {
      setError(null);

      if (isGuest) {
        try {
          await cartService.validateItem(productId, quantity, variantId);
          guestCart.updateItem(productId, variantId, quantity);
          return guestCart.getCart();
        } catch (err) {
          setError(err.message);
          throw err;
        }
      } else {
        // For auth: use backend API
        try {
          setLoading(true);
          const updatedCart = await cartService.updateCartItem(productId, quantity, variantId);
          const normalized = normalizeCartPayload(updatedCart);
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
    [guestCart, isGuest, setAuthCart]
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
          const normalized = normalizeCartPayload(updatedCart);
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
    [guestCart, isGuest, setAuthCart]
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
        const normalized = normalizeCartPayload(result);
        setAuthCart(normalized);
        return normalized;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    }
  }, [guestCart, isGuest, setAuthCart]);

  /**
   * Validate cart (recheck inventory, pricing)
   */
  const validateCart = useCallback(async (itemsOverride = null) => {
    const currentCart = Array.isArray(itemsOverride)
      ? {
          items: itemsOverride,
          totalAmount: itemsOverride.reduce(
            (sum, item) => sum + Number(item?.price || 0) * Number(item?.quantity || 0),
            0
          ),
        }
      : getCurrentCart();

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
      setAuthCart(normalizeCartPayload(mergeResult.userCart));

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
  }, [guestCart, isGuest, setAuthCart]);

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
