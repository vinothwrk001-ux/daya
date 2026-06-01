import { useCallback, useEffect, useMemo, useState } from "react";
import { confirmAction } from "../services/notificationService";
import { Link } from "react-router-dom";
import { deleteOrder, listOrders } from "../services/adminApi";
import { AdminTable } from "../components/AdminTable";
import { ReportingToolbar } from "../components/ReportingToolbar";
import { StatusBadge } from "../components/StatusBadge";
import { InlineToast } from "../components/commerce/InlineToast";
import { useReporting } from "../hooks/useReporting";
import { formatCurrency } from "../utils/formatCurrency";
import { useAdminSession } from "../hooks/useAdminSession";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Request failed";
}

export function AdminOrdersPage() {
  const { basePath, isLegacyAdmin } = useAdminSession();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const reporting = useReporting({
    module: "orders",
    getFilters: () => ({
      ...(status ? { status } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
    }),
    onApply: () => setPage(1),
  });

  const query = useMemo(
    () => ({
      page,
      limit: 10,
      ...(status ? { status } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
      ...reporting.appliedParams,
    }),
    [page, paymentStatus, reporting.appliedParams, search, status]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listOrders(query);
      setOrders(res.data.orders);
      setTotalPages(res.data.pagination.pages || 1);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleDelete(orderId) {
    if (!(await confirmAction({ message: "Soft delete this order?", tone: "danger", confirmLabel: "Confirm" }))) return;
    setBusyId(orderId);
    setError("");
    try {
      await deleteOrder(orderId);
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

  return (
    <div className="grid min-w-0 max-w-full gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {["", "Placed", "Packed", "Shipped", "Out for Delivery", "Delivered", "Cancelled", "Returned"].map((item) => (
            <button
              key={item || "all"}
              type="button"
              onClick={() => {
                setStatus(item);
                setPage(1);
              }}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${
                status === item
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                  : "border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200"
              }`}
            >
              {item || "All"}
            </button>
          ))}
        </div>

        {isLegacyAdmin ? (
          <Link
            to="/admin/orders/create"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Create order
          </Link>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order ID or Order Number or customer name"
            className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Payment</span>
          <select
            value={paymentStatus}
            onChange={(e) => {
              setPaymentStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="">All</option>
            <option value="Pending">Pending</option>
            <option value="Paid">Paid</option>
            <option value="Failed">Failed</option>
          </select>
        </label>
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

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-16 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : orders.length ? (
        <AdminTable
          columns={[
            { key: "id", label: "Order" },
            { key: "user", label: "User" },
            { key: "amount", label: "Amount", align: "right" },
            { key: "shipping", label: "Shipping" },
            { key: "pay", label: "Payment" },
            { key: "status", label: "Status" },
            { key: "date", label: "Date" },
            { key: "actions", label: "Actions", align: "right" },
          ]}
        >
          {orders.map((order) => (
            <tr key={order._id} className="hover:bg-slate-50 dark:hover:bg-slate-950">
              <td className="px-4 py-3">
                <div className="font-semibold text-slate-950 dark:text-white">{order.orderNumber || order._id}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{order._id}</div>
              </td>
              <td className="px-4 py-3">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">{order.userId?.name || "Unknown"}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{order.userId?.email || ""}</div>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">{formatCurrency(order.totalAmount || 0)}</div>
              </td>
              <td className="px-4 py-3">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">{order.shippingMode || "SELF"}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {order.shippingStatus || "NOT_SHIPPED"} {order.pickupStatus ? `· ${order.pickupStatus}` : ""}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {order.courierName || order.deliveryPartner || "Courier pending"}
                </div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge value={order.paymentStatus} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge value={order.status} />
              </td>
              <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                {new Date(order.createdAt).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="inline-flex flex-wrap justify-end gap-2">
                  <Link
                    to={`${basePath}/orders/${order._id}`}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    View / Edit
                  </Link>
                  {isLegacyAdmin ? (
                    <button
                      type="button"
                      disabled={busyId === order._id}
                      onClick={() => handleDelete(order._id)}
                      className="rounded-xl border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:text-rose-200 dark:hover:bg-rose-950/30"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          No orders found.
        </div>
      )}

      <div className="flex flex-col gap-3 text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <div>Page {page} of {totalPages}</div>
        <div className="flex gap-2">
          <button type="button" disabled={page === 1} onClick={() => setPage(Math.max(1, page - 1))} className="w-full rounded-xl border border-slate-300 px-3 py-2 disabled:opacity-50 dark:border-slate-700 sm:w-auto">Previous</button>
          <button type="button" disabled={page === totalPages} onClick={() => setPage(Math.min(totalPages, page + 1))} className="w-full rounded-xl border border-slate-300 px-3 py-2 disabled:opacity-50 dark:border-slate-700 sm:w-auto">Next</button>
        </div>
      </div>
      <InlineToast toast={reporting.toast} onClose={reporting.clearToast} />
    </div>
  );
}
