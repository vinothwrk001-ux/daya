import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Guest Cart Store
 * Manages cart state for non-authenticated users
 * Data persisted to localStorage
 *
 * Structure:
 * [
 *   {
 *     productId: string,
 *     vendorId: string,
 *     quantity: number,
 *     price: number (snapshot),
 *     image: string,
 *     variantId: string,
 *     variantSku: string,
 *     variantTitle: string,
 *     variantAttributes: object,
 *     addedAt: timestamp
 *   }
 * ]
 */

const useGuestCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      totalAmount: 0,

      /**
       * Add item to guest cart
       * Prevents duplicates, updates quantity if exists
       */
      addItem: (item) => {
        set((state) => {
          const existingIdx = state.items.findIndex(
            (x) => x.productId === item.productId && x.variantId === (item.variantId || "")
          );

          let newItems;
          if (existingIdx >= 0) {
            // Item already exists - increase quantity
            newItems = [...state.items];
            newItems[existingIdx] = {
              ...newItems[existingIdx],
              quantity: (newItems[existingIdx].quantity || 0) + (item.quantity || 1),
              price: item.price, // Update to latest price
              image: item.image || newItems[existingIdx].image,
            };
          } else {
            // New item
            newItems = [
              ...state.items,
              {
                ...item,
                quantity: item.quantity || 1,
                variantId: item.variantId || "",
                addedAt: Date.now(),
              },
            ];
          }

          // Compute total
          const totalAmount = newItems.reduce(
            (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
            0
          );

          return { items: newItems, totalAmount };
        });
      },

      /**
       * Update item quantity
       */
      updateItem: (productId, variantId, quantity) => {
        set((state) => {
          const idx = state.items.findIndex(
            (x) => x.productId === productId && x.variantId === (variantId || "")
          );

          if (idx < 0) return state;

          const newItems = [...state.items];
          if (quantity <= 0) {
            newItems.splice(idx, 1);
          } else {
            newItems[idx] = { ...newItems[idx], quantity };
          }

          const totalAmount = newItems.reduce(
            (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
            0
          );

          return { items: newItems, totalAmount };
        });
      },

      /**
       * Remove item from cart
       */
      removeItem: (productId, variantId) => {
        set((state) => {
          const newItems = state.items.filter(
            (x) => !(x.productId === productId && x.variantId === (variantId || ""))
          );

          const totalAmount = newItems.reduce(
            (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
            0
          );

          return { items: newItems, totalAmount };
        });
      },

      /**
       * Clear entire cart
       */
      clearCart: () => {
        set({ items: [], totalAmount: 0 });
      },

      /**
       * Get cart summary
       */
      getCart: () => get(),

      /**
       * Check if cart is empty
       */
      isEmpty: () => get().items.length === 0,

      /**
       * Get item count
       */
      getItemCount: () => get().items.length,

      /**
       * Get total quantity (sum of all item quantities)
       */
      getTotalQuantity: () => {
        return get().items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      },

      /**
       * Replace entire cart (used after merge/validation)
       */
      replaceCart: (items) => {
        const totalAmount = items.reduce(
          (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
          0
        );
        set({ items, totalAmount });
      },

      /**
       * Set items from validated cart (backend validation)
       * Updates prices from backend to prevent manipulation
       */
      setValidatedItems: (validatedItems) => {
        set((state) => {
          const totalAmount = validatedItems.reduce(
            (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
            0
          );

          return { items: validatedItems, totalAmount };
        });
      },
    }),
    {
      name: "guest_cart", // localStorage key
      version: 1,
    }
  )
);

export default useGuestCartStore;
