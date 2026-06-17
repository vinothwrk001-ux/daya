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
  authReady: false,

  setAuth: ({ user }) => {
    const nextState = {
      user: user || null,
      isAuthenticated: Boolean(user),
      authReady: true,
    };
    set(nextState);
    clearLegacyAuthStorage();
  },

  setAuthReady: (ready = true) => {
    set({ authReady: ready });
  },
  
  logout: () => {
    set({ user: null, isAuthenticated: false, authReady: true });
    useAuthCartStore.getState().clearCart();
    clearLegacyAuthStorage();
    resetDarkModePreference();
  },

  setUser: (user) => {
    const nextState = { ...get(), user: user || null, isAuthenticated: Boolean(user), authReady: true };
    set(nextState);
    clearLegacyAuthStorage();
  },
}));
