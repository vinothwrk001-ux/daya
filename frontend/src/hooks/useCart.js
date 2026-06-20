import { logger } from "../services/logger/logger.js";
import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "../context/authStore";
import useAuthCartStore from "../context/authCartStore";
import useGuestCartStore from "../context/guestCartStore";
import { cartService } from "../services/cartService";
import {
  normalizeAddToCartResponse,
  normalizeCartPayload,
  getCartItemKey,
} from "../utils/cartState";
import {
  bumpCartStateVersion,
  isCurrentCartStateVersion,
  resetCartStateVersion,
} from "../utils/cartStateVersion";

const pendingAddItemRequests = new Map();

/**
 * Unified Cart Hook
 * Works seamlessly for both authenticated and guest users
 */
export const useCart = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authCart = useAuthCartStore((state) => state.cart);
  const setAuthCart = useAuthCartStore((state) => state.setCart);
  const clearAuthCart = useAuthCartStore((state) => state.clearCart);
  const guestCart = useGuestCartStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isGuest = !isAuthenticated;

  const getCurrentCart = useCallback(() => {
    if (isGuest) {
      return {
        items: guestCart.items,
        totalAmount: guestCart.totalAmount,
        itemCount: guestCart.getItemCount(),
        totalQuantity: guestCart.getTotalQuantity(),
      };
    }
    return normalizeCartPayload(authCart);
  }, [authCart, guestCart, isGuest]);

  const applyAuthCart = useCallback(
    (cartLike) => {
      const normalized = normalizeCartPayload(cartLike);
      setAuthCart(normalized);
      return normalized;
    },
    [setAuthCart]
  );

  const fetchAuthCart = useCallback(async () => {
    if (!isAuthenticated) return null;

    const fetchVersion = bumpCartStateVersion();
    setLoading(true);
    setError(null);

    try {
      const cart = await cartService.getCart();
      if (!isCurrentCartStateVersion(fetchVersion)) {
        return null;
      }
      return applyAuthCart(cart);
    } catch (err) {
      setError(err.message);
      logger.error("Failed to fetch cart:", { error: err });
      return null;
    } finally {
      setLoading(false);
    }
  }, [applyAuthCart, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      resetCartStateVersion();
      clearAuthCart();
      return;
    }

    fetchAuthCart().catch(() => {});
  }, [clearAuthCart, fetchAuthCart, isAuthenticated]);

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
              maxQuantity: enrichedItem.maxQuantity ?? enrichedItem.stock,
              availableStock: enrichedItem.availableStock,
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
          const normalized = applyAuthCart(normalizeAddToCartResponse(result));
          const addedItem = result?.addedItem || normalized.items?.[0] || normalized;
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
    [applyAuthCart, guestCart, isGuest]
  );

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
      }

      try {
        setLoading(true);
        const updatedCart = await cartService.updateCartItem(productId, quantity, variantId);
        return applyAuthCart(updatedCart);
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [applyAuthCart, guestCart, isGuest]
  );

  const removeItem = useCallback(
    async (productId, variantId = "") => {
      setError(null);

      if (isGuest) {
        guestCart.removeItem(productId, variantId);
        return guestCart.getCart();
      }

      try {
        setLoading(true);
        const updatedCart = await cartService.removeCartItem(productId, variantId);
        return applyAuthCart(updatedCart);
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [applyAuthCart, guestCart, isGuest]
  );

  const clearCart = useCallback(async () => {
    setError(null);

    if (isGuest) {
      guestCart.clearCart();
      return { items: [], totalAmount: 0, totalQuantity: 0 };
    }

    try {
      setLoading(true);
      const result = await cartService.clearCart();
      return applyAuthCart(result);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [applyAuthCart, guestCart, isGuest]);

  const validateCart = useCallback(
    async (itemsOverride = null) => {
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
    },
    [getCurrentCart, guestCart, isGuest]
  );

  const mergeOnLogin = useCallback(async () => {
    if (isGuest || guestCart.isEmpty()) {
      return { merged: 0 };
    }

    try {
      setLoading(true);
      const guestItems = guestCart.items;
      const mergeResult = await cartService.mergeGuestCart(guestItems);
      applyAuthCart(mergeResult.userCart);
      guestCart.clearCart();
      return mergeResult;
    } catch (err) {
      setError(err.message);
      logger.error("Cart merge failed:", { error: err });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [applyAuthCart, guestCart, isGuest]);

  return {
    cart: getCurrentCart(),
    isGuest,
    loading,
    error,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    validateCart,
    mergeOnLogin,
    refreshCart: fetchAuthCart,
  };
};
