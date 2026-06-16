import { logger } from "../services/logger/logger.js";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import { Eye, Heart, ShoppingCart, Star } from "lucide-react";
import { formatCurrency } from "../utils/formatCurrency";
import { useCart } from "../hooks/useCart";
import { useCartDrawer } from "../hooks/useCartDrawer";
import { useWishlist } from "../hooks/useWishlist";
import { useProductCardVariant } from "../hooks/useProductCardVariant";
import { getCartErrorMessage } from "../utils/cartErrors";
import { resolveSwatchColor } from "../utils/variantDisplay";

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

function getProductBrand(product) {
  return product?.brand || product?.vendorName || product?.sellerName || product?.category || "Daya";
}

function VariantColorSwatches({ options, selectedValue, groupName, onSelect, isEditorial }) {
  if (!options?.length) return null;

  return (
    <div
      className="flex items-center gap-1.5"
      aria-label={groupName || "Available colors"}
      role="listbox"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {options.map((option) => {
        const isSelected = selectedValue === option.value;
        const swatchColor = resolveSwatchColor(option.value);
        const isLightSwatch = swatchColor && swatchColor.toLowerCase() === "#f8fafc";

        return (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={isSelected}
            aria-label={option.value}
            title={option.inStock ? option.value : `${option.value} — out of stock`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSelect(option.value);
            }}
            className={`h-4 w-4 rounded-full border transition-all duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1 ${
              isLightSwatch ? "border-slate-300" : "border-black/10"
            } ${isSelected ? "ring-2 ring-brand-primary ring-offset-1" : "ring-1 ring-white"} ${
              option.inStock ? "" : "opacity-50"
            }`}
            style={{ backgroundColor: swatchColor || "#e2e8f0" }}
          />
        );
      })}
    </div>
  );
}

function CardActions({
  productId,
  isInWishlist,
  isSubmitting,
  inStock,
  activeVariant,
  onWishlist,
  onAddToCart,
  onViewProduct,
}) {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-20 flex translate-y-2 flex-col gap-2 opacity-0 transition-all duration-300 ease-out group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100">
      <button
        onClick={onViewProduct}
        className="enterprise-icon-button flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:shadow-xl active:scale-95 disabled:opacity-60"
        title="View product"
        aria-label="View product"
        type="button"
      >
        <Eye size={18} strokeWidth={1.8} className="text-slate-900" />
      </button>
      <button
        onClick={onWishlist}
        disabled={isSubmitting}
        className="enterprise-icon-button flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:shadow-xl active:scale-95 disabled:opacity-60"
        title={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
        aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
        type="button"
      >
        <Heart
          size={20}
          strokeWidth={1.5}
          className={`transition-all duration-300 ${
            isInWishlist ? "fill-red-500 text-red-500" : "text-slate-700 hover:text-slate-900"
          }`}
        />
      </button>
      <button
        onClick={onAddToCart}
        disabled={isSubmitting || !productId || !inStock}
        className="enterprise-primary-button flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary shadow-lg transition-all hover:scale-110 hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        title={inStock ? `Add ${activeVariant?.title || "item"} to cart` : "Out of stock"}
        aria-label={inStock ? `Add ${activeVariant?.title || "item"} to cart` : "Out of stock"}
        type="button"
      >
        <ShoppingCart size={20} strokeWidth={2} className="text-white" />
      </button>
    </div>
  );
}

function ProductCardInner({ product, cardStyle = "DEFAULT", imageAspectClass = "aspect-[4/5]", onProductClick }) {
  const navigate = useNavigate();
  const { addItem: addCartItem } = useCart();
  const { openDrawer, showToast } = useCartDrawer();
  const { addItem: addWishlistItem, removeItem: removeWishlistItem, isInWishlist: checkWishlistStatus } = useWishlist();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [isCardHovered, setIsCardHovered] = useState(false);

  const {
    productId,
    swatchGroup,
    swatchOptions,
    selectedSwatchValue,
    activeVariant,
    imageUrl,
    hoverImageUrl,
    pricing,
    inStock,
    detailUrl,
    selectSwatchValue,
  } = useProductCardVariant(product);

  const canSwapOnHover = Boolean(hoverImageUrl) && hoverImageUrl !== imageUrl;

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
        await addWishlistItem(productId, activeVariant?.variantId || "");
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
    if (isSubmitting || !productId || !inStock) return;

    try {
      setIsSubmitting(true);
      const variantId = activeVariant?.variantId || "";
      const added = await addCartItem(productId, 1, variantId);
      if (added) {
        openDrawer(product, activeVariant || added?.variant || added || null, added?.quantity || 1);
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
  const cardStyleClass =
    {
      DEFAULT:
        "border border-[#eeeeee] bg-white shadow-brandSm hover:shadow-brandMd hover:border-brand-primary",
      ELEVATED: "border border-[#eeeeee] bg-white shadow-brandLg hover:shadow-brandMd",
      MINIMAL: "border border-[#eeeeee] bg-white shadow-none hover:shadow-brandSm",
      EDITORIAL:
        "border border-brand-secondary bg-brand-secondary text-white shadow-brandLg ring-1 ring-black/10",
    }[styleKey] ||
    "border border-[#eeeeee] bg-white shadow-brandSm hover:shadow-brandMd transition-all duration-300 hover:border-brand-primary";

  const brandName = getProductBrand(product);
  const displayPrice = pricing.hasDiscount ? pricing.salePrice : pricing.price;
  const imageKey = `${activeVariant?.variantId || "default"}-${imageUrl}`;

  const navigateToProduct = () => {
    if (!productId) return;
    onProductClick?.(product);
    navigate(detailUrl);
  };

  return (
    <Motion.article
      whileHover={{ y: -8 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      onMouseEnter={() => setIsCardHovered(true)}
      onMouseLeave={() => setIsCardHovered(false)}
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
      <div
        className={`relative h-[320px] w-full ${imageAspectClass} flex-shrink-0 overflow-hidden rounded-brandMd bg-gradient-to-br from-brand-surfaceSecondary to-white`}
      >
        {imageUrl ? (
          canSwapOnHover ? (
            <>
              <img
                key={`primary-${imageKey}`}
                src={imageUrl}
                alt={product?.name || "Product image"}
                className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300 ease-out ${
                  isCardHovered ? "opacity-0" : "opacity-100"
                }`}
                loading="lazy"
              />
              <img
                key={`hover-${imageKey}`}
                src={hoverImageUrl}
                alt={product?.name || "Product hover image"}
                className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300 ease-out ${
                  isCardHovered ? "opacity-100" : "opacity-0"
                }`}
                loading="lazy"
              />
            </>
          ) : (
            <img
              key={imageKey}
              src={imageUrl}
              alt={product?.name || "Product image"}
              className={`h-full w-full object-cover object-center transition-transform duration-300 ease-out ${
                isCardHovered ? "scale-105" : "scale-100"
              }`}
              loading="lazy"
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">Image coming soon</div>
        )}

        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent transition duration-300 ${
            isCardHovered ? "opacity-100" : "opacity-0"
          }`}
        />

        {pricing.discountPercent > 0 ? (
          <div className="absolute left-3 top-3 z-20 rounded-full bg-brand-primary px-3 py-1.5 shadow-lg">
            <div className="text-xs font-bold leading-none text-white">{pricing.discountPercent}% OFF</div>
          </div>
        ) : null}

        <CardActions
          productId={productId}
          isInWishlist={isInWishlist}
          isSubmitting={isSubmitting}
          inStock={inStock}
          activeVariant={activeVariant}
          onWishlist={handleWishlist}
          onAddToCart={handleAddToCart}
          onViewProduct={(event) => {
            event.preventDefault();
            event.stopPropagation();
            navigateToProduct();
          }}
        />
      </div>

      <div className="flex flex-grow flex-col gap-3 pt-4">
        <p
          className={
            isEditorial
              ? "line-clamp-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300"
              : "line-clamp-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#777777]"
          }
        >
          {brandName}
        </p>

        <h3
          className={
            isEditorial
              ? "line-clamp-2 text-base font-semibold leading-snug text-white transition group-hover:text-slate-100"
              : "line-clamp-2 text-base font-semibold leading-snug text-[#111111] transition group-hover:text-brand-primary"
          }
        >
          {product.name}
        </h3>

        <div className="flex-grow" />

        {product?.ratings?.averageRating > 0 ? (
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            <span
              className={
                isEditorial
                  ? "text-xs font-semibold text-slate-100"
                  : "text-xs font-semibold text-slate-600 dark:text-slate-400"
              }
            >
              {Number(product.ratings.averageRating).toFixed(1)}
            </span>
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={isEditorial ? "text-base font-bold text-white" : "text-base font-bold text-brand-primary"}>
              {formatCurrency(displayPrice)}
            </span>
            {pricing.hasDiscount ? (
              <span className={isEditorial ? "text-xs text-slate-400 line-through" : "text-sm text-[#999999] line-through"}>
                {formatCurrency(pricing.price)}
              </span>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-3">
            <VariantColorSwatches
              options={swatchOptions}
              selectedValue={selectedSwatchValue}
              groupName={swatchGroup?.name}
              onSelect={selectSwatchValue}
              isEditorial={isEditorial}
            />
            <div
              className={`text-xs font-semibold ${
                inStock
                  ? isEditorial
                    ? "text-emerald-300"
                    : "text-green-600 dark:text-green-400"
                  : isEditorial
                    ? "text-rose-300"
                    : "text-red-600 dark:text-red-400"
              }`}
            >
              {inStock ? "In stock" : "Out of stock"}
            </div>
          </div>
        </div>
      </div>
    </Motion.article>
  );
}

export function PremiumProductCard({ product, cardStyle = "DEFAULT", imageAspectClass = "aspect-[4/5]", onProductClick }) {
  return (
    <ProductCardInner
      product={product}
      cardStyle={cardStyle}
      imageAspectClass={imageAspectClass}
      onProductClick={onProductClick}
    />
  );
}

export { PremiumProductCard as ProductCard };
