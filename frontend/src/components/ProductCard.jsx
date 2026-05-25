import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import { Heart, ShoppingCart, Star } from "lucide-react";
import { formatCurrency } from "../utils/formatCurrency";
import { resolveApiAssetUrl } from "../utils/resolveUrl";
import { useCart } from "../hooks/useCart";
import { useCartDrawer } from "../hooks/useCartDrawer";
import { useWishlist } from "../hooks/useWishlist";
import { getCartErrorMessage } from "../utils/cartErrors";
import { extractProductId, getAvailableProductVariant } from "../utils/cartState";

export function ProductCard({ product, cardStyle = "DEFAULT", imageAspectClass = "aspect-[4/5]", onProductClick }) {
  const navigate = useNavigate();
  const { cart, addItem: addCartItem } = useCart();
  const { openDrawer, showToast } = useCartDrawer();
  const { addItem: addWishlistItem, removeItem: removeWishlistItem, isInWishlist: checkWishlistStatus } = useWishlist();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const imageUrl = resolveApiAssetUrl(product?.images?.[0]?.url || "");

  const { selectedVariant, hasAvailableVariants, availableStock } = useMemo(
    () => getAvailableProductVariant(product, cart?.items),
    [cart?.items, product]
  );

  const discountPercent = product?.discountPrice
    ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
    : 0;

  useEffect(() => {
    let active = true;

    async function resolveWishlistStatus() {
      try {
        const status = await checkWishlistStatus(product._id);
        if (active) {
          setIsInWishlist(Boolean(status));
        }
      } catch (err) {
        if (active) {
          setIsInWishlist(false);
        }
      }
    }

    if (product?._id) {
      resolveWishlistStatus();
    }

    return () => {
      active = false;
    };
  }, [product?._id, checkWishlistStatus]);

  const handleWishlist = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      if (isInWishlist) {
        await removeWishlistItem(product._id);
        setIsInWishlist(false);
      } else {
        await addWishlistItem(product._id, selectedVariant?.variantId || "");
        setIsInWishlist(true);
      }
    } catch (err) {
      console.error("Failed to update wishlist:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddToCart = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isSubmitting || !hasAvailableVariants || availableStock <= 0) return;

    try {
      setIsSubmitting(true);
      const { selectedVariant: nextSelectedVariant } = getAvailableProductVariant(product, cart?.items);
      const variantId = nextSelectedVariant?.variantId || "";
      const added = await addCartItem(product._id, 1, variantId);
      if (added) {
        openDrawer(product, nextSelectedVariant || added?.variant || added || null, added?.quantity || 1);
      }
    } catch (err) {
      console.error("Failed to add to cart:", err);
      showToast(getCartErrorMessage(err, "Failed to add item to cart."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const styleKey = String(cardStyle || "DEFAULT").toUpperCase();
  const isEditorial = styleKey === "EDITORIAL";
  const cardStyleClass = {
    DEFAULT: "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm hover:shadow-lg dark:hover:shadow-lg dark:hover:shadow-slate-950/50 hover:border-blue-300 dark:hover:border-blue-600",
    ELEVATED: "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl hover:shadow-[0_30px_90px_-45px_rgba(15,23,42,0.35)]",
    MINIMAL: "border border-slate-200/50 dark:border-slate-700/50 bg-white/95 dark:bg-slate-950/80 shadow-none hover:shadow-sm",
    EDITORIAL: "rounded-[2rem] border border-slate-900 bg-slate-950 text-white shadow-2xl ring-1 ring-slate-900/10",
  }[styleKey] || "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm hover:shadow-lg dark:hover:shadow-lg dark:hover:shadow-slate-950/50 transition-all duration-300 hover:border-blue-300 dark:hover:border-blue-600";
  const categoryTextClass = isEditorial
    ? "text-[11px] font-semibold uppercase tracking-wide text-slate-300 line-clamp-1"
    : "text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 line-clamp-1";
  const titleTextClass = isEditorial
    ? "line-clamp-2 text-sm font-semibold text-white transition group-hover:text-slate-100 leading-tight"
    : "line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white transition group-hover:text-blue-600 dark:group-hover:text-blue-400 leading-tight";
  const ratingTextClass = isEditorial
    ? "text-xs font-semibold text-slate-100"
    : "text-xs font-semibold text-slate-600 dark:text-slate-400";
  const priceCurrentClass = isEditorial
    ? "text-sm font-bold text-white"
    : "text-sm font-bold text-slate-900 dark:text-white";
  const priceOriginalClass = isEditorial
    ? "text-xs text-slate-400 line-through"
    : "text-xs text-slate-500 dark:text-slate-400 line-through";
  const stockClass = isEditorial ? "text-emerald-300" : "text-green-600 dark:text-green-400";
  const stockOutClass = isEditorial ? "text-rose-300" : "text-red-600 dark:text-red-400";
  const navigateToProduct = () => {
    onProductClick?.(product);
    navigate(`/product/${product._id}`);
  };

  return (
    <Motion.article
      whileHover={{ y: -8 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      onClick={navigateToProduct}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigateToProduct();
        }
      }}
      role="link"
      tabIndex={0}
      className={`group relative flex flex-col h-full overflow-hidden rounded-2xl transition-all duration-300 ${cardStyleClass}`}
    >
      <div className={`relative w-full ${imageAspectClass} bg-gradient-to-br from-slate-100 to-white dark:from-slate-900 dark:to-slate-800 overflow-hidden flex-shrink-0`}>
        {/* Product Image */}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Image coming soon
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 via-transparent to-white/5 opacity-40 transition duration-500 group-hover:opacity-60" />

        {/* Discount Badge */}
        {discountPercent > 0 && (
          <div className="absolute top-3 left-3 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 px-2.5 py-1.5 shadow-lg">
            <div className="text-xs font-bold text-white">{discountPercent}%</div>
            <div className="text-[10px] font-semibold text-white">OFF</div>
          </div>
        )}

        {/* Premium Vertical Action Stack - Top Right */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 ease-out z-10">
          {/* Wishlist Button */}
          <button
            onClick={handleWishlist}
            disabled={isSubmitting}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-200 disabled:opacity-60"
            title={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
            aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart
              size={20}
              strokeWidth={1.5}
              className={`transition-all duration-300 ${
                isInWishlist
                  ? "fill-red-500 text-red-500"
                  : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            />
          </button>

          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            disabled={isSubmitting || !hasAvailableVariants || availableStock <= 0}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            title={hasAvailableVariants ? `Add ${selectedVariant?.title || "item"} to cart` : "Out of stock"}
            aria-label={hasAvailableVariants ? `Add ${selectedVariant?.title || "item"} to cart` : "Out of stock"}
          >
            <ShoppingCart size={20} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Product Info Section */}
      <div className="flex flex-col flex-grow p-4 gap-2">
        {/* Category */}
        <p className={categoryTextClass}>{product.category || "Featured"}</p>

        {/* Product Name */}
        <h3 className={titleTextClass}>{product.name}</h3>

        {/* Spacer */}
        <div className="flex-grow" />

        {/* Rating */}
        {product?.ratings?.averageRating > 0 ? (
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            <span className={ratingTextClass}>
              {Number(product.ratings.averageRating).toFixed(1)}
            </span>
          </div>
        ) : null}

        {/* Pricing */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={priceCurrentClass}>
              {formatCurrency(product.discountPrice || product.price)}
            </span>
            {product.discountPrice && (
              <span className={priceOriginalClass}>
                {formatCurrency(product.price)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Motion.article>
  );
}
