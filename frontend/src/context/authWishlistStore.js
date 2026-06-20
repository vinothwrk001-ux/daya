import { create } from "zustand";

const useAuthWishlistStore = create((set) => ({
  items: [],
  setItems: (items) => set({ items: Array.isArray(items) ? items : [] }),
  clear: () => set({ items: [] }),
}));

export default useAuthWishlistStore;
