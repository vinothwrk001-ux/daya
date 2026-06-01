import { useCallback, useEffect, useState } from "react";
import { confirmAction } from "../services/notificationService";
import { BackButton } from "../components/BackButton";
import { useNavigate } from "react-router-dom";
import { useModuleAccess } from "../context/VendorModuleContext";
import * as productService from "../services/productService";
import { formatCurrency } from "../utils/formatCurrency";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Request failed";
}

const STATUS_COLORS = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

export function SellerProductsPage() {
  const navigate = useNavigate();
  const { can } = useModuleAccess();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(""); // All statuses
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isDeleting, setIsDeleting] = useState(null);

  const refresh = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (selectedStatus) params.status = selectedStatus;

      const res = await productService.getProducts(params);
      setProducts(res.data.products);
      setTotalPages(res.data.pagination.pages);
    } catch (e) {
      setError(normalizeError(e));
    } finally {
      setLoading(false);
    }
  }, [page, selectedStatus]);

  useEffect(() => {
    (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function deleteProduct(productId) {
    if (!(await confirmAction({ message: "Delete this product?", tone: "danger", confirmLabel: "Confirm" }))) return;
    setIsDeleting(productId);
    try {
      await productService.deleteProduct(productId);
      setError("");
      await refresh();
    } catch (e) {
      setError(normalizeError(e));
    } finally {
      setIsDeleting(null);
    }
  }

  if (loading && !products.length)
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
        <div className="text-sm text-slate-600">Loading your products...</div>
      </div>
    );

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your Products</h1>
          <p className="mt-1 text-sm text-slate-600">Create and manage your products</p>
        </div>
        <div className="flex items-center gap-3">
          <BackButton fallbackTo="/dashboard/vendor" />
          <button
            onClick={() => navigate("/seller/products/create")}
            disabled={!can("products.create")}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add Product
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filter by Status - Responsive */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setSelectedStatus("");
            setPage(1);
          }}
          className={`rounded px-2 sm:px-3 py-1 text-xs sm:text-sm ${
            selectedStatus === ""
              ? "bg-blue-600 text-white"
              : "border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          All
        </button>
        <button
          onClick={() => {
            setSelectedStatus("PENDING");
            setPage(1);
          }}
          className={`rounded px-2 sm:px-3 py-1 text-xs sm:text-sm ${
            selectedStatus === "PENDING"
              ? "bg-yellow-600 text-white"
              : "border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          Pending
        </button>
        <button
          onClick={() => {
            setSelectedStatus("APPROVED");
            setPage(1);
          }}
          className={`rounded px-2 sm:px-3 py-1 text-xs sm:text-sm ${
            selectedStatus === "APPROVED"
              ? "bg-green-600 text-white"
              : "border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          Approved
        </button>
        <button
          onClick={() => {
            setSelectedStatus("REJECTED");
            setPage(1);
          }}
          className={`rounded px-2 sm:px-3 py-1 text-xs sm:text-sm ${
            selectedStatus === "REJECTED"
              ? "bg-red-600 text-white"
              : "border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          Rejected
        </button>
      </div>

      {/* Products List */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
        {products.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No products yet. Create your first product!
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {products.map((product) => (
              <div
                key={product._id}
                className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4 px-3 sm:px-6 py-3 sm:py-4"
              >
                {/* Product Image & Info */}
                <div className="flex gap-3 flex-1 min-w-0 w-full sm:w-auto">
                  {product.images?.[0]?.url && (
                    <div className="h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 overflow-hidden rounded border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800">
                      <img
                        src={product.images[0].url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.target.src = "https://via.placeholder.com/80?text=No+Image";
                        }}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="truncate">
                      <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{product.name}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                        Product Number: {product.productNumber || product.SKU}
                      </div>
                    </div>

                    <div className="mt-2 flex gap-2 flex-wrap">
                      <span className={`rounded px-2 py-1 text-xs font-medium flex-shrink-0 ${STATUS_COLORS[product.status]}`}>
                        {product.status}
                      </span>
                      {!product.isActive && (
                        <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 flex-shrink-0">
                          Hidden
                        </span>
                      )}
                    </div>

                    {/* Rejection Reason */}
                    {product.status === "REJECTED" && product.rejectionReason && (
                      <div className="mt-2 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-2 text-xs text-red-800 dark:text-red-200">
                        <span className="font-semibold">Rejection:</span> <span className="line-clamp-2">{product.rejectionReason}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Price & Stock - Mobile: Below, Desktop: Right */}
                <div className="w-full sm:w-auto sm:text-right flex justify-between sm:flex-col gap-2">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 sm:hidden">Price</div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white">{formatCurrency(product.price)}</div>
                    {product.discountPrice && (
                      <div className="text-xs text-green-600 dark:text-green-400">{formatCurrency(product.discountPrice)}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 sm:hidden">Stock</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Stock: <span className="font-medium text-slate-900 dark:text-white">{product.stock}</span>
                    </div>
                  </div>
                </div>

                {/* Actions - Responsive Buttons */}
                <div className="flex gap-1 sm:gap-2 flex-wrap sm:flex-col w-full sm:w-auto">
                  <button
                    onClick={() => navigate(`/seller/products/${product._id}/edit`)}
                    disabled={!can("products.update")}
                    className="flex-1 sm:flex-none rounded border border-blue-300 dark:border-blue-600 px-2 sm:px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteProduct(product._id)}
                    disabled={isDeleting === product._id || !can("products.delete")}
                    className="flex-1 sm:flex-none rounded border border-red-300 dark:border-red-600 px-2 sm:px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50 transition-colors"
                  >
                    {isDeleting === product._id ? "..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination - Mobile Responsive */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          <div className="text-center sm:text-left">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
