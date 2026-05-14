import { mergeGuestData } from "../services/authService";
import * as vendorService from "../services/vendorService";
import useGuestCartStore from "../context/guestCartStore";
import useGuestWishlistStore from "../context/guestWishlistStore";
import { consumeRedirectAfterLogin } from "./loginRedirect";
import pendingActionManager from "./pendingActionManager";
import pendingCheckoutManager from "./pendingCheckoutManager";

function getPathnameFromTarget(target) {
  if (!target) return "";

  if (target.startsWith("http://") || target.startsWith("https://")) {
    try {
      return new URL(target).pathname;
    } catch {
      return "";
    }
  }

  return target;
}

function isAuthPageTarget(target) {
  const pathname = getPathnameFromTarget(target);
  return ["/login", "/register", "/role", "/staff/login"].includes(pathname);
}

function isAllowedPrimaryTarget(target) {
  const pathname = getPathnameFromTarget(target);
  if (!pathname || isAuthPageTarget(pathname)) return false;

  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/user") ||
    pathname.startsWith("/vendor") ||
    pathname.startsWith("/seller") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/wishlist") ||
    pathname.startsWith("/addresses") ||
    pathname.startsWith("/reviews") ||
    pathname.startsWith("/support") ||
    pathname.startsWith("/notifications") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/cart") ||
    pathname.startsWith("/checkout")
  );
}

export async function continueAfterPrimaryAuth({ result, attemptedFrom, nav }) {
  const guestCartItems = useGuestCartStore.getState().items;
  const guestWishlistItems = useGuestWishlistStore.getState().items;
  const pendingAction = pendingActionManager.getPendingAction();
  const pendingCheckout = pendingCheckoutManager.get();

  if (guestCartItems.length || guestWishlistItems.length) {
    try {
      const mergeResult = await mergeGuestData(guestCartItems, guestWishlistItems);

      if (mergeResult?.cartMerge?.success) {
        useGuestCartStore.getState().clearCart();
        window.dispatchEvent(
          new CustomEvent("cart:changed", {
            detail: mergeResult.cartMerge.userCart || { items: [] },
          })
        );
      }

      if (mergeResult?.wishlistMerge?.success) {
        useGuestWishlistStore.getState().clearWishlist();
        window.dispatchEvent(
          new CustomEvent("wishlist:changed", {
            detail: { items: mergeResult.wishlistMerge.userWishlist || [] },
          })
        );
      }
    } catch {
      // Keep guest data intact so users can retry merge safely later.
    }
  }

  const checkoutRedirect = pendingCheckout?.redirectAfterAuth || pendingCheckout?.redirectAfterLogin;
  if (checkoutRedirect === "/checkout") {
    return nav("/checkout", { replace: true });
  }

  if (pendingAction?.type === "buy_now" || pendingAction?.type === "checkout") {
    pendingActionManager.clearPendingAction();
    return nav("/checkout", { replace: true });
  }

  const redirect = consumeRedirectAfterLogin();
  const role = result.data.user.role;
  if (redirect && isAllowedPrimaryTarget(redirect)) return window.location.assign(redirect);
  if (attemptedFrom && isAllowedPrimaryTarget(attemptedFrom)) return nav(attemptedFrom, { replace: true });

  if (["admin", "super_admin", "support_admin", "finance_admin"].includes(role)) {
    return nav("/dashboard/admin", { replace: true });
  }
  if (role === "user") return nav("/", { replace: true });
  if (role === "influencer") return nav("/influencer/dashboard", { replace: true });

  try {
    const vendorResponse = await vendorService.getVendorMe();
    const status = vendorResponse.data.status;
    if (status === "approved") return nav("/dashboard/vendor", { replace: true });
    if (status === "pending") return nav("/vendor/status", { replace: true });
    return nav("/vendor/onboarding", { replace: true });
  } catch {
    return nav("/vendor/onboarding", { replace: true });
  }
}
