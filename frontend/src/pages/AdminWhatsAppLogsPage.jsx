import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getWhatsAppLogs, retryWhatsAppLog } from "../services/adminApi";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminSession } from "../hooks/useAdminSession";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Request failed";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export function AdminWhatsAppLogsPage() {
  const { basePath } = useAdminSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 });
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [retryingId, setRetryingId] = useState("");

  async function loadLogs() {
    setLoading(true);
    setError("");
    try {
      const response = await getWhatsAppLogs({
        page: pagination.page,
        limit: pagination.limit,
        status: status || undefined,
        search: search || undefined,
      });
      const payload = response?.data ?? response;
      setLogs(payload?.logs || []);
      setPagination(payload?.pagination || pagination);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await getWhatsAppLogs({
          page: pagination.page,
          limit: pagination.limit,
          status: status || undefined,
          search: search || undefined,
        });
        const payload = response?.data ?? response;
        if (cancelled) return;
        setLogs(payload?.logs || []);
        setPagination(payload?.pagination || pagination);
      } catch (err) {
        if (!cancelled) setError(normalizeError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [pagination.page, pagination.limit, status, search]);

  async function onRetry(logId) {
    setRetryingId(logId);
    setError("");
    try {
      await retryWhatsAppLog(logId);
      await loadLogs();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setRetryingId("");
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Communications</div>
        <h1 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">WhatsApp Logs</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Track shipment notifications, delivery status, and retry attempts.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => {
            setPagination((current) => ({ ...current, page: 1 }));
            setSearch(e.target.value);
          }}
          placeholder="Search phone, SID, or error"
          className="min-w-[220px] flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
        <select
          value={status}
          onChange={(e) => {
            setPagination((current) => ({ ...current, page: 1 }));
            setStatus(e.target.value);
          }}
          className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        >
          <option value="">All statuses</option>
          <option value="Queued">Queued</option>
          <option value="Sent">Sent</option>
          <option value="Delivered">Delivered</option>
          <option value="Read">Read</option>
          <option value="Retrying">Retrying</option>
          <option value="Failed">Failed</option>
        </select>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Retries</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3">Error</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={index} className="border-b border-slate-100 dark:border-slate-800">
                    <td colSpan={9} className="px-4 py-4">
                      <div className="h-5 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                    </td>
                  </tr>
                ))
              ) : logs.length ? (
                logs.map((log) => (
                  <tr key={log._id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-4">
                      {log.orderId?._id ? (
                        <Link
                          to={`${basePath}/orders/${log.orderId._id}`}
                          className="font-medium text-slate-950 hover:underline dark:text-white"
                        >
                          {log.orderId?.orderNumber || log.orderId._id}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-4">{log.customerId?.name || "-"}</td>
                    <td className="px-4 py-4">{log.phone || "-"}</td>
                    <td className="px-4 py-4 capitalize">{log.messageType || "-"}</td>
                    <td className="px-4 py-4">
                      <StatusBadge value={log.status} />
                    </td>
                    <td className="px-4 py-4">{log.retryCount || 0}</td>
                    <td className="px-4 py-4">{formatDate(log.sentAt || log.createdAt)}</td>
                    <td className="max-w-xs truncate px-4 py-4 text-xs text-rose-600 dark:text-rose-300">
                      {log.lastError || "-"}
                    </td>
                    <td className="px-4 py-4">
                      {["Failed", "Retrying", "Queued"].includes(log.status) ? (
                        <button
                          type="button"
                          disabled={retryingId === log._id}
                          onClick={() => onRetry(log._id)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          {retryingId === log._id ? "Retrying..." : "Retry"}
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    No WhatsApp logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
        <span>
          Page {pagination.page} of {pagination.pages} · {pagination.total} total
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading || pagination.page <= 1}
            onClick={() => setPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
            className="rounded-xl border border-slate-300 px-3 py-2 disabled:opacity-50 dark:border-slate-700"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={loading || pagination.page >= pagination.pages}
            onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}
            className="rounded-xl border border-slate-300 px-3 py-2 disabled:opacity-50 dark:border-slate-700"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
