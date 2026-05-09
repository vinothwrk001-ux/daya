import { Fragment, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as inventoryService from "../services/inventoryService";

export function InventoryPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL"); // ALL, LOW_STOCK, IN_STOCK
  const [expandedProductId, setExpandedProductId] = useState("");

  useEffect(() => {
    loadInventorySummary();
  }, []);

  async function loadInventorySummary() {
    setLoading(true);
    setError("");
    try {
      const response = await inventoryService.getSellerInventorySummary();
      setSummary(response.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }

  // Filter and search products
  const filteredProducts = useMemo(() => {
    if (!summary?.products) return [];

    return summary.products.filter((product) => {
      const matchesSearch =
        product.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.variants.some((v) =>
          v.sku.toLowerCase().includes(searchTerm.toLowerCase())
        );

      if (filterStatus === "LOW_STOCK") {
        return matchesSearch && product.alertStatus === "ALERT";
      } else if (filterStatus === "IN_STOCK") {
        return matchesSearch && product.alertStatus !== "ALERT";
      }

      return matchesSearch;
    });
  }, [summary?.products, searchTerm, filterStatus]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 w-96 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Inventory Management</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Track and manage stock across all your product variants
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Products</div>
            <div className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
              {summary.totalProducts}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Stock</div>
            <div className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
              {summary.totalStock.toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Low Stock Variants</div>
            <div className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">
              {summary.lowStockVariants}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Alert Status</div>
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold dark:bg-slate-800">
              <span
                className={`h-2 w-2 rounded-full ${
                  summary.lowStockVariants > 0 ? "bg-red-500" : "bg-green-500"
                }`}
              />
              {summary.lowStockVariants > 0 ? "ALERT" : "OK"}
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm placeholder-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder-slate-400"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        >
          <option value="ALL">All Status</option>
          <option value="LOW_STOCK">Low Stock Only</option>
          <option value="IN_STOCK">In Stock</option>
        </select>
      </div>

      {/* Products Table */}
      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Total Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Variants
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Alert Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  View Details
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const isExpanded = expandedProductId === product.productId;
                return (
                  <Fragment key={product.productId}>
                    <tr className="border-b border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setExpandedProductId(isExpanded ? "" : product.productId)}
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            {isExpanded ? "Hide" : "Expand"}
                          </button>
                          <div>
                            <div className="font-medium text-slate-950 dark:text-white">{product.productName}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {product.lowStockVariants} low stock variant{product.lowStockVariants === 1 ? "" : "s"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {product.totalStock.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {product.variantCount}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            product.alertStatus === "ALERT"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              product.alertStatus === "ALERT" ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                          />
                          {product.alertStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => navigate(`/vendor/inventory/${product.productId}`)}
                          className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40">
                        <td colSpan={5} className="px-6 py-4">
                          <div className="grid gap-3 md:grid-cols-3">
                            {product.variants.slice(0, 6).map((variant) => (
                              <div
                                key={variant.variantId}
                                className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-semibold text-slate-950 dark:text-white">
                                      {variant.variantTitle}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">{variant.sku}</div>
                                  </div>
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                      variant.isLowStock
                                        ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-200"
                                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200"
                                    }`}
                                  >
                                    {variant.status}
                                  </span>
                                </div>
                                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-300">
                                  <div>
                                    <div className="text-slate-400">Stock</div>
                                    <div className="font-semibold">{variant.stock}</div>
                                  </div>
                                  <div>
                                    <div className="text-slate-400">Reserved</div>
                                    <div className="font-semibold">{variant.reserved}</div>
                                  </div>
                                  <div>
                                    <div className="text-slate-400">Available</div>
                                    <div className="font-semibold">{variant.available}</div>
                                  </div>
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

        {filteredProducts.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-slate-600 dark:text-slate-400">No products found matching your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
