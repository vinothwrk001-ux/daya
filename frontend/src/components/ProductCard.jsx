import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import { Eye, Heart, ShoppingBag, Star } from "lucide-react";
import { useAuthStore } from "../context/authStore";
import * as cartService from "../services/cartService";
import * as wishlistService from "../services/wishlistService";
import { formatCurrency } from "../utils/formatCurrency";
import { resolveApiAssetUrl } from "../utils/resolveUrl";

export function ProductCard({ product }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [ripples, setRipples] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const imageUrl = resolveApiAssetUrl(product?.images?.[0]?.url || "");
  const discountPercent = product?.discountPrice
    ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
    : 0;

  const createRipple = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = {
      id: Date.now() + Math.random(),
      x: event.clientX - rect.left - size / 2,
      y: event.clientY - rect.top - size / 2,
      size,
    };
    setRipples((current) => [...current, ripple]);
    window.setTimeout(() => {
      setRipples((current) => current.filter((item) => item.id !== ripple.id));
    }, 650);
  };

  const requireUser = () => {
    if (user?.role === "user") {
      return true;
    }

    navigate("/login");
    return false;
  };

  const handleWishlist = async (event) => {
    event.stopPropagation();
    if (!requireUser()) return;

    try {
      setIsSubmitting(true);
      await wishlistService.addToWishlist(product._id);
      // Dispatch event to update wishlist badge
      const wishlistData = await wishlistService.getWishlist();
      window.dispatchEvent(new CustomEvent("wishlist:changed", { detail: { items: wishlistData || [] } }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddToCart = async (event) => {
    event.stopPropagation();
    createRipple(event);
    if (!requireUser()) return;

    try {
      setIsSubmitting(true);
      await cartService.addToCart(product._id, 1);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Motion.article
      whileHover={{ y: -8 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      onClick={() => navigate(`/product/${product._id}`)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate(`/product/${product._id}`);
        }
      }}
      role="link"
      tabIndex={0}
      className="group relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/85 shadow-[0_24px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/80"
    >
      <div className="block">
        <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-slate-100 to-white dark:from-slate-900 dark:to-slate-800">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="h-full w-full object-cover object-center transition duration-700 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Image coming soon
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/30 via-transparent to-white/10 opacity-60 transition duration-500 group-hover:opacity-80" />

          <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
            {discountPercent > 0 ? (
              <div className="opacity-0 transition duration-300 group-hover:opacity-100">
                <div className="rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-4 py-2 text-center shadow-lg shadow-orange-500/30">
                  <div className="text-lg font-black text-white">{discountPercent}%</div>
                  <div className="text-xs font-semibold text-white">OFF</div>
                </div>
              </div>
            ) : null}
            {product?.ratings?.averageRating > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-800 backdrop-blur">
                <Star className="h-3.5 w-3.5 fill-current text-amber-500" />
                {Number(product.ratings.averageRating).toFixed(1)}
              </span>
            ) : null}
          </div>

          <div className="absolute inset-x-4 bottom-4 translate-y-5 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <div className="flex items-center justify-between gap-2 rounded-full border border-white/50 bg-white/80 p-2 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-slate-950/75">
              <QuickAction icon={Heart} label="Save" onClick={handleWishlist} disabled={isSubmitting || product?.stock <= 0} />
              <QuickAction icon={Eye} label="Preview" onClick={(event) => {
                event.stopPropagation();
                navigate(`/product/${product._id}`);
              }} />
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isSubmitting}
                className="relative inline-flex min-w-[6.75rem] items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-indigo-500/45 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ripples.map((ripple) => (
                  <span
                    key={ripple.id}
                    className="pointer-events-none absolute rounded-full bg-white/35 animate-ripple"
                    style={{
                      left: ripple.x,
                      top: ripple.y,
                      width: ripple.size,
                      height: ripple.size,
                    }}
                  />
                ))}
                <span className="relative z-[1] inline-flex items-center gap-2">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  {isSubmitting ? "Adding" : "Add"}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
              {product.category || "Featured"}
            </p>
            <h3 className="mt-2 line-clamp-2 text-base font-semibold tracking-[-0.02em] text-slate-900 transition group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
              {product.name}
            </h3>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                {formatCurrency(product.discountPrice || product.price)}
              </div>
              {product.discountPrice ? (
                <div className="mt-1 text-sm text-slate-400 line-through dark:text-slate-500">
                  {formatCurrency(product.price)}
                </div>
              ) : (
                <div className="mt-1 text-sm text-slate-400 dark:text-slate-500">Best value pick</div>
              )}
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              Ready to ship
            </div>
          </div>
        </div>
      </div>
    </Motion.article>
  );
}

function QuickAction(props) {
  const IconComponent = props.icon;
  const { label, onClick, disabled } = props;

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-400/40 dark:hover:text-indigo-300"
    >
      <IconComponent className="h-4 w-4" />
    </button>
  );
}
