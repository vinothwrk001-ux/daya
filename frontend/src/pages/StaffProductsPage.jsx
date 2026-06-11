import { useCallback, useEffect, useState } from "react";
import { confirmAction } from "../services/notificationService";
import { Link } from "react-router-dom";
import { deleteProduct, getProductStats, listProducts } from "../services/adminApi";
import { StatusBadge } from "../components/StatusBadge";
import { useStaffPermission } from "../hooks/useStaffAuth";

const SORT_OPTIONS = [
  { value: "createdAt-desc", label: "Newest first" },
  { value: "createdAt-asc", label: "Oldest first" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "price-desc", label: "Price high-low" },
  { value: "price-asc", label: "Price low-high" },
  { value: "status-asc", label: "Status A-Z" },
];

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

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

export function StaffProductsPage() {
  const { hasPermission } = useStaffPermission();
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [sortValue, setSortValue] = useState("createdAt-desc");
  const canCreateProducts = hasPermission("products.create");
  const canUpdateProducts = hasPermission("products.update");
  const canDeleteProducts = hasPermission("products.delete");

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { sortBy, sortOrder } = getSortState(sortValue);
      const [productsResponse, statsResponse] = await Promise.all([
        listProducts({
          page,
          limit: 12,
          sortBy,
          sortOrder,
          ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
        }),
        getProductStats(),
      ]);

      setProducts(productsResponse.data?.products || []);
      setTotalPages(productsResponse.data?.pagination?.pages || 1);
      setTotalItems(productsResponse.data?.pagination?.total || 0);
      setStats(statsResponse.data?.countByStatus || []);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, sortValue]);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!active) return;
      await loadProducts();
    })();

    return () => {
      active = false;
    };
  }, [loadProducts]);

  async function handleDelete(productId) {
    if (!(await confirmAction({ message: "Delete this product?", tone: "danger", confirmLabel: "Confirm" }))) return;
    setBusyId(productId);
    setError("");
    try {
      await deleteProduct(productId);
      await loadProducts();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusyId("");
    }
  }

  function handleSearchSubmit(event) {
    if (event?.preventDefault) event.preventDefault();
    setPage(1);
    setSearchTerm(searchInput.trim());
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="mt-1 text-slate-600">Catalog operations and moderation visibility based on product permissions.</p>
        </div>
        <div className="flex items-center gap-3">
          {canCreateProducts ? (
            <Link
              to="/staff/products/create"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <PlusIcon className="h-4 w-4" />
              Create Product
            </Link>
          ) : null}
          <div className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            {totalItems} product{totalItems === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {stats.length ? (
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((item) => (
            <div key={item._id} className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{item._id}</div>
              <div className="mt-2 text-3xl font-semibold text-slate-950">{item.count}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search products"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="w-full rounded-[1.25rem] border border-slate-200 py-3 pl-10 pr-4 text-sm"
          />
        </form>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={sortValue}
            onChange={(event) => {
              setSortValue(event.target.value);
              setPage(1);
            }}
            className="rounded-[1.25rem] border border-slate-200 px-4 py-3 text-sm"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSearchSubmit}
            className="rounded-[1.25rem] border border-slate-200 px-4 py-3 text-sm font-medium hover:bg-slate-50"
          >
            Search
          </button>
          {searchTerm ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearchTerm("");
                setPage(1);
              }}
              className="rounded-[1.25rem] border border-slate-200 px-4 py-3 text-sm font-medium hover:bg-slate-50"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="grid gap-3 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : products.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Image</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Created By</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {products.map((product) => (
                  <tr key={product._id} className="align-top">
                    <td className="px-4 py-4">
                      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                        {getPrimaryImage(product) ? (
                          <img src={getPrimaryImage(product)} alt={product.name} className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-[11px] text-slate-400">No image</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-950">{product.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{product.SKU || product.productNumber || product._id}</div>
                      <div className="mt-1 text-xs text-slate-500">{product.category || "Uncategorized"}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">{product.createdBy?.name || product.createdBy?.email || "Admin"}</td>
                    <td className="px-4 py-4 font-semibold text-slate-950">${Number(product.discountPrice || product.price || 0).toFixed(2)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-2">
                        <StatusBadge value={product.status} />
                        <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${product.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                          {product.isActive ? "Visible" : "Hidden"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {canUpdateProducts ? (
                          <Link
                            to={`/staff/products/${product._id}/edit`}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <EditIcon className="h-3.5 w-3.5" />
                            Edit
                          </Link>
                        ) : null}
                        {canDeleteProducts ? (
                          <button
                            type="button"
                            disabled={busyId === product._id}
                            onClick={() => handleDelete(product._id)}
                            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                            {busyId === product._id ? "Deleting..." : "Delete"}
                          </button>
                        ) : null}
                        {!canUpdateProducts && !canDeleteProducts ? <span className="text-xs text-slate-400">No actions</span> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-12 text-center text-sm text-slate-500">No products found.</div>
        )}
      </div>

      <div className="flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div>
          Page {page} of {totalPages} | {totalItems} product{totalItems === 1 ? "" : "s"}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-xl border border-slate-200 px-3 py-2 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            className="rounded-xl border border-slate-200 px-3 py-2 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function IconBase({ className = "h-4 w-4", children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function SearchIcon({ className = "h-4 w-4" }) {
  return (
    <IconBase className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </IconBase>
  );
}

function TrashIcon({ className = "h-4 w-4" }) {
  return (
    <IconBase className={className}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 10v6" />
      <path d="M14 10v6" />
    </IconBase>
  );
}

function PlusIcon({ className = "h-4 w-4" }) {
  return (
    <IconBase className={className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  );
}

function EditIcon({ className = "h-4 w-4" }) {
  return (
    <IconBase className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </IconBase>
  );
}
