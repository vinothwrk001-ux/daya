import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Eye, Loader2, ShoppingCart, X, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "../../utils/formatCurrency";
import { resolveApiAssetUrl } from "../../utils/resolveUrl";
import { useCart } from "../../hooks/useCart";
import { navigateToProduct } from "../../utils/scrollPageToTop";
import buyNowSessionService from "../../services/buyNowSessionService";
import { showError, showSuccess } from "../../services/notificationService";
import {
  getReelSessionId,
  setReelAttribution,
  trackReelCart,
  trackReelProductClick,
  trackReelProductView,
  trackReelProductWidgetOpen,
} from "../../services/reelService";
import { buildReelProductPath, getReelLinkedProducts } from "../../utils/reelProducts";
import { ReelProductQuickView } from "./ReelProductQuickView";

function DrawerProductCard({ product, reelId, onQuickView }) {
  const navigate = useNavigate();
  const sessionId = getReelSessionId();
  const { addItem } = useCart();
  const [adding, setAdding] = useState(false);
  const [buyingNow, setBuyingNow] = useState(false);

  const productId = product.productId || product._id;
  const price = Number(product.salePrice ?? product.price ?? 0);
  const original = product.salePrice ? Number(product.price ?? 0) : null;
  const inStock = product.stockStatus !== "out_of_stock";

  async function handleAddToCart() {
    if (!inStock) {
      showError("This product is out of stock");
      return;
    }
    setAdding(true);
    try {
      await trackReelProductClick(reelId, { productId, sessionId }).catch(() => {});
      setReelAttribution({ reelId, productId, sessionId });
      await addItem(productId, 1, "");
      await trackReelCart({ reelId, productId, sessionId }).catch(() => {});
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
      await trackReelProductClick(reelId, { productId, sessionId }).catch(() => {});
      setReelAttribution({ reelId, productId, sessionId });
      const guestToken = buyNowSessionService.getOrCreateGuestToken();
      const session = await buyNowSessionService.createBuyNowSession(
        productId,
        1,
        "",
        guestToken ? { guestToken } : undefined
      );
      buyNowSessionService.persistBuyNowSession(session);
      navigate(`/checkout?mode=buy-now&sessionId=${session.sessionId}`);
    } catch (error) {
      showError(error?.response?.data?.message || error?.message || "Unable to start checkout");
    } finally {
      setBuyingNow(false);
    }
  }

  function handleViewProduct() {
    trackReelProductClick(reelId, { productId, sessionId }).catch(() => {});
    setReelAttribution({ reelId, productId, sessionId });
    trackReelProductView(reelId, { productId, sessionId }).catch(() => {});
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        "reel_return_context",
        JSON.stringify({ reelId, returnUrl: `/reels?reel=${reelId}` })
      );
    }
    navigateToProduct(navigate, buildReelProductPath(product, reelId));
  }

  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex gap-3">
        <img
          src={resolveApiAssetUrl(product.image || product.images?.[0])}
          alt={product.name}
          className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-bold text-white">{product.name}</p>
          {product.category ? <p className="mt-0.5 text-[11px] text-zinc-400">{product.category}</p> : null}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-base font-black text-white">{formatCurrency(price)}</span>
            {original ? (
              <span className="text-xs text-zinc-400 line-through">{formatCurrency(original)}</span>
            ) : null}
          </div>
          <p className={`mt-1 text-[11px] font-semibold ${inStock ? "text-emerald-400" : "text-red-400"}`}>
            {inStock ? "In stock" : "Out of stock"}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleViewProduct}
          className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/15 px-2 py-2 text-xs font-semibold text-white hover:bg-white/10"
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </button>
        <button
          type="button"
          onClick={() => onQuickView?.(product)}
          className="rounded-xl border border-white/15 px-2 py-2 text-xs font-semibold text-white hover:bg-white/10"
        >
          Quick View
        </button>
        <button
          type="button"
          disabled={!inStock || adding}
          onClick={handleAddToCart}
          className="inline-flex items-center justify-center gap-1 rounded-xl bg-white px-2 py-2 text-xs font-bold text-zinc-900 disabled:opacity-50"
        >
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
          Add To Cart
        </button>
        <button
          type="button"
          disabled={!inStock || buyingNow}
          onClick={handleBuyNow}
          className="inline-flex items-center justify-center gap-1 rounded-xl bg-red-600 px-2 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {buyingNow ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          Buy Now
        </button>
      </div>
    </article>
  );
}

export function ReelProductShopDrawer({ reel, open, onClose }) {
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const products = getReelLinkedProducts(reel);
  const sessionId = getReelSessionId();

  useEffect(() => {
    if (!open || !reel?._id || !products.length) return;
    trackReelProductWidgetOpen(reel._id, { sessionId }).catch(() => {});
  }, [open, reel?._id, products.length, sessionId]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <AnimatePresence>
        {open ? (
          <>
            <Motion.button
              type="button"
              aria-label="Close product shopping drawer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
            />
            <Motion.aside
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed inset-x-0 bottom-0 z-[81] mx-auto flex max-h-[82dvh] w-full max-w-lg flex-col rounded-t-3xl border border-white/10 bg-zinc-950 shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[420px] md:rounded-none md:border-l md:border-t-0"
              role="dialog"
              aria-label="Products featured in this reel"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <p className="text-sm font-bold text-white">Products Featured In This Reel</p>
                  <p className="text-xs text-zinc-400">{products.length} products</p>
                </div>
                <button type="button" onClick={onClose} className="rounded-full p-2 text-zinc-300 hover:bg-white/10">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {products.map((product) => (
                  <DrawerProductCard
                    key={product.productId || product._id}
                    product={product}
                    reelId={reel._id}
                    onQuickView={setQuickViewProduct}
                  />
                ))}
              </div>
            </Motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <ReelProductQuickView
        product={quickViewProduct}
        reelId={reel?._id}
        open={Boolean(quickViewProduct)}
        onClose={() => setQuickViewProduct(null)}
      />
    </>,
    document.body
  );
}
