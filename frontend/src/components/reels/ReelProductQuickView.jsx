import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Loader2, ShoppingCart, X, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "../../utils/formatCurrency";
import { resolveApiAssetUrl } from "../../utils/resolveUrl";
import { useProductCardVariant } from "../../hooks/useProductCardVariant";
import { useCart } from "../../hooks/useCart";
import { resolveSwatchColor } from "../../utils/variantDisplay";
import { navigateToProduct } from "../../utils/scrollPageToTop";
import buyNowSessionService from "../../services/buyNowSessionService";
import { showError, showSuccess } from "../../services/notificationService";
import {
  getReelSessionId,
  setReelAttribution,
  trackReelCart,
  trackReelProductClick,
  trackReelProductView,
} from "../../services/reelService";
import { buildReelProductPath } from "../../utils/reelProducts";

function QuickViewContent({ product, reelId, onClose }) {
  const navigate = useNavigate();
  const sessionId = getReelSessionId();
  const { addItem } = useCart();
  const [adding, setAdding] = useState(false);
  const [buyingNow, setBuyingNow] = useState(false);

  const legacyProduct = {
    _id: product.productId || product._id,
    name: product.name,
    price: product.price,
    salePrice: product.salePrice,
    images: product.images,
    variants: product.variants,
  };

  const {
    swatchOptions,
    selectedSwatchValue,
    imageUrl,
    pricing,
    inStock,
    activeVariant,
    selectSwatchValue,
  } = useProductCardVariant(legacyProduct);

  useEffect(() => {
    if (!reelId || !legacyProduct._id) return;
    trackReelProductView(reelId, {
      productId: legacyProduct._id,
      sessionId,
    }).catch(() => {});
  }, [legacyProduct._id, reelId, sessionId]);

  async function handleAddToCart() {
    if (!inStock) {
      showError("This product is out of stock");
      return;
    }
    setAdding(true);
    try {
      await trackReelProductClick(reelId, {
        productId: legacyProduct._id,
        sessionId,
      }).catch(() => {});
      setReelAttribution({ reelId, productId: legacyProduct._id, sessionId });
      await addItem(legacyProduct._id, 1, activeVariant?.variantId || "");
      await trackReelCart({
        reelId,
        productId: legacyProduct._id,
        sessionId,
      }).catch(() => {});
      showSuccess("Added to cart");
    } catch (error) {
      showError(error?.response?.data?.message || error?.message || "Unable to add to cart");
    } finally {
      setAdding(false);
    }
  }

  async function handleBuyNow() {
    if (!inStock) {
      showError("This product is out of stock");
      return;
    }
    setBuyingNow(true);
    try {
      await trackReelProductClick(reelId, {
        productId: legacyProduct._id,
        sessionId,
      }).catch(() => {});
      setReelAttribution({ reelId, productId: legacyProduct._id, sessionId });

      const variantId = activeVariant?.variantId || "";
      const guestToken = buyNowSessionService.getOrCreateGuestToken();
      const session = await buyNowSessionService.createBuyNowSession(
        legacyProduct._id,
        1,
        variantId,
        guestToken ? { guestToken } : undefined
      );
      buyNowSessionService.persistBuyNowSession(session);
      navigate(`/checkout?mode=buy-now&sessionId=${session.sessionId}`);
      onClose?.();
    } catch (error) {
      showError(error?.response?.data?.message || error?.message || "Unable to start checkout");
    } finally {
      setBuyingNow(false);
    }
  }

  function handleViewProduct() {
    trackReelProductClick(reelId, {
      productId: legacyProduct._id,
      sessionId,
    }).catch(() => {});
    setReelAttribution({ reelId, productId: legacyProduct._id, sessionId });
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        "reel_return_context",
        JSON.stringify({ reelId, returnUrl: `/reels?reel=${reelId}` })
      );
    }
    navigateToProduct(
      navigate,
      buildReelProductPath(legacyProduct, reelId, activeVariant?.variantId || "")
    );
    onClose?.();
  }

  return (
    <div className="space-y-4">
      <img
        src={imageUrl || resolveApiAssetUrl(product.image || product.images?.[0])}
        alt={product.name}
        className="aspect-square w-full rounded-2xl object-cover"
      />
      <div>
        <p className="text-lg font-black text-white">{product.name}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xl font-black text-white">
            {formatCurrency(pricing.hasDiscount ? pricing.salePrice : pricing.price)}
          </span>
          {pricing.hasDiscount ? (
            <span className="text-sm text-zinc-400 line-through">{formatCurrency(pricing.price)}</span>
          ) : null}
        </div>
        <p className={`mt-1 text-xs font-semibold ${inStock ? "text-emerald-400" : "text-red-400"}`}>
          {inStock ? "In stock" : "Out of stock"}
        </p>
      </div>

      {swatchOptions.length ? (
        <div className="flex flex-wrap gap-2">
          {swatchOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-label={option.value}
              onClick={() => selectSwatchValue(option.value)}
              className={`h-7 w-7 rounded-full border border-white/30 ${
                selectedSwatchValue === option.value ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-950" : ""
              }`}
              style={{ backgroundColor: resolveSwatchColor(option.value) || "#94a3b8" }}
            />
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleViewProduct}
          className="rounded-xl border border-white/15 px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
        >
          View Product
        </button>
        <button
          type="button"
          disabled={!inStock || adding}
          onClick={handleAddToCart}
          className="inline-flex items-center justify-center gap-1 rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-zinc-900 disabled:opacity-50"
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
          Add To Cart
        </button>
        <button
          type="button"
          disabled={!inStock || buyingNow}
          onClick={handleBuyNow}
          className="col-span-2 inline-flex items-center justify-center gap-1 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {buyingNow ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Buy Now
        </button>
      </div>
    </div>
  );
}

export function ReelProductQuickView({ product, reelId, open, onClose }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && product ? (
        <>
          <Motion.button
            type="button"
            aria-label="Close quick view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm"
          />
          <Motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="fixed inset-x-4 top-[10dvh] z-[91] mx-auto max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-5 shadow-2xl md:inset-x-auto md:w-full"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-bold text-white">Quick View</p>
              <button type="button" onClick={onClose} className="rounded-full p-2 text-zinc-300 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <QuickViewContent product={product} reelId={reelId} onClose={onClose} />
          </Motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
