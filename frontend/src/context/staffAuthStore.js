import { create } from "zustand";

const STORAGE_KEY = "grm_staff_auth";

function load() {
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
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        user: state.user,
      })
    );
  } catch {
    // ignore localStorage errors
  }
}

const initial = load() || { token: null, refreshToken: null, user: null };

export const useStaffAuthStore = create((set, get) => ({
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
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },

  setUser: (user) => {
    const nextState = { ...get(), user: user || null, isAuthenticated: Boolean(get().token) };
    set(nextState);
    save(nextState);
  },

  getToken: () => get().token,
}));
