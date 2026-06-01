import { create } from "zustand";
import { resetDarkModePreference } from "../hooks/useDarkMode";
import useAuthCartStore from "./authCartStore";

const STORAGE_KEY = "amazon_like_auth";

function load() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { token: null, refreshToken: null, user: parsed.user || null };
  } catch {
    return null;
  }
}

function save(state) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        user: state.user,
      })
    );
  } catch {
    // ignore
  }
}

const initial = load() || { token: null, refreshToken: null, user: null };

export const useAuthStore = create((set, get) => ({
  token: initial.token,
  refreshToken: initial.refreshToken,
  user: initial.user,
  isAuthenticated: Boolean(initial.token),
  
  setAuth: ({ token, accessToken, refreshToken, user }) => {
    const nextToken = accessToken || token;
    const nextState = {
      token: nextToken || null,
      refreshToken: refreshToken || null,
      user: user || null,
      isAuthenticated: Boolean(nextToken),
    };
    set(nextState);
    save(nextState);
  },
  
  logout: () => {
    set({ token: null, refreshToken: null, user: null, isAuthenticated: false });
    useAuthCartStore.getState().clearCart();
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    resetDarkModePreference();
  },

  setUser: (user) => {
    const nextState = { ...get(), user: user || null, isAuthenticated: Boolean(get().token) };
    set(nextState);
    save(nextState);
  },
  
  getToken: () => get().token,
}));
