import { create } from "zustand";
import { persist } from "zustand/middleware";
import { emitCartChanged, getCartItemKey } from "../utils/cartState";

/**
 * Guest Cart Store
 * Manages cart state for non-authenticated users
 * Data persisted to localStorage
 *
 * Structure:
 * [
 *   {
 *     productId: string,
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
      totalQuantity: 0,

      /**
       * Add item to guest cart
       * Prevents duplicates, updates quantity if exists
       */
      addItem: (item) => {
        set((state) => {
          const normalizedProductId = String(item.productId || "");
          const normalizedVariantId = String(item.variantId || "");
          const existingIdx = state.items.findIndex(
            (x) =>
              String(x.productId) === normalizedProductId &&
              String(x.variantId || "") === normalizedVariantId
          );

          let newItems;
          if (existingIdx >= 0) {
            // Item already exists - increase quantity
            newItems = [...state.items];
            newItems[existingIdx] = {
              ...newItems[existingIdx],
              quantity: (newItems[existingIdx].quantity || 0) + (item.quantity || 1),
              price: item.price,
              image: item.image || newItems[existingIdx].image,
              maxQuantity: item.maxQuantity ?? newItems[existingIdx].maxQuantity,
              availableStock: item.availableStock ?? newItems[existingIdx].availableStock,
              variantTitle: item.variantTitle || newItems[existingIdx].variantTitle,
              variantSku: item.variantSku || newItems[existingIdx].variantSku,
              variantAttributes: item.variantAttributes || newItems[existingIdx].variantAttributes,
            };
          } else {
            // New item
            newItems = [
              ...state.items,
              {
                ...item,
                productId: normalizedProductId,
                quantity: item.quantity || 1,
                variantId: normalizedVariantId,
                addedAt: Date.now(),
              },
            ];
          }

          // Compute total
          const totalAmount = newItems.reduce(
            (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
            0
          );
          const totalQuantity = newItems.reduce((sum, it) => sum + Number(it.quantity || 0), 0);

          emitCartChanged({ items: newItems, totalAmount, totalQuantity });
          return { items: newItems, totalAmount, totalQuantity };
        });
      },

      /**
       * Update item quantity
       */
      updateItem: (productId, variantId, quantity) => {
        set((state) => {
          const normalizedProductId = String(productId || "");
          const normalizedVariantId = String(variantId || "");
          const idx = state.items.findIndex(
            (x) =>
              String(x.productId) === normalizedProductId &&
              String(x.variantId || "") === normalizedVariantId
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
          const totalQuantity = newItems.reduce((sum, it) => sum + Number(it.quantity || 0), 0);

          emitCartChanged({ items: newItems, totalAmount, totalQuantity });
          return { items: newItems, totalAmount, totalQuantity };
        });
      },

      /**
       * Remove item from cart
       */
      removeItem: (productId, variantId) => {
        set((state) => {
          const normalizedProductId = String(productId || "");
          const normalizedVariantId = String(variantId || "");
          const newItems = state.items.filter(
            (x) =>
              !(
                String(x.productId) === normalizedProductId &&
                String(x.variantId || "") === normalizedVariantId
              )
          );

          const totalAmount = newItems.reduce(
            (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
            0
          );
          const totalQuantity = newItems.reduce((sum, it) => sum + Number(it.quantity || 0), 0);

          emitCartChanged({ items: newItems, totalAmount, totalQuantity });
          return { items: newItems, totalAmount, totalQuantity };
        });
      },

      /**
       * Clear entire cart
       */
      clearCart: () => {
        emitCartChanged({ items: [], totalAmount: 0, totalQuantity: 0 });
        set({ items: [], totalAmount: 0, totalQuantity: 0 });
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
        const totalQuantity = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
        emitCartChanged({ items, totalAmount, totalQuantity });
        set({ items, totalAmount, totalQuantity });
      },

      /**
       * Set items from validated cart (backend validation)
       * Updates prices from backend to prevent manipulation
       */
      setValidatedItems: (validatedItems) => {
        set(() => {
          const totalAmount = validatedItems.reduce(
            (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
            0
          );
          const totalQuantity = validatedItems.reduce(
            (sum, it) => sum + Number(it.quantity || 0),
            0
          );

          emitCartChanged({ items: validatedItems, totalAmount, totalQuantity });
          return { items: validatedItems, totalAmount, totalQuantity };
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
