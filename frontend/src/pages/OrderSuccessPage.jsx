import { Link, Navigate, useLocation } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge";
import { formatCurrency } from "../utils/formatCurrency";

const CHECKOUT_SUCCESS_STORAGE_KEY = "checkoutSuccessPayload";

function loadPersistedCheckoutSuccessPayload() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_SUCCESS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    window.sessionStorage.removeItem(CHECKOUT_SUCCESS_STORAGE_KEY);
    return parsed;
  } catch {
    window.sessionStorage.removeItem(CHECKOUT_SUCCESS_STORAGE_KEY);
    return null;
  }
}

export function OrderSuccessPage() {
  const location = useLocation();
  const state = location.state || loadPersistedCheckoutSuccessPayload() || {};
  const orders = state.orders || [];
  const payment = state.payment || null;
  const isCod = (orders[0]?.paymentMethod || payment?.method || "ONLINE") === "COD";
  const codPayable = orders.reduce((sum, order) => sum + Number(order?.totalAmount || 0), 0);

  if (!orders.length) {
    return <Navigate to="/orders" replace />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Order confirmed</div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Your order is in the system.</h1>
        <p className="mt-2 text-sm text-slate-600">
          {isCod
            ? `Please keep ${formatCurrency(codPayable)} ready for delivery. You can track every vendor shipment from your orders page.`
            : "Payment status and order routing have been recorded. You can track every vendor shipment from your orders page."}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Orders created" value={String(orders.length)} />
        <StatCard label="Payment method" value={orders[0]?.paymentMethod || payment?.method || "ONLINE"} />
        <StatCard label={isCod ? "Payable on delivery" : "Payment status"} value={isCod ? formatCurrency(codPayable) : (orders[0]?.paymentStatus || payment?.status || "Pending")} />
      </section>

      {isCod ? (
        <section className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Cash on Delivery instructions: collectable amount is {formatCurrency(codPayable)}. Our delivery or operations team may contact you before dispatch to confirm the order.
        </section>
      ) : null}

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Order summary</h2>
        <div className="mt-4 grid gap-3">
          {orders.map((order) => (
            <div key={order._id} className="rounded-xl border border-slate-200 px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold text-slate-950">{order.orderNumber}</div>
                  <div className="mt-1 text-sm text-slate-500">{order.items?.length || 0} items</div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge value={order.paymentStatus} />
                  <div className="font-semibold text-slate-950">{formatCurrency(order.totalAmount || 0)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link to="/orders" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Go to orders</Link>
        <Link to="/shop" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Continue shopping</Link>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}
