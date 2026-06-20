import { Link } from "react-router-dom";
import { Heart, ShoppingCart } from "lucide-react";
import { useAuthStore } from "../context/authStore";
import useAuthCartStore from "../context/authCartStore";
import useAuthWishlistStore from "../context/authWishlistStore";
import useGuestCartStore from "../context/guestCartStore";
import useGuestWishlistStore from "../context/guestWishlistStore";

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
            <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-brand-primary px-1 text-[10px] font-semibold text-white">
              {badge}
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
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand-primary px-1 text-[10px] font-semibold text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export function HeaderShopActions({ className = "", variant = "icon" }) {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guestCartCount = useGuestCartStore((state) => state.getTotalQuantity());
  const guestWishlistCount = useGuestWishlistStore((state) => state.getItemCount());
  const authCartCount = useAuthCartStore((state) => state.cart.totalQuantity || 0);
  const authWishlistCount = useAuthWishlistStore((state) => state.items.length);
  const showShopActions = !user || user?.role === "user";

  const cartCount = isAuthenticated ? authCartCount : guestCartCount;
  const wishlistCount = isAuthenticated ? authWishlistCount : guestWishlistCount;

  if (!showShopActions) {
    return null;
  }

  const iconClassName = variant === "inline" ? "h-5 w-5 sm:h-6 sm:w-6" : "h-4.5 w-4.5";

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
