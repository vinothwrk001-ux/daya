import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Guest Wishlist Store
 * Manages wishlist state for non-authenticated users
 * Data persisted to localStorage
 *
 * Structure:
 * [
 *   {
 *     productId: string,
 *     variantId?: string,
 *     name: string,
 *     price: number,
 *     image: string,
 *     addedAt: timestamp
 *   }
 * ]
 */

const useGuestWishlistStore = create(
  persist(
    (set, get) => ({
      items: [],

      /**
       * Add item to guest wishlist
       * Prevents duplicate productIds
       */
      addItem: (item) => {
        set((state) => {
          // Check if product already exists (don't care about variantId)
          const existingIdx = state.items.findIndex((x) => x.productId === item.productId);

          if (existingIdx >= 0) {
            // Already in wishlist
            return state;
          }

          return {
            items: [
              ...state.items,
              {
                ...item,
                variantId: item.variantId || null,
                addedAt: Date.now(),
              },
            ],
          };
        });
      },

      /**
       * Remove item from wishlist
       */
      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((x) => x.productId !== productId),
        }));
      },

      /**
       * Clear entire wishlist
       */
      clearWishlist: () => {
        set({ items: [] });
      },

      /**
       * Get wishlist summary
       */
      getWishlist: () => get(),

      /**
       * Check if product is in wishlist
       */
      isInWishlist: (productId) => {
        return get().items.some((x) => x.productId === productId);
      },

      /**
       * Get item count
       */
      getItemCount: () => get().items.length,

      /**
       * Check if wishlist is empty
       */
      isEmpty: () => get().items.length === 0,

      /**
       * Replace entire wishlist (used after merge/validation)
       */
      replaceWishlist: (items) => {
        set({ items });
      },

      /**
       * Remove invalid items (e.g., deleted products)
       */
      removeItems: (productIds = []) => {
        set((state) => ({
          items: state.items.filter((x) => !productIds.includes(x.productId)),
        }));
      },
    }),
    {
      name: "guest_wishlist", // localStorage key
      version: 1,
    }
  )
);

export default useGuestWishlistStore;
