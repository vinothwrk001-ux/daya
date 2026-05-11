import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge";
import { cancelUserOrder, downloadUserInvoice, getUserOrders, requestUserReturn } from "../services/userService";
import { formatCurrency } from "../utils/formatCurrency";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Failed to load orders.";
}

export function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function loadOrders(nextStatus = status) {
    setLoading(true);
    try {
      const response = await getUserOrders({ page: 1, limit: 20, ...(nextStatus ? { status: nextStatus } : {}) });
      setOrders(response.data?.orders || []);
      setError("");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    getUserOrders({ page: 1, limit: 20, ...(status ? { status } : {}) })
      .then((response) => {
        setOrders(response.data?.orders || []);
        setError("");
      })
      .catch((err) => {
        setError(normalizeError(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [status]);

  async function cancelOrder(orderId) {
    setBusyId(orderId);
    try {
      await cancelUserOrder(orderId);
      await loadOrders();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusyId("");
    }
  }

  async function requestReturn(orderId) {
    const reason = window.prompt("Reason for return");
    if (!reason) return;

    setBusyId(orderId);
    try {
      await requestUserReturn(orderId, { reason });
      await loadOrders();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusyId("");
    }
  }

  async function downloadInvoice(orderId) {
    setBusyId(orderId);
    try {
      await downloadUserInvoice(orderId);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Orders</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Track orders, download invoices, and manage cancellations or returns.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["", "Pending", "Shipped", "Delivered", "Returned", "Cancelled"].map((value) => (
            <button
              key={value || "all"}
              type="button"
              onClick={() => setStatus(value)}
              className={`rounded-full px-3 py-2 text-xs font-semibold ${
                status === value
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                  : "border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200"
              }`}
            >
              {value || "All"}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : orders.length ? (
        <div className="grid gap-4">
          {orders.map((order) => {
            const canCancel = ["Pending", "Placed"].includes(order.status);
            const canReturn = order.status === "Delivered";

            return (
              <div key={order._id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-slate-950 dark:text-white">{order.orderNumber}</div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {new Date(order.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={order.status} />
                    <StatusBadge value={order.paymentStatus} />
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  {(order.items || []).map((item) => (
                    <div key={`${order._id}-${item.productId}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 dark:text-white">{item.name}</div>
                        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">Quantity: {item.quantity}</div>
                      </div>
                      <div className="text-sm font-semibold text-slate-950 dark:text-white">
                        {formatCurrency(Number(item.price || 0) * Number(item.quantity || 0))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-base font-semibold text-slate-950 dark:text-white">
                    Total: {formatCurrency(order.totalAmount || 0)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === order._id}
                      onClick={() => downloadInvoice(order._id)}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
                    >
                      Download Invoice
                    </button>
                    <Link
                      to={`/orders/${order._id}`}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                    >
                      Track Order
                    </Link>
                    <button
                      type="button"
                      disabled={!canCancel || busyId === order._id}
                      onClick={() => cancelOrder(order._id)}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!canReturn || busyId === order._id}
                      onClick={() => requestReturn(order._id)}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
                    >
                      Return Order
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          No orders found for this filter.
        </div>
      )}
    </div>
  );
}
