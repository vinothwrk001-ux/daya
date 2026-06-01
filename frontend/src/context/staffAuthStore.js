import { create } from "zustand";

const STORAGE_KEY = "grm_staff_auth";

function clearLegacyStaffAuthStorage() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

clearLegacyStaffAuthStorage();

export const useStaffAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,

  setAuth: ({ user }) => {
    const nextState = {
      user: user || null,
      isAuthenticated: Boolean(user),
    };
    set(nextState);
    clearLegacyStaffAuthStorage();
  },

  logout: () => {
    set({ user: null, isAuthenticated: false });
    clearLegacyStaffAuthStorage();
  },

  setUser: (user) => {
    const nextState = { ...get(), user: user || null, isAuthenticated: Boolean(user) };
    set(nextState);
    clearLegacyStaffAuthStorage();
  },
}));
