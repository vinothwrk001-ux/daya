import useAuthCartStore from "../context/authCartStore";
import { useAuthStore } from "../context/authStore";
import { normalizeCartPayload } from "./cartState";
import { isCurrentCartStateVersion } from "./cartStateVersion";

let initialized = false;

/**
 * Keeps the auth cart store in sync with cart mutations emitted globally.
 * Ensures header badges and other store subscribers update immediately.
 */
export function initializeCartSync() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  window.addEventListener("cart:changed", (event) => {
    const { user, isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated && user?.role !== "user") return;

    const mutationVersion = event.detail?.cartStateVersion;
    if (mutationVersion == null) {
      return;
    }
    if (!isCurrentCartStateVersion(mutationVersion)) {
      return;
    }

    const nextCart = normalizeCartPayload(event.detail || {});
    useAuthCartStore.getState().setCart(nextCart);
  });
}
