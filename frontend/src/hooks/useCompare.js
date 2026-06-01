import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "../context/authStore";
import useGuestCompareStore, { MAX_COMPARE_ITEMS } from "../context/guestCompareStore";
import { compareService } from "../services/compareService";

function normalizeCompareList(response) {
  const items = Array.isArray(response?.items) ? response.items : Array.isArray(response) ? response : [];
  return {
    items,
    itemCount: Number(response?.itemCount ?? items.length),
    maxItems: Number(response?.maxItems || MAX_COMPARE_ITEMS),
  };
}

export function useCompare() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guestCompare = useGuestCompareStore();
  const [authCompare, setAuthCompare] = useState({ items: [], itemCount: 0, maxItems: MAX_COMPARE_ITEMS });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mergeAttemptedRef = useRef(false);

  const isGuest = !isAuthenticated;

  const fetchAuthCompare = useCallback(async () => {
    if (!isAuthenticated) return { items: [], itemCount: 0, maxItems: MAX_COMPARE_ITEMS };
    setLoading(true);
    setError(null);
    try {
      const response = await compareService.getCompareList();
      const normalized = normalizeCompareList(response);
      setAuthCompare(normalized);
      return normalized;
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load compare list.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      mergeAttemptedRef.current = false;
      return;
    }

    let active = true;

    async function loadAndMerge() {
      try {
        if (!mergeAttemptedRef.current && guestCompare.items.length) {
          mergeAttemptedRef.current = true;
          const response = await compareService.mergeGuestCompare(guestCompare.items);
          if (!active) return;
          setAuthCompare(normalizeCompareList(response));
          guestCompare.clearCompare();
          return;
        }
        await fetchAuthCompare();
      } catch (err) {
        if (active) {
          setError(err?.response?.data?.message || err?.message || "Failed to sync compare list.");
        }
      }
    }

    loadAndMerge();

    return () => {
      active = false;
    };
  }, [fetchAuthCompare, guestCompare, isAuthenticated]);

  const compare = isGuest
    ? { items: guestCompare.items, itemCount: guestCompare.getItemCount(), maxItems: MAX_COMPARE_ITEMS }
    : authCompare;

  const isInCompare = useCallback(
    async (productId) => {
      if (!productId) return false;
      if (isGuest) return guestCompare.isInCompare(productId);
      try {
        const response = await compareService.checkCompareStatus(productId);
        return Boolean(response?.saved);
      } catch {
        return false;
      }
    },
    [guestCompare, isGuest]
  );

  const addItem = useCallback(
    async (product) => {
      const productId = product?.productId || product?.product?._id || product?._id;
      if (!productId) {
        throw new Error("Product is missing an id.");
      }

      setError(null);
      if (isGuest) {
        const result = guestCompare.addItem({ productId, product });
        if (result?.limitReached) {
          throw new Error(`You can compare up to ${MAX_COMPARE_ITEMS} products at a time.`);
        }
        return result;
      }

      setLoading(true);
      try {
        const result = await compareService.addToCompare(productId);
        await fetchAuthCompare();
        return result;
      } catch (err) {
        setError(err?.response?.data?.message || err?.message || "Unable to add product to compare.");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchAuthCompare, guestCompare, isGuest]
  );

  const removeItem = useCallback(
    async (productId) => {
      if (!productId) return { saved: false };
      setError(null);
      if (isGuest) return guestCompare.removeItem(productId);

      setLoading(true);
      try {
        const result = await compareService.removeFromCompare(productId);
        await fetchAuthCompare();
        return result;
      } catch (err) {
        setError(err?.response?.data?.message || err?.message || "Unable to remove product from compare.");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchAuthCompare, guestCompare, isGuest]
  );

  return {
    compare,
    isGuest,
    loading,
    error,
    maxItems: MAX_COMPARE_ITEMS,
    addItem,
    removeItem,
    isInCompare,
    refreshCompare: fetchAuthCompare,
    clearCompare: guestCompare.clearCompare,
  };
}
