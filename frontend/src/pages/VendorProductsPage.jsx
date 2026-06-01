import { useCallback, useEffect, useState } from "react";
import { confirmAction } from "../services/notificationService";
import { Link } from "react-router-dom";
import { ReportingToolbar } from "../components/ReportingToolbar";
import { InlineToast } from "../components/commerce/InlineToast";
import { useReporting } from "../hooks/useReporting";
import { StatusBadge } from "../components/StatusBadge";
import { formatCurrency } from "../utils/formatCurrency";
import { VendorDataTable, VendorSection } from "../components/VendorPanel";
import { useModuleAccess } from "../context/VendorModuleContext";
import * as vendorDashboardService from "../services/vendorDashboardService";

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

export function VendorProductsPage() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortValue, setSortValue] = useState("createdAt-desc");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const { can } = useModuleAccess();
  const reporting = useReporting({
    module: "products",
    getFilters: () => ({
      ...(status ? { status } : {}),
      ...(search ? { search } : {}),
    }),
    onApply: () => setPage(1),
  });

  const load = useCallback(async () => {
    try {
      const { sortBy, sortOrder } = getSortState(sortValue);
      const response = await vendorDashboardService.getVendorProducts({
        status,
        search,
        page,
        limit: 20,
        sortBy,
        sortOrder,
        ...reporting.appliedParams,
      });
      setData(response.data);
      setError("");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load products.");
    }
  }, [page, reporting.appliedParams, search, sortValue, status]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  async function handleExport(format) {
    try {
      await reporting.exportReport(format);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to export products.");
    }
  }

  async function handleDelete(productId, productName) {
    if (!(await confirmAction({
      title: "Delete product",
      message: `Delete "${productName}" permanently? This cannot be undone.`,
      tone: "danger",
      confirmLabel: "Delete product",
    }))) {
      return;
    }

    setDeletingId(productId);
    setError("");
    try {
      await vendorDashboardService.deleteVendorProduct(productId);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete product.");
    } finally {
      setDeletingId("");
    }
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <div className="grid gap-6">
      <VendorSection
        title="Catalog Management"
        description="Add, edit, archive, and monitor product approval status."
        action={
          can("products.create") ? (
            <Link to="/vendor/products/create" className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-950">
              New Product
            </Link>
          ) : null
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {["", "PENDING", "APPROVED", "REJECTED"].map((item) => (
            <button
              key={item || "all"}
              onClick={() => {
                setStatus(item);
                setPage(1);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status === item ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
            >
              {item || "ALL"}
            </button>
          ))}
        </div>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <form onSubmit={handleSearchSubmit} className="flex flex-1 flex-col gap-2 sm:flex-row">
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by product name, SKU, or category"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-0 focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
            />
            <button type="submit" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
              Search
            </button>
            {search ? (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Clear
              </button>
            ) : null}
          </form>
          <select
            value={sortValue}
            onChange={(event) => {
              setSortValue(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <ReportingToolbar
            startDate={reporting.startDate}
            endDate={reporting.endDate}
            onDateChange={reporting.setDateRange}
            onApply={reporting.applyDateRange}
            onExport={handleExport}
            exportingFormat={reporting.exportingFormat}
            isDirty={reporting.hasPendingChanges}
          />
        </div>
        {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        <VendorDataTable
          rows={(data?.products || []).map((product) => ({
            id: product._id,
            image: getPrimaryImage(product),
            name: product.name,
            category: product.category,
            price: formatCurrency(product.discountPrice || product.price),
            stock: product.stock,
            status: product.status,
            isActive: product.isActive,
            approval: product.rejectionReason || "Awaiting admin review",
            rawName: product.name,
          }))}
          columns={[
            {
              key: "image",
              label: "Image",
              render: (row) => (
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
                  {row.image ? (
                    <img src={row.image} alt={row.name} className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-[11px] text-slate-400">No image</span>
                  )}
                </div>
              ),
            },
            {
              key: "name",
              label: "Name",
              render: (row) => (
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">{row.name}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{row.category || "Uncategorized"}</div>
                </div>
              ),
            },
            { key: "price", label: "Price" },
            { key: "stock", label: "Stock" },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <div className="flex flex-col gap-2">
                  <StatusBadge value={row.status} />
                  <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${row.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>
                    {row.isActive ? "Visible" : "Hidden"}
                  </span>
                </div>
              ),
            },
            { key: "approval", label: "Note" },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                can("products.update") || can("products.delete") ? (
                  <div className="flex flex-wrap gap-2">
                    {can("products.update") ? (
                      <Link to={`/vendor/products/${row.id}/edit`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                        Edit
                      </Link>
                    ) : null}
                    {can("products.delete") ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(row.id, row.rawName)}
                        disabled={deletingId === row.id}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
                      >
                        {deletingId === row.id ? "Deleting..." : "Delete"}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">No actions</span>
                )
              ),
            },
          ]}
        />
        <div className="mt-4 flex flex-col gap-3 text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Page {data?.pagination?.page || page} of {data?.pagination?.pages || 1} | {data?.pagination?.total || 0} product{(data?.pagination?.total || 0) === 1 ? "" : "s"}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={(data?.pagination?.page || page) <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-xl border border-slate-200 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={(data?.pagination?.page || page) >= (data?.pagination?.pages || 1)}
              onClick={() => setPage((current) => Math.min(data?.pagination?.pages || 1, current + 1))}
              className="rounded-xl border border-slate-200 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700"
            >
              Next
            </button>
          </div>
        </div>
        <InlineToast toast={reporting.toast} onClose={reporting.clearToast} />
      </VendorSection>
    </div>
  );
}
