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

      {orders.map((order) => (
        <section key={order._id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-6">
            {/* Order Header */}
            <div className="border-b border-slate-200 pb-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm text-slate-500">Order number</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-950">{order.orderNumber}</div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge value={order.status} />
                  <StatusBadge value={order.paymentStatus} />
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                <div>
                  <span className="text-slate-500">Placed at:</span> {new Date(order.createdAt).toLocaleString()}
                </div>
                {order.invoiceNumber && (
                  <div>
                    <span className="text-slate-500">Invoice:</span> {order.invoiceNumber}
                  </div>
                )}
                {order.estimatedDelivery && (
                  <div>
                    <span className="text-slate-500">Est. delivery:</span> {new Date(order.estimatedDelivery).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>

            {/* Order Items */}
            <div>
              <h3 className="font-semibold text-slate-950">Order items ({order.items?.length || 0})</h3>
              <div className="mt-3 grid gap-3">
                {(order.items || []).map((item, idx) => (
                  <div key={idx} className="flex gap-4 rounded-xl border border-slate-200 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-950">{item.name}</div>
                      {item.variantName && (
                        <div className="mt-1 text-xs text-slate-500">{item.variantName}</div>
                      )}
                      <div className="mt-2 flex items-center gap-4 text-sm text-slate-600">
                        <span>Qty: {item.quantity}</span>
                        <span>Unit: {formatCurrency(item.unitPrice || 0)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-950">{formatCurrency(item.total || 0)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shipping Address */}
            {order.shippingAddress && (
              <div className="border-t border-slate-200 pt-5">
                <h3 className="font-semibold text-slate-950">Delivery address</h3>
                <div className="mt-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
                  <div className="font-medium text-slate-950">{order.shippingAddress.fullName}</div>
                  <div className="mt-2 space-y-1 text-slate-600">
                    {order.shippingAddress.line1 && <div>{order.shippingAddress.line1}</div>}
                    {order.shippingAddress.line2 && <div>{order.shippingAddress.line2}</div>}
                    <div>
                      {order.shippingAddress.city}
                      {order.shippingAddress.state && `, ${order.shippingAddress.state}`}
                      {order.shippingAddress.postalCode && ` - ${order.shippingAddress.postalCode}`}
                    </div>
                    {order.shippingAddress.country && <div>{order.shippingAddress.country}</div>}
                    {order.shippingAddress.phone && <div className="mt-2">Phone: {order.shippingAddress.phone}</div>}
                  </div>
                </div>
              </div>
            )}

            {/* Price Breakdown */}
            <div className="border-t border-slate-200 pt-5">
              <h3 className="font-semibold text-slate-950">Price breakdown</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(order.pricing?.subtotal || 0)}</span>
                </div>
                {order.pricing?.tax > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tax</span>
                    <span>{formatCurrency(order.pricing.tax)}</span>
                  </div>
                )}
                {order.pricing?.shipping > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Shipping</span>
                    <span>{formatCurrency(order.pricing.shipping)}</span>
                  </div>
                )}
                {order.pricing?.discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(order.pricing.discount)}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold text-slate-950">
                  <span>Total</span>
                  <span>{formatCurrency(order.totalAmount || 0)}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="border-t border-slate-200 pt-5 flex flex-wrap gap-2">
              <Link
                to={`/orders/${order._id}`}
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-slate-200"
              >
                View full details
              </Link>
              <a
                href={`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/user/orders/${order._id}/invoice`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Download invoice
              </a>
            </div>
          </div>
        </section>
      ))}

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
