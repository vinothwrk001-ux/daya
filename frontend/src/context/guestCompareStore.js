import { create } from "zustand";
import { persist } from "zustand/middleware";

export const MAX_COMPARE_ITEMS = 4;

function normalizeCompareProduct(item) {
  const product = item?.product || item;
  const productId = item?.productId || product?._id || item?._id;
  return {
    productId: String(productId || ""),
    product,
    addedAt: item?.addedAt || Date.now(),
  };
}

const useGuestCompareStore = create(
  persist(
    (set, get) => ({
      items: [],
      maxItems: MAX_COMPARE_ITEMS,

      addItem: (item) => {
        const normalized = normalizeCompareProduct(item);
        if (!normalized.productId) return { saved: false, reason: "missing-product" };

        const currentItems = get().items;
        if (currentItems.some((entry) => String(entry.productId) === normalized.productId)) {
          return { saved: true, duplicate: true };
        }
        if (currentItems.length >= MAX_COMPARE_ITEMS) {
          return { saved: false, limitReached: true, maxItems: MAX_COMPARE_ITEMS };
        }

        set({ items: [...currentItems, normalized] });
        return { saved: true };
      },

      removeItem: (productId) => {
        const targetId = String(productId || "");
        set((state) => ({
          items: state.items.filter((item) => String(item.productId) !== targetId),
        }));
        return { saved: false };
      },

      clearCompare: () => set({ items: [] }),

      replaceCompare: (items = []) => {
        const unique = [];
        items.forEach((item) => {
          const normalized = normalizeCompareProduct(item);
          if (!normalized.productId) return;
          if (unique.some((entry) => entry.productId === normalized.productId)) return;
          unique.push(normalized);
        });
        set({ items: unique.slice(0, MAX_COMPARE_ITEMS) });
      },

      isInCompare: (productId) => {
        const targetId = String(productId || "");
        return get().items.some((item) => String(item.productId) === targetId);
      },

      getItemCount: () => get().items.length,
      isFull: () => get().items.length >= MAX_COMPARE_ITEMS,
    }),
    {
      name: "guest_compare",
      version: 1,
    }
  )
);

export default useGuestCompareStore;
