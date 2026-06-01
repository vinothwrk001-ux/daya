import { useEffect, useMemo, useState } from "react";
import { requestInput } from "../services/notificationService";
import { Link, useParams } from "react-router-dom";
import { CancelOrderModal } from "../components/CancelOrderModal";
import { StatusBadge } from "../components/StatusBadge";
import {
  confirmUserOrderCancellation,
  downloadUserInvoice,
  getUserOrder,
  getUserOrderTracking,
  previewUserOrderCancellation,
  requestUserReturn,
} from "../services/userService";
import { formatCurrency } from "../utils/formatCurrency";
import { resolveApiAssetUrl } from "../utils/resolveUrl";
import { SellerCard, StoreRatingDisplay, VisitStoreButton } from "../components/seller/SellerNavigation";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Failed to load order details.";
}

function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString();
}

function KeyValue({ label, value }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">{value || "Not available"}</div>
    </div>
  );
}

export function OrderDetailsPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelPreview, setCancelPreview] = useState(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getUserOrder(orderId), getUserOrderTracking(orderId)])
      .then(([orderResponse, trackingResponse]) => {
        if (!cancelled) {
          setOrder(orderResponse.data);
          setTracking(trackingResponse.data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(normalizeError(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const canReturn = order?.status === "Delivered";
  const cancellationLocked = ["REQUESTED", "APPROVED", "CANCELLED"].includes(order?.cancellation?.status);
  const canCancel = ["Pending", "Placed", "Packed", "Shipped", "Out for Delivery"].includes(order?.status) && !cancellationLocked;
  const timelineSteps = useMemo(() => order?.timeline?.steps || [], [order]);
  const timelineEvents = useMemo(() => tracking?.timeline || order?.timeline?.events || [], [order, tracking]);

  async function handleReturn() {
    const reason = await requestInput({ title: "Request return", label: "Reason for return", multiline: true });
    if (!reason) return;
    setActionBusy(true);
    try {
      await requestUserReturn(orderId, { reason });
      const [orderResponse, trackingResponse] = await Promise.all([getUserOrder(orderId), getUserOrderTracking(orderId)]);
      setOrder(orderResponse.data);
      setTracking(trackingResponse.data);
      setError("");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDownloadInvoice() {
    setActionBusy(true);
    try {
      await downloadUserInvoice(orderId);
      setError("");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setActionBusy(false);
    }
  }

  async function loadCancelPreview(payload = {}) {
    setActionBusy(true);
    try {
      const response = await previewUserOrderCancellation(orderId, payload);
      setCancelPreview(response.data || response);
      setError("");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleConfirmCancellation(payload = {}) {
    setActionBusy(true);
    try {
      await confirmUserOrderCancellation(orderId, payload);
      const [orderResponse, trackingResponse] = await Promise.all([getUserOrder(orderId), getUserOrderTracking(orderId)]);
      setOrder(orderResponse.data);
      setTracking(trackingResponse.data);
      setCancelOpen(false);
      setCancelPreview(null);
      setError("");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return <div className="h-80 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800" />;
  }

  if (!order) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error || "Order not found."}</div>;
  }

  return (
    <div className="print-order-page grid gap-6 print:gap-3">
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      <style>
        {`
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          @media print {
            html, body {
              background: #fff !important;
            }

            body * {
              visibility: hidden;
            }

            .print-order-page,
            .print-order-page * {
              visibility: visible;
            }

            .print-order-page {
              position: absolute;
              left: 0;
              top: 0;
              width: 190mm;
              max-width: 190mm;
              margin: 0 !important;
              padding: 0 !important;
              display: block !important;
            }

            .print-order-sheet {
              width: 100% !important;
              border: 0 !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              overflow: visible !important;
              background: #fff !important;
            }

            .print-order-grid {
              display: grid !important;
              grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr) !important;
              gap: 10px !important;
              padding: 8px 0 0 0 !important;
            }

            .print-card {
              break-inside: avoid;
              page-break-inside: avoid;
              border: 1px solid #cbd5e1 !important;
              border-radius: 8px !important;
              padding: 10px !important;
              background: #fff !important;
            }

            .print-compact-text {
              font-size: 12px !important;
              line-height: 1.35 !important;
            }

            .print-title {
              font-size: 26px !important;
              line-height: 1.1 !important;
            }

            .print-meta {
              font-size: 11px !important;
              gap: 8px !important;
            }

            .print-products {
              gap: 8px !important;
            }

            .print-product-row {
              gap: 10px !important;
              padding: 8px !important;
              border-radius: 8px !important;
              grid-template-columns: 56px minmax(0, 1fr) auto !important;
            }

            .print-product-image {
              width: 56px !important;
              height: 56px !important;
              border-radius: 6px !important;
            }

            .print-product-meta {
              margin-top: 6px !important;
              gap: 4px !important;
              font-size: 11px !important;
            }

            .print-steps {
              grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
              gap: 6px !important;
            }

            .print-step-card {
              padding: 8px !important;
              border-radius: 8px !important;
            }

            .print-step-card .text-sm {
              font-size: 11px !important;
            }

            .print-step-card .text-xs {
              font-size: 10px !important;
              line-height: 1.25 !important;
            }

            .print-hide-detailed-events {
              display: none !important;
            }

            .print-kv-grid {
              gap: 10px !important;
            }

            .print-kv-grid .text-sm,
            .print-kv-grid .text-xs,
            .print-kv-grid div {
              line-height: 1.3 !important;
            }
          }
        `}
      </style>
      <section className="print-order-sheet overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 print:rounded-none print:border-0 print:shadow-none">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_38%),linear-gradient(135deg,#0f172a,#1e293b)] px-6 py-6 text-white sm:px-8 print:bg-none print:px-0 print:text-slate-950">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300 print:text-slate-500">Order Summary</div>
              <h1 className="print-title mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{order.orderNumber}</h1>
              <div className="print-meta mt-3 flex flex-wrap gap-4 text-sm text-slate-200 print:text-slate-600">
                <span>Invoice: {order.invoiceNumber}</span>
                <span>Placed: {formatDateTime(order.orderDate || order.createdAt)}</span>
                <span>Estimated delivery: {order.estimatedDeliveryLabel || formatDate(order.estimatedDelivery)}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <StatusBadge value={order.status} />
              <StatusBadge value={order.paymentStatus} />
              <button
                type="button"
                disabled={actionBusy}
                onClick={handleDownloadInvoice}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/15 disabled:opacity-50"
              >
                Download Invoice
              </button>
              <Link
                to={`/orders/${orderId}/invoice`}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Preview Invoice
              </Link>
              <button
                type="button"
                onClick={() => document.getElementById("order-timeline")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Track Order
              </button>
              <button
                type="button"
                disabled={!canReturn || actionBusy}
                onClick={handleReturn}
                className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                Return Order
              </button>
              <button
                type="button"
                disabled={!canCancel || actionBusy}
                onClick={() => {
                  setCancelOpen(true);
                  void loadCancelPreview();
                }}
                className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel Order
              </button>
            </div>
          </div>
        </div>

        <div className="print-order-grid grid gap-6 p-6 sm:p-8 print:px-0 print:py-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
          <div className="grid gap-6">
            <section className="print-card rounded-3xl border border-slate-200 p-5 dark:border-slate-800 print:rounded-none print:border print:border-slate-300">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Products</h2>
                <div className="text-sm text-slate-500 dark:text-slate-400">{order.items?.length || 0} line items</div>
              </div>
              <div className="print-products mt-5 grid gap-4">
                {(order.items || []).map((item) => (
                  <div key={item.lineId || `${item.productId}-${item.variantId}`} className="print-product-row grid gap-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800 sm:grid-cols-[88px_minmax(0,1fr)_auto]">
                    <div className="print-product-image h-22 w-22 overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
                      {item.image ? <img src={resolveApiAssetUrl(item.image)} alt={item.name} className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0">
                      <div className="print-compact-text text-base font-semibold text-slate-950 dark:text-white">{item.name}</div>
                      <div className="print-compact-text mt-1 text-sm text-slate-500 dark:text-slate-400">{item.variantName || "Standard variant"}</div>
                      {item.variantSku ? <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">SKU: {item.variantSku}</div> : null}
                      <div className="print-product-meta mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
                        <span>Qty: {item.quantity}</span>
                        <span>Unit price: {formatCurrency(item.unitPrice, { currency: order.pricing?.currency })}</span>
                        <span>Total: {formatCurrency(item.total, { currency: order.pricing?.currency })}</span>
                      </div>
                    </div>
                    <div className="print-compact-text text-right text-sm font-semibold text-slate-950 dark:text-white">
                      {formatCurrency(item.total, { currency: order.pricing?.currency })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section id="order-timeline" className="print-card rounded-3xl border border-slate-200 p-5 dark:border-slate-800 print:rounded-none print:border print:border-slate-300">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Order Timeline</h2>
              <div className="mt-5 grid gap-4">
                <div className="print-steps grid gap-3 md:grid-cols-5">
                  {timelineSteps.map((step, index) => (
                    <div key={step.key} className="print-step-card relative rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className={`h-3 w-3 rounded-full ${step.completed ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"}`} />
                      {index < timelineSteps.length - 1 ? <div className="pointer-events-none absolute left-8 right-[-16px] top-[1.15rem] hidden h-px bg-slate-200 md:block dark:bg-slate-800" /> : null}
                      <div className="mt-3 text-sm font-semibold text-slate-950 dark:text-white">{step.label}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{step.timestamp ? formatDateTime(step.timestamp) : "Pending"}</div>
                    </div>
                  ))}
                </div>

                <div className="print-hide-detailed-events grid gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/70">
                  {(timelineEvents || []).map((event) => (
                    <div key={event.key || `${event.status}-${event.timestamp}`} className="flex gap-3">
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-900 dark:bg-white" />
                      <div>
                        <div className="text-sm font-semibold text-slate-950 dark:text-white">{event.label || event.status}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(event.timestamp)}</div>
                        {event.note ? <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{event.note}</div> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <div className="grid gap-4">
            <section className="print-card rounded-3xl border border-slate-200 p-5 dark:border-slate-800 print:rounded-none print:border print:border-slate-300">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Order Overview</h2>
              <div className="print-kv-grid mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <KeyValue label="Payment Status" value={order.paymentStatus} />
                <KeyValue label="Order Status" value={order.status} />
                <KeyValue label="Invoice Number" value={order.invoiceNumber} />
                <KeyValue label="Estimated Delivery" value={order.estimatedDeliveryLabel || formatDate(order.estimatedDelivery)} />
              </div>
            </section>

            <section className="print-card rounded-3xl border border-slate-200 p-5 dark:border-slate-800 print:rounded-none print:border print:border-slate-300">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Seller</h2>
              <div className="mt-4">
                <SellerCard seller={order.sellerId || order.vendors?.[0]} compact />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                <span>Store Rating:</span>
                <StoreRatingDisplay seller={order.sellerId || order.vendors?.[0]} />
                <VisitStoreButton seller={order.sellerId || order.vendors?.[0]}>Visit Seller Store</VisitStoreButton>
              </div>
            </section>

            <section className="print-card rounded-3xl border border-slate-200 p-5 dark:border-slate-800 print:rounded-none print:border print:border-slate-300">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Customer</h2>
              <div className="print-kv-grid mt-4 grid gap-4">
                <KeyValue label="Name" value={order.customer?.name} />
                <KeyValue label="Phone" value={order.customer?.phone} />
                <KeyValue label="Email" value={order.customer?.email} />
                <KeyValue
                  label="Shipping Address"
                  value={[
                    order.customer?.shippingAddress?.line1,
                    order.customer?.shippingAddress?.line2,
                    [order.customer?.shippingAddress?.city, order.customer?.shippingAddress?.state, order.customer?.shippingAddress?.postalCode].filter(Boolean).join(", "),
                    order.customer?.shippingAddress?.country,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                />
                <KeyValue
                  label="Billing Address"
                  value={[
                    order.customer?.billingAddress?.line1,
                    order.customer?.billingAddress?.line2,
                    [order.customer?.billingAddress?.city, order.customer?.billingAddress?.state, order.customer?.billingAddress?.postalCode].filter(Boolean).join(", "),
                    order.customer?.billingAddress?.country,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                />
              </div>
            </section>

            <section className="print-card rounded-3xl border border-slate-200 p-5 dark:border-slate-800 print:rounded-none print:border print:border-slate-300">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Payment Breakdown</h2>
              <div className="print-kv-grid mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between"><span>Subtotal</span><span>{formatCurrency(order.pricing?.subtotal, { currency: order.pricing?.currency })}</span></div>
                <div className="flex items-center justify-between"><span>Delivery fee</span><span>{formatCurrency(order.pricing?.deliveryFee, { currency: order.pricing?.currency })}</span></div>
                <div className="flex items-center justify-between"><span>Platform fee</span><span>{formatCurrency(order.pricing?.platformFee, { currency: order.pricing?.currency })}</span></div>
                <div className="flex items-center justify-between"><span>{order.payment?.method === "COD" ? "COD charges" : "Razorpay charges"}</span><span>{formatCurrency(order.pricing?.paymentFee, { currency: order.pricing?.currency })}</span></div>
                <div className="flex items-center justify-between"><span>Taxes</span><span>{formatCurrency(order.pricing?.taxes, { currency: order.pricing?.currency })}</span></div>
                <div className="flex items-center justify-between"><span>Discounts</span><span>-{formatCurrency(order.pricing?.discounts, { currency: order.pricing?.currency })}</span></div>
                <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3 font-semibold text-slate-950 dark:border-slate-800 dark:text-white">
                  <span>Grand total</span>
                  <span>{formatCurrency(order.pricing?.grandTotal, { currency: order.pricing?.currency })}</span>
                </div>
              </div>
            </section>

            <section className="print-card rounded-3xl border border-slate-200 p-5 dark:border-slate-800 print:rounded-none print:border print:border-slate-300">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Payment Details</h2>
              <div className="print-kv-grid mt-4 grid gap-4">
                <KeyValue label="Method" value={order.payment?.method} />
                <KeyValue label="Transaction ID" value={order.payment?.transactionId || "COD"} />
                <KeyValue label="Payment Timestamp" value={order.payment?.timestamp ? formatDateTime(order.payment.timestamp) : "Awaiting payment"} />
                <KeyValue label="Refund Status" value={order.refundSummary?.status || "NONE"} />
                <KeyValue label="Refund Amount" value={formatCurrency(order.refundSummary?.amount || 0, { currency: order.pricing?.currency })} />
                <KeyValue label="Deduction Amount" value={formatCurrency(order.refundSummary?.deductionAmount || 0, { currency: order.pricing?.currency })} />
              </div>
              {order.refundSummary?.status === "PENDING" ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Refund is being processed by finance team.
                </div>
              ) : null}
            </section>

            <section className="print-card rounded-3xl border border-slate-200 p-5 dark:border-slate-800 print:rounded-none print:border print:border-slate-300">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Shipping Details</h2>
              <div className="print-kv-grid mt-4 grid gap-4">
                <KeyValue label="Courier" value={order.shipping?.courier || "Pending assignment"} />
                <KeyValue label="Tracking Number" value={order.shipping?.trackingNumber || "Not assigned"} />
                <KeyValue label="Shipping Method" value={order.shipping?.shippingMethod} />
                <KeyValue label="Delivery Estimate" value={order.estimatedDeliveryLabel || formatDate(order.estimatedDelivery)} />
                {order.shipping?.trackingUrl ? (
                  <a href={order.shipping.trackingUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:underline print:hidden">
                    Open courier tracking
                  </a>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link to="/orders" className="text-sm font-medium text-blue-600 hover:underline">
          Back to orders
        </Link>
        <button type="button" onClick={() => window.print()} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
          Print summary
        </button>
      </div>

      <CancelOrderModal
        open={cancelOpen}
        loading={actionBusy}
        preview={cancelPreview}
        onClose={() => {
          setCancelOpen(false);
          setCancelPreview(null);
        }}
        onPreview={loadCancelPreview}
        onConfirm={handleConfirmCancellation}
      />
    </div>
  );
}
