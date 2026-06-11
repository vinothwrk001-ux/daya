import { Fragment, useCallback, useEffect, useState } from "react";
import { confirmAction } from "../services/notificationService";
import { Link } from "react-router-dom";
import {
  approveProduct,
  deleteProduct,
  getProductStats,
  listProducts,
  rejectProduct,
  updateProduct,
} from "../services/adminApi";
import { ReportingToolbar } from "../components/ReportingToolbar";
import { StatusBadge } from "../components/StatusBadge";
import { InlineToast } from "../components/commerce/InlineToast";
import { useReporting } from "../hooks/useReporting";
import { formatCurrency } from "../utils/formatCurrency";
import { useAdminSession } from "../hooks/useAdminSession";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Request failed";
}

const SORT_OPTIONS = [
  { value: "createdAt-desc", label: "Newest first" },
  { value: "createdAt-asc", label: "Oldest first" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "price-desc", label: "Price high-low" },
  { value: "price-asc", label: "Price low-high" },
  { value: "status-asc", label: "Status A-Z" },
];

function getSortState(value) {
  const [sortBy = "createdAt", sortOrder = "desc"] = String(value || "createdAt-desc").split("-");
  return { sortBy, sortOrder };
}

function getPrimaryImage(product) {
  return (
    product?.images?.find((image) => image?.isPrimary)?.url ||
    product?.images?.[0]?.url ||
    ""
  );
}

export function AdminProductsPage() {
  const { basePath, isLegacyAdmin, canAccess } = useAdminSession();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState([]);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortValue, setSortValue] = useState("createdAt-desc");
  const [rejectReason, setRejectReason] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [busyId, setBusyId] = useState("");
  const reporting = useReporting({
    module: "products",
    getFilters: () => ({
      ...(status ? { status } : {}),
      ...(searchQuery ? { search: searchQuery } : {}),
    }),
    onApply: () => setPage(1),
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { sortBy, sortOrder } = getSortState(sortValue);
      const [productsRes, statsRes] = await Promise.all([
        listProducts({
          page,
          limit: 10,
          ...(status ? { status } : {}),
          ...(searchQuery ? { search: searchQuery } : {}),
          sortBy,
          sortOrder,
          ...reporting.appliedParams,
        }),
        getProductStats(),
      ]);
      setProducts(productsRes.data.products || []);
      setTotalPages(productsRes.data.pagination?.pages || 1);
      setTotalItems(productsRes.data.pagination?.total || 0);
      setStats(statsRes.data.countByStatus || []);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, [page, reporting.appliedParams, searchQuery, sortValue, status]);

  useEffect(() => {
    (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleApprove(productId) {
    if (!(await confirmAction({ message: "Approve this product?", tone: "danger", confirmLabel: "Confirm" }))) return;
    setBusyId(productId);
    try {
      await approveProduct(productId);
      setSelectedProduct(null);
      setRejectReason("");
      await refresh();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusyId("");
    }
  }

  async function handleReject(productId) {
    if (!rejectReason.trim()) {
      setError("Please provide a rejection reason");
      return;
    }
    if (!(await confirmAction({ message: "Reject this product?", tone: "danger", confirmLabel: "Confirm" }))) return;
    setBusyId(productId);
    try {
      await rejectProduct(productId, rejectReason);
      setSelectedProduct(null);
      setRejectReason("");
      await refresh();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusyId("");
    }
  }

  async function handleDelete(productId) {
    if (!(await confirmAction({ message: "Are you sure you want to delete this product? This action cannot be undone.", tone: "danger", confirmLabel: "Confirm" }))) return;
    setBusyId(productId);
    try {
      await deleteProduct(productId);
      setSelectedProduct(null);
      setRejectReason("");
      await refresh();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusyId("");
    }
  }

  async function handleToggleActive(product) {
    setBusyId(product._id);
    try {
      await updateProduct(product._id, { isActive: !product.isActive });
      await refresh();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusyId("");
    }
  }

  async function handleExport(format) {
    try {
      await reporting.exportReport(format);
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  }

  return (
    <div className="grid min-w-0 max-w-full gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              setStatus("");
              setPage(1);
            }}
            className={`rounded-xl px-3 py-2 text-sm font-medium ${status === "" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200"}`}
          >
            All
          </button>
          {["PENDING", "APPROVED", "REJECTED"].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${status === value ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200"}`}
            >
              {value}
            </button>
          ))}
        </div>
        {isLegacyAdmin || canAccess("products.create") ? (
          <Link
            to={`${basePath}/products/create`}
            className="inline-flex w-full justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:w-auto"
          >
            Create product
          </Link>
        ) : null}
      </div>

      <div className="grid min-w-0 max-w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((item) => (
          <div
            key={item._id}
            className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {item._id}
            </div>
            <div className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">{item.count}</div>
          </div>
        ))}
      </div>

      <ReportingToolbar
        startDate={reporting.startDate}
        endDate={reporting.endDate}
        onDateChange={reporting.setDateRange}
        onApply={reporting.applyDateRange}
        onExport={handleExport}
        exportingFormat={reporting.exportingFormat}
        isDirty={reporting.hasPendingChanges}
      />

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <form onSubmit={handleSearchSubmit} className="flex flex-1 flex-col gap-2 sm:flex-row">
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by product name, SKU, category, or creator"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-950"
            >
              Search
            </button>
          </form>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={sortValue}
              onChange={(event) => {
                setSortValue(event.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setSearchQuery("");
                  setPage(1);
                }}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:text-slate-200"
              >
                Clear search
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800">
          {loading ? (
            <div className="grid gap-3 px-4 py-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-16 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : products.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Image</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Created By</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                  {products.map((product) => (
                    <Fragment key={product._id}>
                      <tr key={product._id} className="align-top">
                        <td className="px-4 py-4">
                          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">
                            {getPrimaryImage(product) ? (
                              <img
                                src={getPrimaryImage(product)}
                                alt={product.name}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <span className="text-[11px] text-slate-400">No image</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-950 dark:text-white">{product.name}</div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {product.SKU || product.productNumber || product._id}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {product.category}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {product.createdBy?.name || product.createdBy?.email || "Admin"}
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-slate-950 dark:text-white">
                          {formatCurrency(product.discountPrice || product.price)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-2">
                            <StatusBadge value={product.status} />
                            <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${product.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>
                              {product.isActive ? "Visible" : "Hidden"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedProduct(selectedProduct === product._id ? null : product._id)
                              }
                              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              {selectedProduct === product._id ? "Hide" : "Review"}
                            </button>
                            <Link
                              to={`${basePath}/products/${product._id}/edit`}
                              className="rounded-xl border border-slate-300 px-3 py-2 text-center text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              Edit
                            </Link>
                            {String(product.creatorType || "").toUpperCase() === "ADMIN" ? (
                              <Link
                                to={`${basePath}/inventory/${product._id}`}
                                className="rounded-xl border border-slate-300 px-3 py-2 text-center text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                Inventory
                              </Link>
                            ) : null}
                            <button
                              type="button"
                              disabled={busyId === product._id}
                              onClick={() => handleToggleActive(product)}
                              className="rounded-xl border border-indigo-300 px-3 py-2 text-center text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
                            >
                              {product.isActive ? "Deactivate" : "Activate"}
                            </button>
                            {isLegacyAdmin || canAccess("products.delete") ? (
                              <button
                                type="button"
                                disabled={busyId === product._id}
                                onClick={() => handleDelete(product._id)}
                                className="rounded-xl border border-red-300 px-3 py-2 text-center text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950"
                              >
                                Delete
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {selectedProduct === product._id ? (
                        <tr key={`${product._id}-details`}>
                          <td colSpan={6} className="border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,.9fr)]">
                              <div className="space-y-3">
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                                  <div className="text-sm font-semibold text-slate-950 dark:text-white">Product details</div>
                                  <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300">
                                    <div className="break-words">{product.description}</div>
                                    <div>Stock: {product.stock}</div>
                                    <div>Created by: {product.createdBy?.email || "Unknown"}</div>
                                    <div>Visibility: {product.isActive ? "Visible" : "Hidden"}</div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                  {(product.images || []).map((image, idx) => (
                                    <div
                                      key={image.url + idx}
                                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                                    >
                                      <img
                                        src={image.url}
                                        alt={image.altText || product.name}
                                        className="h-28 w-full object-contain"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                                <div className="text-sm font-semibold text-slate-950 dark:text-white">Moderation</div>
                                {isLegacyAdmin ? (
                                  <>
                                    <textarea
                                      value={rejectReason}
                                      onChange={(e) => setRejectReason(e.target.value)}
                                      placeholder="Reason for rejection"
                                      className="mt-3 min-h-28 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                    />
                                    <div className="mt-4 flex flex-wrap gap-2 sm:gap-3">
                                      <button
                                        type="button"
                                        disabled={busyId === product._id || product.status === "APPROVED"}
                                        onClick={() => handleApprove(product._id)}
                                        className="w-full rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busyId === product._id}
                                        onClick={() => handleReject(product._id)}
                                        className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200 sm:w-auto"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-300">
                                    Product moderation actions are reserved for legacy admin accounts.
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">No products found.</div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <div>
          Page {page} of {totalPages} • {totalItems} product{totalItems === 1 ? "" : "s"}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage(Math.max(1, page - 1))}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 disabled:opacity-50 dark:border-slate-700 sm:w-auto"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page === totalPages}
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 disabled:opacity-50 dark:border-slate-700 sm:w-auto"
          >
            Next
          </button>
        </div>
      </div>
      <InlineToast toast={reporting.toast} onClose={reporting.clearToast} />
    </div>
  );
}
