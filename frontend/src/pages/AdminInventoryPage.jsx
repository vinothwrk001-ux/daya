import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminInventorySummary } from "../services/adminApi";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Failed to load admin inventory";
}

export function AdminInventoryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState(null);
  const [expandedProductId, setExpandedProductId] = useState("");

  useEffect(() => {
    loadInventory();
  }, [query]);

  async function loadInventory() {
    setLoading(true);
    setError("");
    try {
      const response = await getAdminInventorySummary({ search: query, limit: 50 });
      setData(response.data);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  const products = useMemo(() => data?.products || [], [data?.products]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Platform Products</div>
          <div className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">{data?.totals?.totalProducts || 0}</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Stock</div>
          <div className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">{data?.totals?.totalStock || 0}</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Reserved Stock</div>
          <div className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">{data?.totals?.totalReservedStock || 0}</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Low Stock Variants</div>
          <div className="mt-2 text-3xl font-bold text-red-600 dark:text-red-300">{data?.totals?.lowStockVariants || 0}</div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search platform products or variant SKU"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-950">
            Search
          </button>
        </form>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : products.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-950/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Total Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Variant Count</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Alert Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {products.map((product) => {
                  const expanded = expandedProductId === product.productId;
                  return (
                    <Fragment key={product.productId}>
                      <tr>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setExpandedProductId(expanded ? "" : product.productId)}
                              className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold dark:border-slate-700"
                            >
                              {expanded ? "Hide" : "Expand"}
                            </button>
                            <div>
                              <div className="font-semibold text-slate-950 dark:text-white">{product.productName}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{product.lowStockVariants} low stock variants</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-200">{product.totalStock}</td>
                        <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-200">{product.variantCount}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${product.alertStatus === "ALERT" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"}`}>
                            {product.alertStatus}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            to={`/admin/inventory/${product.productId}`}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            View Details
                          </Link>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr>
                          <td colSpan={5} className="bg-slate-50 px-4 py-4 dark:bg-slate-950/40">
                            <div className="grid gap-3 md:grid-cols-3">
                              {product.variants.slice(0, 6).map((variant) => (
                                <div key={variant.variantId} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="text-sm font-semibold text-slate-950 dark:text-white">{variant.variantTitle}</div>
                                      <div className="text-xs text-slate-500 dark:text-slate-400">{variant.sku}</div>
                                    </div>
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${variant.isLowStock ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-200" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200"}`}>
                                      {variant.status}
                                    </span>
                                  </div>
                                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-300">
                                    <div><div className="text-slate-400">Stock</div><div className="font-semibold">{variant.stock}</div></div>
                                    <div><div className="text-slate-400">Reserved</div><div className="font-semibold">{variant.reserved}</div></div>
                                    <div><div className="text-slate-400">Available</div><div className="font-semibold">{variant.available}</div></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">No admin-created products found.</div>
        )}
      </div>
    </div>
  );
}
