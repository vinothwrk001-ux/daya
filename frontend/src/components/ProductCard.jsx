import { logger } from "../services/logger/logger.js";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, ShoppingCart } from "lucide-react";
import { formatCurrency } from "../utils/formatCurrency";
import { useCart } from "../hooks/useCart";
import { useCartDrawer } from "../hooks/useCartDrawer";
import { useWishlist } from "../hooks/useWishlist";
import { useProductCardVariant } from "../hooks/useProductCardVariant";
import { getCartErrorMessage } from "../utils/cartErrors";
import { resolveSwatchColor } from "../utils/variantDisplay";
import { navigateToProduct } from "../utils/scrollPageToTop";

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

function VariantColorSwatches({ options, selectedValue, groupName, onSelect }) {
  if (!options?.length) return null;

  return (
    <div
      className="flex items-center justify-start gap-2"
      aria-label={groupName || "Available colors"}
      role="listbox"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {options.map((option) => {
        const isSelected = selectedValue === option.value;
        const swatchColor = resolveSwatchColor(option.value);
        const isLightSwatch = swatchColor && ["#f8fafc", "#ffffff", "#fff", "#f5f5f5"].includes(String(swatchColor).toLowerCase());

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
            className={`flex h-[24px] w-[24px] items-center justify-center rounded-full border border-slate-200 bg-white transition-transform duration-150 hover:scale-110 focus-visible:outline-none ${
              isSelected ? "border-black shadow-[0_0_0_2px_white,0_0_0_3px_#111827]" : ""
            } ${option.inStock ? "" : "opacity-40"}`}
          >
            <span
              className={`h-[16px] w-[16px] rounded-full ${isLightSwatch ? "border border-slate-300" : ""}`}
              style={{ backgroundColor: swatchColor || "#e2e8f0" }}
            />
          </button>
        );
      })}
    </div>
  );
}

function ProductCardInner({ product, cardStyle = "DEFAULT", imageAspectClass = "aspect-[3/4]", onProductClick }) {
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
  const isGridCard = styleKey === "DEFAULT";
  const showBrandLabel = !isGridCard;
  const brandName = getProductBrand(product);
  const displayPrice = pricing.hasDiscount ? pricing.salePrice : pricing.price;
  const imageKey = `${activeVariant?.variantId || "default"}-${imageUrl}`;

  const goToProduct = () => {
    if (!productId) return;
    onProductClick?.(product);
    navigateToProduct(navigate, detailUrl);
  };

  return (
    <article
      onMouseEnter={() => setIsCardHovered(true)}
      onMouseLeave={() => setIsCardHovered(false)}
      onClick={goToProduct}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          goToProduct();
        }
      }}
      role="link"
      tabIndex={0}
      className={`group relative mx-auto flex h-full w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-[12px] bg-transparent transition-all duration-300 ease-out hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7061] focus-visible:ring-offset-2 ${
        isEditorial ? "bg-slate-950 text-white" : ""
      }`}
    >
      {/* Tall portrait image — fills card width like reference */}
      <div className={`relative w-full ${imageAspectClass} flex-shrink-0 overflow-hidden bg-[#ececec]`}>
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
              className={`h-full w-full object-cover object-center transition-transform duration-500 ease-out ${
                isCardHovered ? "scale-[1.03]" : "scale-100"
              }`}
              loading="lazy"
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">Image coming soon</div>
        )}

        <div className="absolute left-3 top-3 z-20 flex flex-col items-start gap-2">
          {pricing.discountPercent > 0 ? (
            <div className="inline-flex items-center rounded-full bg-[#ff7061] px-3 py-1.5 shadow-sm">
              <span className="text-[11px] font-semibold leading-none text-white">
                {pricing.discountPercent}% Off
              </span>
            </div>
          ) : null}
        </div>

        <div className="absolute right-3 top-3 z-20 flex flex-col gap-2 opacity-100 transition-opacity duration-200 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
          <button
            type="button"
            onClick={handleWishlist}
            disabled={isSubmitting}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-800 shadow-md transition hover:scale-105 active:scale-95 disabled:opacity-60"
            title={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
            aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart
              size={15}
              strokeWidth={1.8}
              className={isInWishlist ? "fill-red-500 text-red-500" : ""}
            />
          </button>
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isSubmitting || !productId || !inStock}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-800 shadow-md transition hover:scale-105 active:scale-95 disabled:opacity-60"
            title={inStock ? `Add ${activeVariant?.title || "item"} to cart` : "Out of stock"}
            aria-label={inStock ? `Add ${activeVariant?.title || "item"} to cart` : "Out of stock"}
          >
            <ShoppingCart size={15} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* Centered info — compact like reference */}
      <div className="flex flex-col items-start px-6 pb-6 pt-4 text-left">
        {showBrandLabel ? (
          <p
            className={`line-clamp-1 text-[13px] font-medium uppercase tracking-[0.18em] ${
              isEditorial ? "text-slate-400" : "text-[#A3A3A3]"
            }`}
          >
            {brandName}
          </p>
        ) : null}

        <h3
          className={`mt-2 line-clamp-2 min-h-[2.25rem] text-base font-bold leading-snug tracking-[-0.01em] ${
            isEditorial ? "text-white" : "text-[#171717]"
          }`}
        >
          {product.name}
        </h3>

        <div className="mt-2 flex flex-wrap items-center justify-start gap-1.5">
          <span className={`text-[17px] font-bold ${isEditorial ? "text-white" : "text-[#ff7061]"}`}>
            {formatCurrency(displayPrice)}
          </span>
          {pricing.hasDiscount ? (
            <span className={`text-[16px] line-through ${isEditorial ? "text-slate-500" : "text-[#A3A3A3]"}`}>
              {formatCurrency(pricing.price)}
            </span>
          ) : null}
        </div>

        {swatchOptions?.length ? (
          <div className="mt-auto pt-3">
            <VariantColorSwatches
              options={swatchOptions}
              selectedValue={selectedSwatchValue}
              groupName={swatchGroup?.name}
              onSelect={selectSwatchValue}
            />
          </div>
        ) : (
          <div className="mt-auto h-[22px] pt-3" aria-hidden="true" />
        )}
      </div>
    </article>
  );
}

export function PremiumProductCard({ product, cardStyle = "DEFAULT", imageAspectClass = "aspect-square", onProductClick }) {
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
