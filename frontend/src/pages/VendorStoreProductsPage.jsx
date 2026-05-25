import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { VendorStoreHeader } from "../components/vendor-storefront/VendorStoreHeader";
import { VendorProductGrid } from "../components/vendor-storefront/VendorProductGrid";
import { getVendorStoreProducts } from "../services/vendorStorefrontService";

const SORTS = [
  ["newest", "Newest"],
  ["best_selling", "Best Selling"],
  ["highest_rated", "Highest Rated"],
  ["discount", "Discount"],
  ["price_low", "Price Low"],
  ["price_high", "Price High"],
];

export function VendorStoreProductsPage() {
  const { vendorSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState({ loading: true, error: "", data: null });

  const params = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);
  const page = Number(searchParams.get("page") || 1);

  useEffect(() => {
    let alive = true;
    setState((current) => ({ ...current, loading: true, error: "" }));
    getVendorStoreProducts(vendorSlug, { limit: 32, ...params })
      .then((response) => {
        if (alive) setState({ loading: false, error: "", data: response.data });
      })
      .catch((err) => {
        if (alive) setState({ loading: false, error: err?.response?.data?.message || "Failed to load vendor products.", data: null });
      });
    return () => {
      alive = false;
    };
  }, [vendorSlug, params]);

  function updateParam(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.set("page", "1");
    setSearchParams(next);
  }

  if (state.loading && !state.data) return <div className="rounded-2xl bg-white p-8 text-sm text-slate-500 dark:bg-slate-900">Loading products...</div>;
  if (state.error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{state.error}</div>;

  const { vendor, products, pagination, isFollowing } = state.data;

  return (
    <div className="grid gap-6">
      <VendorStoreHeader vendor={vendor} isFollowing={isFollowing} onFollowChange={(next) => setState((current) => ({ ...current, data: { ...current.data, ...next } }))} />

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="grid h-max gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <input value={searchParams.get("search") || ""} onChange={(e) => updateParam("search", e.target.value)} placeholder="Search inside this store" className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
          <input value={searchParams.get("category") || ""} onChange={(e) => updateParam("category", e.target.value)} placeholder="Category" className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
          <input value={searchParams.get("subCategory") || ""} onChange={(e) => updateParam("subCategory", e.target.value)} placeholder="Subcategory" className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
          <input value={searchParams.get("brand") || ""} onChange={(e) => updateParam("brand", e.target.value)} placeholder="Brand" className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={searchParams.get("minPrice") || ""} onChange={(e) => updateParam("minPrice", e.target.value)} placeholder="Min" className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
            <input type="number" value={searchParams.get("maxPrice") || ""} onChange={(e) => updateParam("maxPrice", e.target.value)} placeholder="Max" className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={searchParams.get("color") || ""} onChange={(e) => updateParam("color", e.target.value)} placeholder="Color" className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
            <input value={searchParams.get("size") || ""} onChange={(e) => updateParam("size", e.target.value)} placeholder="Size" className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
          </div>
          <select value={searchParams.get("rating") || ""} onChange={(e) => updateParam("rating", e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
            <option value="">Any rating</option>
            <option value="4">4 stars and up</option>
            <option value="3">3 stars and up</option>
          </select>
          <select value={searchParams.get("availability") || ""} onChange={(e) => updateParam("availability", e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
            <option value="">All availability</option>
            <option value="in_stock">In stock</option>
            <option value="out_of_stock">Out of stock</option>
          </select>
          <select value={searchParams.get("sortBy") || "newest"} onChange={(e) => updateParam("sortBy", e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
            {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button type="button" onClick={() => setSearchParams({ page: "1" })} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Clear filters</button>
        </aside>

        <main className="grid gap-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Showing {products.length} of {pagination.total} vendor products only</span>
            <span>Page {pagination.page} of {pagination.pages}</span>
          </div>
          <VendorProductGrid products={products} loading={state.loading} />
          {pagination.pages > 1 ? (
            <div className="flex justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
              <button disabled={page <= 1} onClick={() => updateParam("page", String(page - 1))} className="rounded-xl border border-slate-300 px-4 py-2 text-sm disabled:opacity-50">Previous</button>
              <button disabled={page >= pagination.pages} onClick={() => updateParam("page", String(page + 1))} className="rounded-xl border border-slate-300 px-4 py-2 text-sm disabled:opacity-50">Next</button>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
