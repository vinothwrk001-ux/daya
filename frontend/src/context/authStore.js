import { create } from "zustand";
import { resetDarkModePreference } from "../hooks/useDarkMode";
import useAuthCartStore from "./authCartStore";

const STORAGE_KEY = "amazon_like_auth";

function clearLegacyAuthStorage() {
  if (typeof window === "undefined") return null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

clearLegacyAuthStorage();

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  
  setAuth: ({ user }) => {
    const nextState = {
      user: user || null,
      isAuthenticated: Boolean(user),
    };
    set(nextState);
    clearLegacyAuthStorage();
  },
  
  logout: () => {
    set({ user: null, isAuthenticated: false });
    useAuthCartStore.getState().clearCart();
    clearLegacyAuthStorage();
    resetDarkModePreference();
  },

  setUser: (user) => {
    const nextState = { ...get(), user: user || null, isAuthenticated: Boolean(user) };
    set(nextState);
    clearLegacyAuthStorage();
  },
}));
