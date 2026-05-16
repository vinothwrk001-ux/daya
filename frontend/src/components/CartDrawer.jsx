import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Check, X, Trash2 } from "lucide-react";
import { useCartDrawer } from "../hooks/useCartDrawer";
import { useCart } from "../hooks/useCart";
import { formatCurrency } from "../utils/formatCurrency";
import { resolveApiAssetUrl } from "../utils/resolveUrl";
import * as productService from "../services/productService";
import { Portal } from "./Portal";
import { InlineToast } from "./commerce/InlineToast";
import {
  extractProductId,
  extractVariantId,
  getCartItemKey,
  normalizeCartPayload,
} from "../utils/cartState";

export function CartDrawer() {
  const navigate = useNavigate();
  const drawerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const {
    isRendered,
    isAnimating,
    openCount,
    lastAddedProduct,
    lastAddedVariant,
    lastAddedQuantity,
    closeDrawer,
    toast,
    showToast,
    clearToast,
    clearLastAddedItem,
  } = useCartDrawer();
  const { cart, removeItem } = useCart();
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [deletingItems, setDeletingItems] = useState(new Set());

  useEffect(() => {
    if (!isRendered || !lastAddedProduct?._id) return undefined;

    setShowSuccess(true);
    const successTimer = window.setTimeout(() => setShowSuccess(false), 2000);

    let alive = true;
    (async () => {
      try {
        setLoadingRecs(true);
        const response = await productService.getRelatedProducts(lastAddedProduct._id, 4);
        if (alive) {
          setRecommendations(Array.isArray(response?.data) ? response.data : []);
        }
      } catch {
        if (alive) setRecommendations([]);
      } finally {
        if (alive) setLoadingRecs(false);
      }
    })();

    return () => {
      alive = false;
      window.clearTimeout(successTimer);
    };
  }, [isRendered, lastAddedProduct, openCount]);

  useEffect(() => {
    if (!isRendered) return undefined;
    closeButtonRef.current?.focus();
    return undefined;
  }, [isRendered, openCount]);

  useEffect(() => {
    if (!isRendered || !drawerRef.current) return undefined;

    const node = drawerRef.current;
    const handleKeyDown = (event) => {
      if (event.key !== "Tab") return;

      const focusableElements = node.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (!focusableElements.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    node.addEventListener("keydown", handleKeyDown);
    return () => node.removeEventListener("keydown", handleKeyDown);
  }, [isRendered, openCount]);

  const normalizedCart = useMemo(() => normalizeCartPayload(cart), [cart]);
  const cartItems = normalizedCart.items;

  const fallbackCartItem = useMemo(() => {
    if (cartItems.length > 0 || !lastAddedProduct) return null;

    const rawImage =
      Array.isArray(lastAddedProduct?.images) && lastAddedProduct.images.length
        ? typeof lastAddedProduct.images[0] === "string"
          ? lastAddedProduct.images[0]
          : lastAddedProduct.images[0]?.url
        : "";

    const itemPrice = Number(
      lastAddedVariant?.discountPrice ?? lastAddedVariant?.price ?? lastAddedProduct?.discountPrice ?? lastAddedProduct?.price ?? 0
    );

    return {
      productId: lastAddedProduct,
      name: lastAddedProduct?.name || "Product",
      image: rawImage,
      quantity: Number(lastAddedQuantity || 1),
      price: itemPrice,
      variantId: lastAddedVariant?.variantId || "",
      variantTitle: lastAddedVariant?.variantTitle || lastAddedVariant?.title || "",
      variantAttributes: lastAddedVariant?.selectedAttributes || {},
    };
  }, [cartItems.length, lastAddedProduct, lastAddedQuantity, lastAddedVariant]);

  const displayItems = fallbackCartItem ? [fallbackCartItem] : cartItems;
  const cartTotals = useMemo(
    () => {
      if (fallbackCartItem) {
        return {
          subtotal: fallbackCartItem.price * Number(fallbackCartItem.quantity || 0),
          items: Number(fallbackCartItem.quantity || 0),
        };
      }
      return {
        subtotal: normalizedCart.totalAmount,
        items: normalizedCart.totalQuantity,
      };
    },
    [normalizedCart, fallbackCartItem]
  );

  const handleDeleteItem = async (productId, variantId) => {
    if (!productId) {
      showToast("Unable to remove this item right now.");
      return;
    }

    const itemKey = getCartItemKey(productId, variantId);
    if (deletingItems.has(itemKey)) return;

    setDeletingItems((prev) => new Set(prev).add(itemKey));
    try {
      await removeItem(productId, variantId);
      if (productId === extractProductId(lastAddedProduct)) {
        clearLastAddedItem();
      }
    } catch (error) {
      showToast(error?.response?.data?.message || error?.message || "Failed to remove item from cart.");
    } finally {
      setDeletingItems((prev) => {
        const next = new Set(prev);
        next.delete(itemKey);
        return next;
      });
    }
  };

  if (!isRendered) return null;

  return (
    <Portal>
      <>
        <aside
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-title"
          className={`fixed right-0 top-0 z-50 flex h-dvh w-full max-w-[min(100vw,28rem)] flex-col overflow-hidden bg-white shadow-2xl transition-transform duration-300 ease-out dark:bg-slate-900 ${
            isAnimating ? "translate-x-0" : "translate-x-full"
          } pb-[max(1rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 p-4 sm:p-6 dark:border-slate-800">
            <div>
              <h2 id="drawer-title" className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">
                Added to Cart
              </h2>
              {lastAddedVariant ? (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {lastAddedVariant.variantTitle || lastAddedVariant.title
                    ? `Selected variant: ${lastAddedVariant.variantTitle || lastAddedVariant.title}`
                    : Object.keys(lastAddedVariant?.selectedAttributes || {}).length > 0
                    ? `Selected: ${Object.entries(lastAddedVariant.selectedAttributes)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(", ")}`
                    : "Best available variant auto-selected."}
                </p>
              ) : null}
            </div>
            <button
              ref={closeButtonRef}
              onClick={closeDrawer}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label="Close cart drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            {showSuccess ? (
              <div className="flex items-center gap-2 border-b border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950/30 sm:px-6">
                <Check className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  Successfully added to cart.
                </span>
              </div>
            ) : null}

            {displayItems.length > 0 ? (
              <div className="border-b border-slate-200 p-4 dark:border-slate-800 sm:p-6">
                <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Cart Items ({displayItems.length})
                </h3>

                <div className="space-y-3">
                  {displayItems.map((item) => {
                    const product = typeof item?.productId === "object" ? item.productId : null;
                    const productId = extractProductId(item?.productId || item);
                    const variantId = extractVariantId(item);
                    const itemKey = getCartItemKey(productId, variantId);
                    const isDeleting = deletingItems.has(itemKey);
                    const itemName = product?.name || item?.name || "Product";
                    const rawImage =
                      (typeof item?.image === "string" ? item.image : item?.image?.url) ||
                      (Array.isArray(product?.images)
                        ? typeof product.images[0] === "string"
                          ? product.images[0]
                          : product.images[0]?.url
                        : "") ||
                      (Array.isArray(item?.images)
                        ? typeof item.images[0] === "string"
                          ? item.images[0]
                          : item.images[0]?.url
                        : "");
                    const itemImage = resolveApiAssetUrl(rawImage || "");
                    const itemPrice = Number(item?.discountedPrice ?? item?.price ?? 0);

                    return (
                      <div
                        key={itemKey}
                        className={`flex items-start gap-3 border-b border-slate-100 pb-3 transition last:border-b-0 last:pb-0 dark:border-slate-800 ${
                          isDeleting ? "pointer-events-none opacity-50" : ""
                        }`}
                      >
                        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                          {itemImage ? (
                            <img src={itemImage} alt={itemName} className="h-full w-full object-cover" />
                          ) : (
                            <div className="text-slate-400 dark:text-slate-600">
                              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="mb-1 line-clamp-2 text-xs font-medium text-slate-900 dark:text-white sm:text-sm">
                            {itemName}
                          </h4>
                          {item?.variantTitle ? (
                            <p className="mb-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                              {item.variantTitle}
                            </p>
                          ) : null}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-col">
                              <p className="text-xs text-slate-500 dark:text-slate-400">Qty: {item.quantity}</p>
                              <p className="text-xs font-semibold text-slate-900 dark:text-white sm:text-sm">
                                {formatCurrency(itemPrice * Number(item.quantity || 0))}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteItem(productId, variantId)}
                              disabled={isDeleting}
                              className="flex-shrink-0 rounded-lg p-1.5 text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/30"
                              aria-label={`Remove ${itemName} from cart`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="border-b border-slate-200 p-4 dark:border-slate-800 sm:p-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Cart Summary</h3>
              <div className="mb-3 space-y-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Items</span>
                  <span className="font-medium text-slate-900 dark:text-white">{cartTotals.items}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 dark:text-white">Total Amount</span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400 sm:text-xl">
                  {formatCurrency(cartTotals.subtotal)}
                </span>
              </div>
            </div>

            {recommendations.length > 0 && !loadingRecs ? (
              <div className="border-b border-slate-200 p-4 dark:border-slate-800 sm:p-6">
                <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  You may also like
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {recommendations.map((rec) => {
                    const firstImage = Array.isArray(rec?.images)
                      ? typeof rec.images[0] === "string"
                        ? rec.images[0]
                        : rec.images[0]?.url
                      : "";
                    const recImage = resolveApiAssetUrl(firstImage || "");
                    const recPrice = rec?.discountPrice || rec?.price || 0;

                    return (
                      <button
                        key={rec._id}
                        onClick={() => {
                          navigate(`/product/${rec._id}`);
                          closeDrawer();
                        }}
                        className="group overflow-hidden rounded-lg border border-slate-200 text-left transition hover:border-blue-300 dark:border-slate-700 dark:hover:border-blue-600"
                      >
                        <div className="aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800">
                          {recImage ? (
                            <img
                              src={recImage}
                              alt={rec?.name || "Recommended product"}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-110"
                            />
                          ) : null}
                        </div>
                        <div className="p-2">
                          <p className="line-clamp-1 text-xs font-medium text-slate-900 dark:text-white">
                            {rec?.name || "Product"}
                          </p>
                          <p className="mt-1 text-xs font-bold text-blue-600 dark:text-blue-400">
                            {formatCurrency(recPrice)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex-shrink-0 space-y-2 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <Link
              to="/cart"
              onClick={closeDrawer}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95 sm:py-3.5 sm:text-base"
            >
              View Cart
              <ChevronRight className="h-4 w-4" />
            </Link>

            <button
              onClick={closeDrawer}
              className="flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 active:scale-95 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 sm:py-3.5 sm:text-base"
            >
              Continue Shopping
            </button>

            <Link
              to="/checkout"
              onClick={closeDrawer}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-green-500 bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:from-green-700 hover:to-emerald-700 active:scale-95 sm:py-3 sm:text-sm"
            >
              Checkout Now
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </aside>

        <InlineToast toast={toast} onClose={clearToast} />
      </>
    </Portal>
  );
}
