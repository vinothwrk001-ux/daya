import { Link } from "react-router-dom";
import { Heart, ShoppingCart } from "lucide-react";
import { useAuthStore } from "../context/authStore";
import useAuthCartStore from "../context/authCartStore";
import useAuthWishlistStore from "../context/authWishlistStore";
import useGuestCartStore from "../context/guestCartStore";
import useGuestWishlistStore from "../context/guestWishlistStore";
import { getCartTotalQuantity } from "../utils/cartState";

export function HeaderIconLink({ to, label, badge, children, className = "", variant = "icon" }) {
  if (variant === "inline") {
    return (
      <Link
        to={to}
        aria-label={label}
        className={`flex items-center gap-2 transition ${className}`}
      >
        <span className="relative inline-flex">
          {children}
          {badge ? (
            <span className="absolute -right-2 -top-1.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-white dark:ring-slate-950">
              {badge > 99 ? "99+" : badge}
            </span>
          ) : null}
        </span>
        <span className="hidden text-xs font-medium sm:inline sm:text-sm">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      to={to}
      aria-label={label}
      className={`enterprise-icon-button relative inline-flex h-11 w-11 items-center justify-center rounded-full backdrop-blur transition hover:-translate-y-0.5 active:scale-95 ${className}`}
    >
      {children}
      {badge ? (
        <span className="absolute right-1 top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-white dark:ring-slate-950">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

export function HeaderShopActions({ className = "", variant = "icon" }) {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guestCartItems = useGuestCartStore((state) => state.items);
  const guestCartTotalQuantity = useGuestCartStore((state) => state.totalQuantity);
  const authCartItems = useAuthCartStore((state) => state.cart.items);
  const authCartTotalQuantity = useAuthCartStore((state) => state.cart.totalQuantity);
  const guestWishlistCount = useGuestWishlistStore((state) => state.items.length);
  const guestCartCount = Math.max(
    Number(guestCartTotalQuantity || 0),
    getCartTotalQuantity(guestCartItems)
  );
  const authCartCount = Math.max(
    Number(authCartTotalQuantity || 0),
    getCartTotalQuantity(authCartItems)
  );
  const authWishlistCount = useAuthWishlistStore((state) => state.items.length);
  const showShopActions = !user || user?.role === "user";

  const cartCount = isAuthenticated || user?.role === "user" ? authCartCount : guestCartCount;
  const wishlistCount = isAuthenticated ? authWishlistCount : guestWishlistCount;

  if (!showShopActions) {
    return null;
  }

  const iconClassName = variant === "inline" ? "h-5 w-5 sm:h-6 sm:w-6" : "h-5 w-5 sm:h-6 sm:w-6 text-slate-700 dark:text-slate-300";

  return (
    <div className={`flex items-center gap-2 sm:gap-3 ${className}`}>
      <HeaderIconLink to="/wishlist" label="Wishlist" badge={wishlistCount || undefined} variant={variant}>
        <Heart className={iconClassName} />
      </HeaderIconLink>
      <HeaderIconLink to="/cart" label="Cart" badge={cartCount || undefined} variant={variant}>
        <ShoppingCart className={iconClassName} />
      </HeaderIconLink>
    </div>
  );
}
