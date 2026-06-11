import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge";
import * as paymentService from "../services/paymentService";
import * as userService from "../services/userService";
import { formatCurrency } from "../utils/formatCurrency";

const CHECKOUT_SUCCESS_STORAGE_KEY = "checkoutSuccessPayload";

function persistCheckoutSuccessPayload(payload) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(CHECKOUT_SUCCESS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore session storage failures.
  }
}

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

function getCurrency(order) {
  return order?.pricing?.currency || order?.priceBreakdown?.currency || order?.currency || "INR";
}

function getItemUnitPrice(item) {
  return Number(item?.unitPrice ?? item?.price ?? 0);
}

function getItemTotal(item) {
  if (item?.total !== undefined && item?.total !== null) {
    return Number(item.total || 0);
  }
  return getItemUnitPrice(item) * Number(item?.quantity || 0);
}

function getOrderSubtotal(order) {
  return Number(
    order?.pricing?.subtotal ??
      order?.priceBreakdown?.subtotal ??
      order?.pricingSnapshot?.subtotal ??
      order?.subtotal ??
      0
  );
}

function getOrderTax(order) {
  return Number(
    order?.pricing?.tax ??
      order?.pricing?.taxes ??
      order?.priceBreakdown?.taxAmount ??
      order?.taxAmount ??
      0
  );
}

function getOrderShipping(order) {
  return Number(
    order?.pricing?.shipping ??
      order?.pricing?.deliveryFee ??
      order?.priceBreakdown?.shippingFee ??
      order?.shippingFee ??
      0
  );
}

function getOrderDiscount(order) {
  return Number(
    order?.pricing?.discount ??
      order?.pricing?.discounts ??
      order?.priceBreakdown?.discountAmount ??
      order?.discountAmount ??
      0
  );
}

export function OrderSuccessPage() {
  const location = useLocation();
  const baseState = location.state || loadPersistedCheckoutSuccessPayload() || {};
  const [state, setState] = useState(baseState);
  const orders = state.orders || [];
  const payment = state.payment || null;
  const processing = Boolean(state.processing);
  const isCod = (orders[0]?.paymentMethod || payment?.method || "ONLINE") === "COD";
  const codPayable = orders.reduce((sum, order) => sum + Number(order?.totalAmount || 0), 0);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState("");

  useEffect(() => {
    if (!processing) return undefined;

    let active = true;

    async function settleSuccessState() {
      const verificationPayload = state.verificationPayload || null;

      if (verificationPayload) {
        for (let attempt = 1; attempt <= 4 && active; attempt += 1) {
          try {
            const verified = await paymentService.verifyRazorpayPayment(verificationPayload);
            const nextState = {
              orders: verified?.orders || [],
              payment: verified?.payment || null,
            };
            persistCheckoutSuccessPayload(nextState);
            if (active) setState(nextState);
            return;
          } catch {
            await new Promise((resolve) => window.setTimeout(resolve, 1500 * attempt));
          }
        }
      }

      for (let attempt = 1; attempt <= 4 && active; attempt += 1) {
        try {
          const response = await userService.getUserOrders({ page: 1, limit: 5 });
          const nextOrders = response?.data?.orders || [];
          if (nextOrders.length) {
            const nextState = {
              orders: nextOrders,
              payment: payment || null,
            };
            persistCheckoutSuccessPayload(nextState);
            if (active) setState(nextState);
            return;
          }
        } catch {
          // Keep retrying briefly while backend finishes settling the order state.
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1500 * attempt));
      }
    }

    settleSuccessState();
    return () => {
      active = false;
    };
  }, [payment, processing, state.verificationPayload]);

  if (!orders.length && !processing) {
    return <Navigate to="/orders" replace />;
  }

  async function handleDownloadInvoice(orderId) {
    setDownloadingInvoiceId(orderId);
    try {
      await userService.downloadUserInvoice(orderId);
    } finally {
      setDownloadingInvoiceId("");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Order confirmed</div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Your order is in the system.</h1>
        <p className="mt-2 text-sm text-slate-600">
          {processing
            ? "Payment was successful. We are finishing verification and loading your order summary now."
            : isCod
            ? `Please keep ${formatCurrency(codPayable)} ready for delivery. You can track every shipment from your orders page.`
            : "Payment status and order routing have been recorded. You can track every shipment from your orders page."}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Orders created" value={String(orders.length)} />
        <StatCard label="Payment method" value={orders[0]?.paymentMethod || payment?.method || "ONLINE"} />
        <StatCard label={isCod ? "Payable on delivery" : "Payment status"} value={isCod ? formatCurrency(codPayable) : (orders[0]?.paymentStatus || payment?.status || "Pending")} />
      </section>

      {processing && !orders.length ? (
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-600">
          Loading your order summary...
        </section>
      ) : null}

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
                        <span>Unit: {formatCurrency(getItemUnitPrice(item), { currency: getCurrency(order) })}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-950">{formatCurrency(getItemTotal(item), { currency: getCurrency(order) })}</div>
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
                  <span>{formatCurrency(getOrderSubtotal(order), { currency: getCurrency(order) })}</span>
                </div>
                {getOrderTax(order) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tax</span>
                    <span>{formatCurrency(getOrderTax(order), { currency: getCurrency(order) })}</span>
                  </div>
                )}
                {getOrderShipping(order) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Shipping</span>
                    <span>{formatCurrency(getOrderShipping(order), { currency: getCurrency(order) })}</span>
                  </div>
                )}
                {getOrderDiscount(order) > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(getOrderDiscount(order), { currency: getCurrency(order) })}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold text-slate-950">
                  <span>Total</span>
                  <span>{formatCurrency(order.totalAmount || 0, { currency: getCurrency(order) })}</span>
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
              <button
                type="button"
                onClick={() => handleDownloadInvoice(order._id)}
                disabled={downloadingInvoiceId === order._id}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {downloadingInvoiceId === order._id ? "Downloading..." : "Download invoice"}
              </button>
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
