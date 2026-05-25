import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { approveSeller, listSellers, moderateVendorStore, rejectSeller } from "../services/adminApi";
import { ReportingToolbar } from "../components/ReportingToolbar";
import { StatusBadge } from "../components/StatusBadge";
import { InlineToast } from "../components/commerce/InlineToast";
import { useReporting } from "../hooks/useReporting";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Request failed";
}

const PAGE_SIZE = 8;

export function AdminSellersPage() {
  const [loading, setLoading] = useState(true);
  const [sellers, setSellers] = useState([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState("");
  const reporting = useReporting({
    module: "sellers",
    getFilters: () => ({ ...(status ? { status } : {}) }),
    onApply: () => setPage(1),
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await listSellers({
          ...(status ? { status } : {}),
          ...reporting.appliedParams,
        });
        if (alive) setSellers(res.data);
      } catch (err) {
        if (alive) setError(normalizeError(err));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [reporting.appliedParams, status]);

  const pageCount = Math.max(1, Math.ceil(sellers.length / PAGE_SIZE));
  const pageItems = useMemo(
    () => sellers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [page, sellers]
  );

  useEffect(() => {
    setPage(1);
  }, [status, sellers.length]);

  async function handleApprove(id) {
    setBusyId(id);
    setError("");
    try {
      const res = await approveSeller(id);
      setSellers((current) => current.map((item) => (item._id === id ? res.data : item)));
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusyId("");
    }
  }

  async function handleReject(id) {
    const reason = window.prompt("Rejection reason") || "";
    setBusyId(id);
    setError("");
    try {
      const res = await rejectSeller(id, reason);
      setSellers((current) => current.map((item) => (item._id === id ? res.data : item)));
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusyId("");
    }
  }

  async function handleStoreModeration(id, action) {
    setBusyId(id);
    setError("");
    try {
      await moderateVendorStore(id, { action });
      const res = await listSellers({
        ...(status ? { status } : {}),
        ...reporting.appliedParams,
      });
      setSellers(res.data);
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

  return (
    <div className="grid min-w-0 max-w-full gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          <option value="">All applications</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="draft">Draft</option>
        </select>
        <div className="text-sm text-slate-500 dark:text-slate-400">Applications: {sellers.length}</div>
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

      <div className="grid gap-4 xl:grid-cols-2">
        {loading ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-40 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800" />
          ))
        ) : pageItems.length ? (
          pageItems.map((seller) => (
            <div
              key={seller._id}
              className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-slate-950 dark:text-white sm:text-lg">
                    {seller.companyName || "Unnamed seller"}
                  </div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {seller.userId?.name || "Unknown"} • {seller.userId?.email || "No email"}
                  </div>
                </div>
                <StatusBadge value={seller.status} />
              </div>

              <div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300">
                <div>Vendor ID: {seller.vendorCode || seller._id}</div>
                <div>Step completed: {seller.stepCompleted || 0}/4</div>
                <div>Shop: {seller.shopName || "Not submitted yet"}</div>
                <div>GST: {seller.noGst ? "No GST" : seller.gstNumber || "Not provided"}</div>
              </div>

              {seller.rejectionReason ? (
                <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                  {seller.rejectionReason}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2 sm:gap-3">
                <Link
                  to={`/admin/sellers/${seller._id}`}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
                >
                  View details
                </Link>
                <Link
                  to={`/admin/vendors/${seller._id}/finance`}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
                >
                  Finance details
                </Link>
                <button
                  type="button"
                  disabled={busyId === seller._id || seller.status === "approved"}
                  onClick={() => handleApprove(seller._id)}
                  className="w-full rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === seller._id || seller.status === "rejected"}
                  onClick={() => handleReject(seller._id)}
                  className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200 sm:w-auto"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={busyId === seller._id}
                  onClick={() => handleStoreModeration(seller._id, seller.isStoreFeatured ? "unfeature" : "feature")}
                  className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50 sm:w-auto"
                >
                  {seller.isStoreFeatured ? "Unfeature Store" : "Feature Store"}
                </button>
                <button
                  type="button"
                  disabled={busyId === seller._id}
                  onClick={() => handleStoreModeration(seller._id, seller.isStoreVisible === false ? "show" : "hide")}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 sm:w-auto"
                >
                  {seller.isStoreVisible === false ? "Show Store" : "Hide Store"}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400 xl:col-span-2">
            No seller applications found.
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={pageCount} onChange={setPage} />
      <InlineToast toast={reporting.toast} onClose={reporting.clearToast} />
    </div>
  );
}

function Pagination({ page, totalPages, onChange }) {
  return (
    <div className="flex flex-col gap-3 text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
      <div>Page {page} of {totalPages}</div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => onChange(Math.max(1, page - 1))}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 disabled:opacity-50 dark:border-slate-700 sm:w-auto"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 disabled:opacity-50 dark:border-slate-700 sm:w-auto"
        >
          Next
        </button>
      </div>
    </div>
  );
}
