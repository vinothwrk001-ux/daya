import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge";
import { getRefundCase } from "../services/adminApi";
import { formatCurrency } from "../utils/formatCurrency";

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

function DetailRow({ label, value }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm text-slate-700">{value || "Not available"}</div>
    </div>
  );
}

export function AdminRefundDetailsPage() {
  const { id } = useParams();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    getRefundCase(id)
      .then((response) => {
        setDetails(response.data || response);
        setError("");
      })
      .catch((err) => setError(normalizeError(err)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="h-72 animate-pulse rounded-[2rem] bg-slate-100" />;
  }

  if (error || !details) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error || "Refund not found"}</div>;
  }

  const { refund, order, payment, inventoryLogs = [], auditLogs = [] } = details;
  const breakdown = refund?.breakdown || {};
  const customer = order?.userId?.name || order?.shippingAddress?.fullName || "Not available";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Refund Case</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">{order?.orderNumber || refund?._id}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge value={refund?.status} />
            {refund?.refundMethod ? <StatusBadge value={refund.refundMethod} /> : null}
            <StatusBadge value={order?.status} />
            <StatusBadge value={order?.paymentStatus} />
          </div>
        </div>
        <Link to="/admin/refunds" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
          Back to Refunds
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section className="space-y-6">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Refund Calculation</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <DetailRow label="Order Amount" value={formatCurrency(refund?.grossAmount || order?.totalAmount || 0)} />
              <DetailRow label="Refund Amount" value={formatCurrency(refund?.amount || 0)} />
              <DetailRow label="Deduction Amount" value={formatCurrency(refund?.deductionAmount || 0)} />
              <DetailRow label="Refund Status" value={refund?.status} />
              <DetailRow label="Refund Method" value={refund?.refundMethod || "Finance Pending"} />
              <DetailRow label="Recommended Method" value={refund?.recommendedRefundMethod || "Not set"} />
              <DetailRow label="Cancellation Reason" value={refund?.reason || order?.cancellation?.reason} />
              <DetailRow label="Failure Reason" value={refund?.failureReason || "None"} />
              <DetailRow label="Razorpay Refund ID" value={refund?.refundId || payment?.refundId || "Not available"} />
              <DetailRow label="Wallet Transaction ID" value={refund?.financeSnapshot?.walletTransactionId || "Not available"} />
              <DetailRow label="Manual Reference ID" value={refund?.manualDetails?.bankReference || refund?.manualDetails?.transactionReference || "Not available"} />
              <DetailRow label="Processed At" value={refund?.processedAt ? new Date(refund.processedAt).toLocaleString() : "Pending"} />
            </div>

            <div className="mt-6 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-950">Deduction Breakdown</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <span>Shipping Deduction</span>
                  <span className="font-semibold text-slate-950">{formatCurrency(breakdown.shippingDeduction || breakdown.shipping || 0)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Gateway Deduction</span>
                  <span className="font-semibold text-slate-950">{formatCurrency(breakdown.gatewayFee || 0)}</span>
                </div>
                {(breakdown.deductions || []).map((item) => (
                  <div key={`${item.type}-${item.label}`} className="flex items-center justify-between gap-3">
                    <span>{item.label}</span>
                    <span className="font-semibold text-slate-950">{formatCurrency(item.amount || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Order Details</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <DetailRow label="Customer" value={customer} />
              <DetailRow label="Fulfillment" value="Platform" />
              <DetailRow label="Payment Method" value={order?.paymentMethod || refund?.paymentMethod} />
              <DetailRow label="Payment Status" value={order?.paymentStatus} />
              <DetailRow label="Order Status" value={order?.status} />
              <DetailRow label="Created At" value={order?.createdAt ? new Date(order.createdAt).toLocaleString() : "Not available"} />
            </div>

            <div className="mt-6">
              <div className="text-sm font-semibold text-slate-950">Products</div>
              <div className="mt-3 space-y-3">
                {(order?.items || []).map((item, index) => (
                  <div key={`${item.productId}-${index}`} className="rounded-2xl border border-slate-200 px-4 py-3">
                    <div className="font-medium text-slate-950">{item.name}</div>
                    <div className="mt-1 text-sm text-slate-600">
                      Variant: {item.variantTitle || item.variantSku || item.variantId || "Standard"} | Qty: {item.quantity} | Amount: {formatCurrency((item.price || 0) * (item.quantity || 0))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <div className="text-sm font-semibold text-slate-950">Order Timeline</div>
              <div className="mt-3 space-y-3">
                {(order?.timeline || []).length ? (
                  order.timeline.map((entry, index) => (
                    <div key={`${entry.status}-${index}`} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
                      <div className="font-medium text-slate-950">{entry.status}</div>
                      <div className="mt-1">{entry.note || "No note"}</div>
                      <div className="mt-1 text-xs text-slate-500">{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "No timestamp"}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">No order timeline events available.</div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Payment Details</h2>
            <div className="mt-5 grid gap-4">
              <DetailRow label="Transaction ID" value={payment?.razorpayPaymentId || refund?.manualDetails?.transactionReference || "Not available"} />
              <DetailRow label="Gateway Status" value={payment?.status || "Not available"} />
              <DetailRow label="Refund Ledger / Wallet Ref" value={refund?.financeSnapshot?.walletTransactionId || refund?.refundId || "Not available"} />
              <DetailRow label="Manual Notes" value={refund?.manualDetails?.notes || refund?.notes || "None"} />
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Inventory & Audit</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-950">Inventory Restoration Logs</div>
                <div className="mt-2 text-sm text-slate-600">{inventoryLogs.length ? `${inventoryLogs.length} inventory movement(s)` : "No inventory logs found"}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-950">Finance Rollback Logs</div>
                <div className="mt-2 text-sm text-slate-600">
                  {refund?.financeSnapshot?.rollbackStatus
                    ? `Rollback status: ${refund.financeSnapshot.rollbackStatus}`
                    : "No finance rollback recorded"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-950">Audit Logs</div>
                <div className="mt-2 text-sm text-slate-600">{auditLogs.length ? `${auditLogs.length} audit event(s)` : "No audit logs found"}</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
