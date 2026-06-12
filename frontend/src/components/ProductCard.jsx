import { logger } from "../services/logger/logger.js";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import { Eye, Heart, ShoppingCart, Star } from "lucide-react";
import { formatCurrency } from "../utils/formatCurrency";
import { resolveApiAssetUrl } from "../utils/resolveUrl";
import { useCart } from "../hooks/useCart";
import { useCartDrawer } from "../hooks/useCartDrawer";
import { useWishlist } from "../hooks/useWishlist";
import { getCartErrorMessage } from "../utils/cartErrors";
import { extractProductId, getAvailableProductVariant } from "../utils/cartState";

function reportProductCardError(message, details = {}) {
  const payload = {
    component: "ProductCard",
    message,
    productId: details.productId || "",
    errorMessage: details.error?.message || String(details.error || ""),
    stack: details.error?.stack,
  };

  if (import.meta.env.DEV) {
    logger.error("frontend_error", { error: message, payload });
    return;
  }

  window.dispatchEvent(new CustomEvent("app:error", { detail: payload }));
}

const FALLBACK_SWATCHES = ["#111111", "#E53935", "#6B7280"];

function getProductBrand(product) {
  return product?.brand || product?.vendorName || product?.sellerName || product?.category || "Daya";
}

function getProductSwatches(product) {
  const candidates = [
    product?.colors,
    product?.availableColors,
    product?.colorOptions,
    product?.variants?.map((variant) => variant.color || variant.colorName || variant.attributes?.color),
  ];

  const values = candidates
    .flat()
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean);

  const unique = [...new Set(values)].slice(0, 5);
  return unique.length ? unique : FALLBACK_SWATCHES;
}

function swatchClass(value) {
  const normalized = String(value).trim().toLowerCase();
  const classes = {
    "#111111": "bg-[#111111]",
    "#e53935": "bg-[#E53935]",
    "#6b7280": "bg-[#6B7280]",
    black: "bg-[#111111]",
    red: "bg-[#E53935]",
    green: "bg-[#16A34A]",
    blue: "bg-[#2563EB]",
    gray: "bg-[#9CA3AF]",
    grey: "bg-[#9CA3AF]",
    white: "bg-white",
    maroon: "bg-[#7F1D1D]",
  };

  return classes[normalized] || "bg-[#9CA3AF]";
}

export function PremiumProductCard({ product, cardStyle = "DEFAULT", imageAspectClass = "aspect-[4/5]", onProductClick }) {
  const navigate = useNavigate();
  const { cart, addItem: addCartItem } = useCart();
  const { openDrawer, showToast } = useCartDrawer();
  const { addItem: addWishlistItem, removeItem: removeWishlistItem, isInWishlist: checkWishlistStatus } = useWishlist();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const productId = useMemo(() => extractProductId(product), [product]);
  const imageUrl = resolveApiAssetUrl(product?.images?.[0]?.url || "");

  const { selectedVariant, hasAvailableVariants, availableStock } = useMemo(
    () => getAvailableProductVariant(product, cart?.items),
    [cart?.items, product]
  );

  const salePrice = product?.discountPrice || product?.discountedPrice || null;
  const discountPercent = salePrice && product?.price
    ? Math.round(((product.price - salePrice) / product.price) * 100)
    : 0;
  const brandName = getProductBrand(product);
  const swatches = getProductSwatches(product);

  useEffect(() => {
    let active = true;

    async function resolveWishlistStatus() {
      try {
        const status = await checkWishlistStatus(productId);
        if (active) {
          setIsInWishlist(Boolean(status));
        }
      } catch (err) {
        reportProductCardError("Failed to resolve wishlist status.", { productId, error: err });
        if (active) {
          setIsInWishlist(false);
        }
      }
    }

    if (productId) {
      resolveWishlistStatus();
    }

    return () => {
      active = false;
    };
  }, [productId, checkWishlistStatus]);

  const handleWishlist = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      if (isInWishlist) {
        await removeWishlistItem(productId);
        setIsInWishlist(false);
      } else {
        await addWishlistItem(productId, selectedVariant?.variantId || "");
        setIsInWishlist(true);
      }
    } catch (err) {
      reportProductCardError("Failed to update wishlist.", { productId, error: err });
      showToast(getCartErrorMessage(err, "Unable to update wishlist."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddToCart = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isSubmitting || !productId || !hasAvailableVariants || availableStock <= 0) return;

    try {
      setIsSubmitting(true);
      const { selectedVariant: nextSelectedVariant } = getAvailableProductVariant(product, cart?.items);
      const variantId = nextSelectedVariant?.variantId || "";
      const added = await addCartItem(productId, 1, variantId);
      if (added) {
        openDrawer(product, nextSelectedVariant || added?.variant || added || null, added?.quantity || 1);
      }
    } catch (err) {
      reportProductCardError("Failed to add product to cart.", { productId, error: err });
      showToast(getCartErrorMessage(err, "Failed to add item to cart."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const styleKey = String(cardStyle || "DEFAULT").toUpperCase();
  const isEditorial = styleKey === "EDITORIAL";
  const cardStyleClass = {
    DEFAULT: "border border-[#eeeeee] bg-white shadow-brandSm hover:shadow-brandMd hover:border-brand-primary",
    ELEVATED: "border border-[#eeeeee] bg-white shadow-brandLg hover:shadow-brandMd",
    MINIMAL: "border border-[#eeeeee] bg-white shadow-none hover:shadow-brandSm",
    EDITORIAL: "border border-brand-secondary bg-brand-secondary text-white shadow-brandLg ring-1 ring-black/10",
  }[styleKey] || "border border-[#eeeeee] bg-white shadow-brandSm hover:shadow-brandMd transition-all duration-300 hover:border-brand-primary";
  const brandTextClass = isEditorial
    ? "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300 line-clamp-1"
    : "text-[11px] font-semibold uppercase tracking-[0.14em] text-[#777777] line-clamp-1";
  const titleTextClass = isEditorial
    ? "line-clamp-2 text-base font-semibold text-white transition group-hover:text-slate-100 leading-snug"
    : "line-clamp-2 text-base font-semibold text-[#111111] transition group-hover:text-brand-primary leading-snug";
  const ratingTextClass = isEditorial
    ? "text-xs font-semibold text-slate-100"
    : "text-xs font-semibold text-slate-600 dark:text-slate-400";
  const priceCurrentClass = isEditorial
    ? "text-base font-bold text-white"
    : "text-base font-bold text-brand-primary";
  const priceOriginalClass = isEditorial
    ? "text-xs text-slate-400 line-through"
    : "text-sm text-[#999999] line-through";
  const stockClass = isEditorial ? "text-emerald-300" : "text-green-600 dark:text-green-400";
  const stockOutClass = isEditorial ? "text-rose-300" : "text-red-600 dark:text-red-400";
  const inStock = hasAvailableVariants && availableStock > 0;
  const navigateToProduct = () => {
    if (!productId) return;
    onProductClick?.(product);
    navigate(`/product/${productId}`);
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
      className={`enterprise-card group relative mx-auto flex h-full w-full max-w-[320px] flex-col overflow-hidden rounded-brandLg p-4 transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 ${cardStyleClass}`}
    >
      <div className={`relative h-[320px] w-full ${imageAspectClass} flex-shrink-0 overflow-hidden rounded-brandMd bg-gradient-to-br from-brand-surfaceSecondary to-white`}>
        {/* Product Image */}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product?.name || "Product image"}
            className="h-full w-full object-cover object-center transition duration-300 ease-out group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Image coming soon
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />

        {/* Discount Badge */}
        {discountPercent > 0 && (
          <div className="absolute left-3 top-3 rounded-full bg-brand-primary px-3 py-1.5 shadow-lg">
            <div className="text-xs font-bold leading-none text-white">{discountPercent}% OFF</div>
          </div>
        )}

        <div className="absolute right-3 top-3 z-10 flex flex-col gap-2 translate-y-2 opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
          <button
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              navigateToProduct();
            }}
            className="enterprise-icon-button flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-sm hover:scale-110 active:scale-95 disabled:opacity-60"
            title="View product"
            aria-label="View product"
          >
            <Eye size={18} strokeWidth={1.8} />
          </button>
          <button
            onClick={handleWishlist}
            disabled={isSubmitting}
            className="enterprise-icon-button flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-sm hover:scale-110 active:scale-95 disabled:opacity-60"
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

          <button
            onClick={handleAddToCart}
            disabled={isSubmitting || !productId || !inStock}
            className="enterprise-primary-button flex h-10 w-10 items-center justify-center rounded-full shadow-lg hover:scale-110 hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            title={inStock ? `Add ${selectedVariant?.title || "item"} to cart` : "Out of stock"}
            aria-label={inStock ? `Add ${selectedVariant?.title || "item"} to cart` : "Out of stock"}
          >
            <ShoppingCart size={20} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="flex flex-grow flex-col gap-3 pt-4">
        <p className={brandTextClass}>{brandName}</p>

        <h3 className={titleTextClass}>{product.name}</h3>

        <div className="flex-grow" />

        {product?.ratings?.averageRating > 0 ? (
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            <span className={ratingTextClass}>
              {Number(product.ratings.averageRating).toFixed(1)}
            </span>
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={priceCurrentClass}>
              {formatCurrency(salePrice || product.price)}
            </span>
            {salePrice && (
              <span className={priceOriginalClass}>
                {formatCurrency(product.price)}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5" aria-label="Available colors">
              {swatches.map((color, index) => (
                <span
                  key={`${color}-${index}`}
                  className={`h-3.5 w-3.5 rounded-full border border-black/10 ring-1 ring-white ${swatchClass(color)}`}
                  title={String(color)}
                />
              ))}
            </div>
            <div className={`text-xs font-semibold ${inStock ? stockClass : stockOutClass}`}>
              {inStock ? "In stock" : "Out of stock"}
            </div>
          </div>
        </div>
      </div>
    </Motion.article>
  );
}

export { PremiumProductCard as ProductCard };
