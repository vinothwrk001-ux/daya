import { api } from "./api";

export async function register({ name, email, phone, password, role }) {
  const { data } = await api.post("/api/auth/register", {
    name,
    email,
    phone,
    password,
    role,
  });
  return data;
}

export async function login({ identifier, password }) {
  const { data } = await api.post("/api/auth/login", {
    identifier,
    password,
  });
  return data;
}

export async function getMe() {
  const { data } = await api.get("/api/auth/me");
  return data;
}

export async function logout(refreshToken) {
  const { data } = await api.post("/api/auth/logout", { refreshToken });
  return data;
}

export async function logoutAll() {
  const { data } = await api.post("/api/auth/logout-all");
  return data;
}

export async function updateThemePreference(theme) {
  const { data } = await api.patch("/api/auth/preferences/theme", { theme });
  return data;
}

/**
 * POST-LOGIN MERGE
 * Merge guest cart and wishlist data after successful login
 * @param {Array} guestCartItems - Cart items from localStorage
 * @param {Array} guestWishlistItems - Wishlist items from localStorage
 * @returns {Promise<Object>} {cartMerge, wishlistMerge}
 */
export async function mergeGuestData(guestCartItems = [], guestWishlistItems = []) {
  const { data } = await api.post("/api/auth/merge-guest-data", {
    guestCartItems,
    guestWishlistItems,
  });
  return data?.data || data;
}

