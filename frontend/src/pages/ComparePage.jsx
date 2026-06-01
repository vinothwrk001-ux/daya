import { useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { useCompare } from "../hooks/useCompare";
import { formatCurrency } from "../utils/formatCurrency";
import { resolveApiAssetUrl } from "../utils/resolveUrl";

function getProduct(item) {
  return item?.product || item?.productId || item;
}

function getProductId(item) {
  const product = getProduct(item);
  return item?.productId || product?._id || item?._id || "";
}

export function ComparePage() {
  const { compare, loading, removeItem, refreshCompare } = useCompare();
  const items = compare.items || [];

  useEffect(() => {
    refreshCompare().catch(() => {});
  }, [refreshCompare]);

  const handleRemove = useCallback(
    async (productId) => {
      await removeItem(productId);
    },
    [removeItem]
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Compare Products</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {items.length ? `${items.length} of ${compare.maxItems || 4} products selected` : "Add products from the homepage or shop to compare them here."}
          </p>
        </div>
        <Link to="/shop" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900">
          Continue Shopping
        </Link>
      </div>

      {loading && !items.length ? (
        <div className="mt-8 rounded-2xl border border-slate-200 p-8 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">Loading compare list...</div>
      ) : items.length ? (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="w-40 px-4 py-3 font-semibold">Feature</th>
                {items.map((item) => {
                  const product = getProduct(item);
                  const productId = getProductId(item);
                  return (
                    <th key={productId} className="min-w-[220px] px-4 py-3 align-top font-semibold">
                      <div className="flex items-start justify-between gap-3">
                        <Link to={`/product/${productId}`} className="line-clamp-2 text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-300">
                          {product?.name || "Product"}
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleRemove(productId)}
                          className="rounded-full p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                          aria-label="Remove from compare"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <CompareRow label="Image" items={items} render={(product, productId) => {
                const imageUrl = resolveApiAssetUrl(product?.images?.[0]?.url || product?.thumbnail || "");
                return imageUrl ? (
                  <Link to={`/product/${productId}`} className="block h-32 w-32 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-900">
                    <img src={imageUrl} alt={product?.name || "Product"} className="h-full w-full object-cover" loading="lazy" />
                  </Link>
                ) : (
                  <div className="flex h-32 w-32 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400 dark:bg-slate-900">No image</div>
                );
              }} />
              <CompareRow label="Price" items={items} render={(product) => (
                <div className="font-semibold text-slate-950 dark:text-white">{formatCurrency(product?.discountPrice || product?.price)}</div>
              )} />
              <CompareRow label="Original Price" items={items} render={(product) => (
                product?.discountPrice ? <span className="text-slate-500 line-through">{formatCurrency(product?.price)}</span> : <span className="text-slate-400">-</span>
              )} />
              <CompareRow label="Category" items={items} render={(product) => product?.category || "-"} />
              <CompareRow label="Brand" items={items} render={(product) => product?.attributes?.brand || product?.brand || "-"} />
              <CompareRow label="Seller" items={items} render={(product) => product?.sellerId?.shopName || product?.sellerId?.companyName || "-"} />
              <CompareRow label="Stock" items={items} render={(product) => Number(product?.stock || 0) > 0 ? `${product.stock} in stock` : "Out of stock"} />
              <CompareRow label="Rating" items={items} render={(product) => product?.ratings?.averageRating ? Number(product.ratings.averageRating).toFixed(1) : "-"} />
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-950">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">No products selected</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Use the Compare button on product cards to build a side-by-side list.</p>
          <Link to="/shop" className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
            Browse Products
          </Link>
        </div>
      )}
    </div>
  );
}

function CompareRow({ label, items, render }) {
  return (
    <tr>
      <th className="bg-slate-50 px-4 py-4 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">{label}</th>
      {items.map((item) => {
        const product = getProduct(item);
        const productId = getProductId(item);
        return (
          <td key={`${label}-${productId}`} className="px-4 py-4 align-top text-slate-700 dark:text-slate-200">
            {render(product, productId)}
          </td>
        );
      })}
    </tr>
  );
}
