import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatCurrency } from "../utils/formatCurrency";
import { resolveApiAssetUrl } from "../utils/resolveUrl";
import { useWishlist } from "../hooks/useWishlist";
import { useCart } from "../hooks/useCart";
import { getCartErrorMessage } from "../utils/cartErrors";
import { SellerNameLink, VisitStoreButton } from "../components/seller/SellerNavigation";

function normalizeError(err, fallback = "Failed to load wishlist.") {
  return getCartErrorMessage(err, fallback);
}

export function WishlistPage() {
  const [busyProductId, setBusyProductId] = useState("");
  const [error, setError] = useState("");
  const { wishlist, loading, removeItem: removeWishlistItem, validateWishlist } = useWishlist();
  const { addItem: addCartItem } = useCart();
  const wishlistItems = wishlist?.items || [];

  async function loadWishlist() {
    try {
      await validateWishlist();
      setError("");
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  useEffect(() => {
    loadWishlist();
  }, []);

  async function removeItem(productId) {
    setBusyProductId(productId);
    try {
      await removeWishlistItem(productId);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusyProductId("");
    }
  }

  async function moveToCart(productId) {
    setBusyProductId(productId);
    try {
      const item = wishlistItems.find((wishlistItem) => {
        const itemProductId = wishlistItem.product?._id || wishlistItem.productId;
        return String(itemProductId) === String(productId);
      });
      await addCartItem(productId, 1, item?.variantId || "");
      await removeWishlistItem(productId);
      setError("");
    } catch (err) {
      setError(normalizeError(err, "Failed to move item to cart."));
    } finally {
      setBusyProductId("");
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Wishlist</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Save products for later and move them back into your cart when you are ready.</p>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {loading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-80 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : wishlistItems.length ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {wishlistItems.map((item) => {
            const product = item.product || item;
            const image = resolveApiAssetUrl(product?.images?.[0]?.url || item?.image);
            
            // Get variant if it exists
            const variant = item.variantId && product?.variants
              ? product.variants.find(v => v.variantId === item.variantId)
              : null;
            
            // Use variant price if available, otherwise product price
            const basePrice = variant?.price || product?.price || 0;
            const discountPrice = variant?.discountPrice || product?.discountPrice;
            
            const variantTitle = item.selectedAttributes
              ? Object.entries(item.selectedAttributes)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(", ")
              : null;
            return (
              <div key={item._id || item.productId} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <Link to={`/product/${product?._id || item.productId}`} className="block aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {image ? <img src={image} alt={product?.name || "Wishlist item"} className="h-full w-full object-cover" /> : null}
                </Link>
                <div className="grid gap-3 p-5">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{product?.category || "Product"}</div>
                    <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{product?.name}</div>
                    {variantTitle && (
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Selected: {variantTitle}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <SellerNameLink seller={product?.sellerId} />
                      <VisitStoreButton seller={product?.sellerId}>Visit Seller Store</VisitStoreButton>
                    </div>
                    <div className="mt-2 text-base font-bold text-slate-950 dark:text-white">
                      {discountPrice ? (
                        <>
                          <span className="line-through text-sm text-slate-500 dark:text-slate-400">{formatCurrency(basePrice)}</span>
                          {" "}{formatCurrency(discountPrice)}
                        </>
                      ) : (
                        formatCurrency(basePrice)
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyProductId === (product?._id || item.productId) || product?.stock <= 0}
                      onClick={() => moveToCart(product?._id || item.productId)}
                      className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {product?.stock <= 0 ? "Out of stock" : "Move to cart"}
                    </button>
                    <button
                      type="button"
                      disabled={busyProductId === (product?._id || item.productId)}
                      onClick={() => removeItem(product?._id || item.productId)}
                      className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          Your wishlist is empty. Save products from the storefront to see them here.
        </div>
      )}
    </div>
  );
}
