import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BackButton } from "../components/BackButton";
import { RecommendationSection } from "../components/RecommendationSection";
import { getCartRecommendations } from "../services/recommendationService";
import { formatCurrency } from "../utils/formatCurrency";
import { formatWeight, getFormattedWeight, getWeightUnit, getWeightValue } from "../utils/weight";
import { useCart } from "../hooks/useCart";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Request failed";
}

export function CartPage() {
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState(null);
  const { cart, isGuest, loading, refreshCart, updateItem, removeItem, validateCart } = useCart();

  async function refresh() {
    setError("");
    try {
      if (isGuest) {
        await validateCart();
      } else {
        await refreshCart();
      }
    } catch (e) {
      setError(normalizeError(e));
    }
  }

  useEffect(() => {
    refresh();
  }, [isGuest]);

  const items = useMemo(() => (Array.isArray(cart?.items) ? cart.items : []), [cart]);
  const total = Number(cart?.totalAmount || 0);
  const productIds = useMemo(
    () => items.map((item) => item?.productId?._id || item?.productId).filter(Boolean).map(String),
    [items]
  );

  useEffect(() => {
    let cancelled = false;
    async function loadRecommendations() {
      if (!productIds.length) {
        setRecommendations(null);
        return;
      }
      try {
        const response = await getCartRecommendations(productIds);
        if (!cancelled) {
          setRecommendations(response?.data || null);
        }
      } catch {
        if (!cancelled) {
          setRecommendations(null);
        }
      }
    }
    loadRecommendations();
    return () => {
      cancelled = true;
    };
  }, [productIds]);

  async function changeQty(productId, variantId, nextQty) {
    setBusyId(`${productId}:${variantId || ""}`);
    setError("");
    try {
      await updateItem(productId, nextQty, variantId);
    } catch (e) {
      setError(normalizeError(e));
    } finally {
      setBusyId("");
    }
  }

  async function remove(productId, variantId) {
    setBusyId(`${productId}:${variantId || ""}`);
    setError("");
    try {
      await removeItem(productId, variantId);
    } catch (e) {
      setError(normalizeError(e));
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="grid gap-4 sm:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cart</h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">Review items from multiple sellers in one place</p>
        </div>
        <div className="flex-shrink-0">
          <BackButton fallbackTo="/shop" />
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-20 sm:h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 sm:p-8 text-center">
          <div className="text-3xl sm:text-4xl">🛒</div>
          <h3 className="mt-2 text-base sm:text-lg font-semibold text-slate-900 dark:text-white">Your cart is empty</h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">Browse products and add something to your cart</p>
          <Link
            to="/shop"
            className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-blue-700"
          >
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_minmax(300px,380px)]">
            <div className="grid gap-3 sm:gap-4">
              {items.map((item) => {
              const p = item?.productId;
              const id = p?._id || item.productId;
              const name = p?.name || item?.name || "Product";
              const img = item.image || (Array.isArray(p?.images) && p.images.length ? p.images[0]?.url : "");
              const qty = Number(item.quantity || 1);
              const price = Number(item.price || 0);
              const sellerName = item?.sellerId?.companyName || "";
              const variantLabel = item?.variantTitle || "";
              const variantId = item?.variantId || "";
              const itemWeight = getWeightValue(p || item);
              const itemWeightUnit = getWeightUnit(p || item);
              const totalWeight = itemWeight * qty;
              const productWeightLabel = getFormattedWeight(p || item);
              const busyKey = `${id}:${variantId}`;
              return (
                <div key={`${String(id)}:${variantId}`} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex gap-4">
                    {/* Product Image - Fixed Size */}
                    <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                      {img ? (
                        <img
                          src={img}
                          alt={name}
                          className="h-full w-full object-cover cursor-pointer transition hover:opacity-80"
                          onClick={() => navigate(`/product/${id}`)}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-slate-400">No image</div>
                      )}
                    </div>

                    {/* Product Info Section */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col h-full justify-between">
                        {/* Product Details */}
                        <div>
                          <h3
                            className="text-base font-semibold text-slate-950 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2"
                            onClick={() => navigate(`/product/${id}`)}
                          >
                            {name}
                          </h3>

                          {/* Variant and Seller Info */}
                          <div className="mt-2 space-y-1">
                            {variantLabel && (
                              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                                <span className="font-medium">{variantLabel}</span>
                              </div>
                            )}
                            {sellerName && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                <span className="font-medium">Seller:</span> {sellerName}
                              </div>
                            )}
                            {productWeightLabel && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                <span className="font-medium">Weight:</span> {productWeightLabel}
                                {qty > 1 ? ` each • ${formatWeight(totalWeight, itemWeightUnit)} total` : ""}
                              </div>
                            )}
                          </div>

                          {/* Price Display */}
                          <div className="mt-3">
                            <div className="text-lg font-semibold text-slate-950 dark:text-white">
                              {formatCurrency(price * qty)}
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                              {formatCurrency(price)} each
                            </div>
                          </div>
                        </div>

                        {/* Quantity and Action Controls */}
                        <div className="mt-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={busyId === busyKey || qty <= 1}
                              onClick={() => changeQty(String(id), variantId, qty - 1)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 font-semibold disabled:opacity-50 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                            >
                              −
                            </button>
                            <div className="w-12 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                              {qty}
                            </div>
                            <button
                              type="button"
                              disabled={busyId === busyKey}
                              onClick={() => changeQty(String(id), variantId, qty + 1)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 font-semibold disabled:opacity-50 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={busyId === busyKey}
                            onClick={() => remove(String(id), variantId)}
                            className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-200 dark:hover:bg-rose-950/30"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>

            <div className="h-fit rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-4">
              <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">Summary</div>
              <div className="mt-3 flex items-center justify-between text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                <span>Total</span>
                <span className="font-semibold text-slate-950 dark:text-white">{formatCurrency(total)}</span>
              </div>
              <button
                type="button"
                onClick={() => navigate("/checkout")}
                className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700"
              >
                Proceed to Checkout
              </button>
              <button
                type="button"
                onClick={() => navigate("/shop")}
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Continue Shopping
              </button>
            </div>
          </div>
          <RecommendationSection
            title="Recommended add-ons"
            subtitle="Cross-sell picks generated from cart contents and co-purchase behavior."
            items={recommendations?.crossSell || []}
          />
        </div>
      )}
    </div>
  );
}

