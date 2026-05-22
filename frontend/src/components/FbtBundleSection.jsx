import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, ShoppingCart } from "lucide-react";
import { formatCurrency } from "../utils/formatCurrency";
import { trackRecommendationEvent } from "../services/recommendationService";

const MAX_BUNDLE_CONTAINER_ITEMS = 20;

function getImage(product) {
  return Array.isArray(product?.images) && product.images.length ? product.images[0]?.url : "";
}

export function FbtBundleSection({ fbt, sourceProductId, surface = "product_page", onAddProduct }) {
  const [adding, setAdding] = useState(false);
  const recommendations = useMemo(
    () => (Array.isArray(fbt?.recommendations) ? fbt.recommendations.slice(0, MAX_BUNDLE_CONTAINER_ITEMS - 1) : []),
    [fbt]
  );
  const bundleProducts = useMemo(
    () => (Array.isArray(fbt?.bundleProducts) ? fbt.bundleProducts.slice(0, MAX_BUNDLE_CONTAINER_ITEMS) : []),
    [fbt]
  );
  const viewKey = `${surface}:${sourceProductId}:${recommendations.map((item) => item.productId || item._id).join(",")}`;
  const viewedRef = useRef("");

  useEffect(() => {
    if (!recommendations.length || viewedRef.current === viewKey) return;
    viewedRef.current = viewKey;
    recommendations.forEach((item) => {
      trackRecommendationEvent({
        recommendationType: "fbt",
        surface,
        eventType: "VIEW",
        productId: sourceProductId,
        recommendedProductId: item.productId || item._id,
      }).catch(() => {});
    });
  }, [recommendations, sourceProductId, surface, viewKey]);

  if (!bundleProducts.length || !recommendations.length) return null;

  async function addBundle() {
    if (!onAddProduct || adding) return;
    setAdding(true);
    try {
      for (const item of bundleProducts) {
        await onAddProduct(item.productId || item._id, 1, "");
      }
      await Promise.all(
        recommendations.map((item) =>
          trackRecommendationEvent({
            recommendationType: "fbt",
            surface,
            eventType: "CONVERSION",
            productId: sourceProductId,
            recommendedProductId: item.productId || item._id,
            metadata: { bundleRevenue: fbt.finalPrice || fbt.bundlePrice || 0 },
          }).catch(() => {})
        )
      );
    } finally {
      setAdding(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Frequently Bought Together</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Bundle items customers commonly purchase with this product.</p>
        </div>
        <button
          type="button"
          disabled={adding}
          onClick={addBundle}
          className="inline-flex w-fit items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-950"
        >
          <ShoppingCart className="h-4 w-4" />
          {adding ? "Adding..." : "Add Bundle To Cart"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex flex-wrap items-stretch gap-3">
          {bundleProducts.map((product, index) => (
            <div key={product.productId || product._id} className="flex items-center gap-3">
              {index > 0 ? <Plus className="h-5 w-5 text-slate-400" /> : null}
              <div className="w-36 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                <div className="aspect-square overflow-hidden rounded-xl bg-white dark:bg-slate-900">
                  {getImage(product) ? <img src={getImage(product)} alt={product.name} className="h-full w-full object-cover" /> : null}
                </div>
                <div className="mt-2 line-clamp-2 min-h-10 text-xs font-semibold text-slate-900 dark:text-white">{product.name}</div>
                <div className="mt-1 text-sm font-bold text-slate-950 dark:text-white">{formatCurrency(product.price || 0)}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-950">
          <div className="flex justify-between gap-3 text-slate-600 dark:text-slate-300">
            <span>Total Price</span>
            <span className="font-semibold text-slate-950 dark:text-white">{formatCurrency(fbt.bundlePrice || 0)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-3 text-slate-600 dark:text-slate-300">
            <span>Bundle Discount</span>
            <span className="font-semibold text-emerald-700">{formatCurrency(fbt.discount || 0)}</span>
          </div>
          <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
            <div className="flex justify-between gap-3 text-base font-bold text-slate-950 dark:text-white">
              <span>Final Price</span>
              <span>{formatCurrency(fbt.finalPrice || fbt.bundlePrice || 0)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
