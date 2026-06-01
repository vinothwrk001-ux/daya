import { mergeGuestData } from "../services/authService";
import { followPublicInfluencer } from "../services/influencerCommerceService";
import * as vendorService from "../services/vendorService";
import useGuestCartStore from "../context/guestCartStore";
import useGuestWishlistStore from "../context/guestWishlistStore";
import { consumeRedirectAfterLogin } from "./loginRedirect";
import pendingActionManager from "./pendingActionManager";
import pendingCheckoutManager from "./pendingCheckoutManager";
import useAuthCartStore from "../context/authCartStore";

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
    pathname === "/" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/user") ||
    pathname.startsWith("/vendor") ||
    pathname.startsWith("/seller") ||
    pathname.startsWith("/product/") ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/shop") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/wishlist") ||
    pathname.startsWith("/influencer/") ||
    pathname.startsWith("/addresses") ||
    pathname.startsWith("/reviews") ||
    pathname.startsWith("/support") ||
    pathname.startsWith("/notifications") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/cart") ||
    pathname.startsWith("/checkout")
  );
}

function isShopperRole(role) {
  return role === "user";
}

function clearPendingCheckoutState() {
  pendingActionManager.clearPendingAction();
  pendingCheckoutManager.clear();
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
        useAuthCartStore.getState().setCart(mergeResult.cartMerge.userCart || { items: [] });
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

  const redirect = consumeRedirectAfterLogin();
  const role = result.data.user.role;

  if (!isShopperRole(role)) {
    clearPendingCheckoutState();
  }

  const checkoutRedirect = pendingCheckout?.redirectAfterAuth || pendingCheckout?.redirectAfterLogin;
  if (isShopperRole(role) && checkoutRedirect === "/checkout") {
    return nav("/checkout", { replace: true });
  }

  if (isShopperRole(role) && (pendingAction?.type === "buy_now" || pendingAction?.type === "checkout")) {
    pendingActionManager.clearPendingAction();
    return nav("/checkout", { replace: true });
  }

  if (isShopperRole(role) && pendingAction?.type === "follow_creator" && pendingAction?.data?.username) {
    try {
      await followPublicInfluencer(pendingAction.data.username);
    } catch {
      // The storefront will still reload and show the current relationship state.
    }
    pendingActionManager.clearPendingAction();
    return nav(`/influencer/${pendingAction.data.username}/storefront`, { replace: true });
  }

  if (redirect && isAllowedPrimaryTarget(redirect)) {
    if (isShopperRole(role) || !getPathnameFromTarget(redirect).startsWith("/checkout")) {
      return nav(redirect, { replace: true });
    }
  }

  if (attemptedFrom && isAllowedPrimaryTarget(attemptedFrom)) {
    if (isShopperRole(role) || !getPathnameFromTarget(attemptedFrom).startsWith("/checkout")) {
      return nav(attemptedFrom, { replace: true });
    }
  }

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
