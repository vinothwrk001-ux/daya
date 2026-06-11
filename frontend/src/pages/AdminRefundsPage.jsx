import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FilterBar } from "../components/FilterBar";
import { StatusBadge } from "../components/StatusBadge";
import { formatCurrency } from "../utils/formatCurrency";
import {
  listRefundCases,
  markManualRefundCase,
  markWalletRefundCase,
  processRefundCase,
  retryRefundCase,
} from "../services/adminApi";

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

function RefundProcessModal({ refund, loading, onClose, onSubmit }) {
  const [refundMethod, setRefundMethod] = useState("RAZORPAY");
  const [transactionReference, setTransactionReference] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!refund) {
      setRefundMethod("RAZORPAY");
      setTransactionReference("");
      setBankReference("");
      setNotes("");
      return;
    }

    setRefundMethod(refund.recommendedRefundMethod || "RAZORPAY");
    setTransactionReference("");
    setBankReference("");
    setNotes("");
  }, [refund]);

  if (!refund) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-xl rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Finance Processing</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Process Refund</h2>
            <p className="mt-2 text-sm text-slate-600">
              Choose the finance-approved refund method for {refund.orderId?.orderNumber || refund._id}.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <div>Refund amount: <span className="font-semibold text-slate-950">{formatCurrency(refund.amount || 0)}</span></div>
            <div className="mt-1">Deduction amount: <span className="font-semibold text-slate-950">{formatCurrency(refund.deductionAmount || 0)}</span></div>
            <div className="mt-1">Customer: <span className="font-semibold text-slate-950">{refund.orderId?.userId?.name || refund.orderId?.shippingAddress?.fullName || "Not available"}</span></div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Select Refund Method</div>
            <div className="mt-3 grid gap-3">
              {[
                { value: "RAZORPAY", label: "Razorpay Refund", hint: "Send the refund back to the captured online payment." },
                { value: "WALLET", label: "Wallet Refund", hint: "Credit the refund into the customer wallet safely." },
                { value: "MANUAL", label: "Manual Refund", hint: "Mark an external bank or UPI transfer as completed." },
              ].map((option) => (
                <label key={option.value} className={`rounded-2xl border px-4 py-3 ${refundMethod === option.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="refundMethod"
                      value={option.value}
                      checked={refundMethod === option.value}
                      onChange={(event) => setRefundMethod(event.target.value)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-semibold">{option.label}</div>
                      <div className={`mt-1 text-sm ${refundMethod === option.value ? "text-slate-200" : "text-slate-500"}`}>{option.hint}</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {refundMethod === "MANUAL" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Reference Number</span>
                <input value={bankReference} onChange={(event) => setBankReference(event.target.value)} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900" />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Transaction ID</span>
                <input value={transactionReference} onChange={(event) => setTransactionReference(event.target.value)} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900" />
              </label>
            </div>
          ) : null}

          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Notes</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900" />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || (refundMethod === "MANUAL" && !transactionReference.trim())}
            onClick={() => onSubmit({ refundMethod, transactionReference, bankReference, notes })}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Processing..." : "Process Refund"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminRefundsPage() {
  const [refunds, setRefunds] = useState([]);
  const [overview, setOverview] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState(null);

  const loadRefunds = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listRefundCases(status ? { status } : {});
      setRefunds(response.data?.refunds || []);
      setOverview(response.data?.overview || null);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadRefunds();
  }, [loadRefunds]);

  async function handleProcessRefund(payload) {
    if (!selectedRefund) return;
    setActionLoading(true);
    try {
      if (payload.refundMethod === "MANUAL") {
        await markManualRefundCase(selectedRefund._id, {
          transactionReference: payload.transactionReference,
          bankReference: payload.bankReference,
          notes: payload.notes,
        });
      } else if (payload.refundMethod === "WALLET") {
        await markWalletRefundCase(selectedRefund._id, { notes: payload.notes });
      } else {
        await processRefundCase(selectedRefund._id, {
          refundMethod: "RAZORPAY",
          notes: payload.notes,
        });
      }
      setSelectedRefund(null);
      await loadRefunds();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRetry(refundId) {
    setActionLoading(true);
    try {
      await retryRefundCase(refundId);
      await loadRefunds();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold text-slate-950">Refund Management</h1>
        <p className="mt-1 text-sm text-slate-600">
          Finance-controlled queue for cancelled orders, pending refunds, processing updates, completed refunds, and failures.
        </p>
      </section>

      <FilterBar>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm">
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
          <option value="PROCESSED">Processed</option>
          <option value="FAILED">Failed</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </FilterBar>

      {overview ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Total", value: overview.totalAmount },
            { label: "Processed", value: overview.processedAmount },
            { label: "Pending", value: overview.pendingAmount },
            { label: "Failed", value: overview.failedAmount },
          ].map((item) => (
            <div key={item.label} className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">{item.label}</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{formatCurrency(item.value || 0)}</div>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Order ID</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Customer</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Fulfillment</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Payment Method</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Order Amount</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Deduction</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Refund Amount</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Refund Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Refund Method</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Created At</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-500">Loading refunds...</td></tr>
              ) : refunds.length ? (
                refunds.map((refund) => {
                  const customer = refund.orderId?.userId?.name || refund.orderId?.shippingAddress?.fullName || "Not available";
                  const isCompleted = refund.status === "PROCESSED";
                  return (
                    <tr key={refund._id}>
                      <td className="px-4 py-3 font-semibold text-slate-950">{refund.orderId?.orderNumber || refund.orderId?._id}</td>
                      <td className="px-4 py-3 text-slate-600">{customer}</td>
                      <td className="px-4 py-3 text-slate-600">Platform</td>
                      <td className="px-4 py-3 text-slate-600">{refund.paymentMethod || refund.orderId?.paymentMethod || "NA"}</td>
                      <td className="px-4 py-3 text-slate-600">{formatCurrency(refund.grossAmount || refund.orderId?.totalAmount || 0)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatCurrency(refund.deductionAmount || 0)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-950">{formatCurrency(refund.amount || 0)}</td>
                      <td className="px-4 py-3"><StatusBadge value={refund.status} /></td>
                      <td className="px-4 py-3 text-slate-600">{refund.refundMethod || refund.recommendedRefundMethod || "Finance Pending"}</td>
                      <td className="px-4 py-3 text-slate-600">{new Date(refund.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link to={`/admin/refunds/${refund._id}`} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
                            View
                          </Link>
                          {isCompleted ? (
                            <span className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Refunded</span>
                          ) : refund.status === "FAILED" ? (
                            <button type="button" disabled={actionLoading} onClick={() => handleRetry(refund._id)} className="rounded-xl border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 disabled:opacity-50">Retry</button>
                          ) : refund.status === "PENDING" || refund.status === "PROCESSING" ? (
                            <button type="button" disabled={actionLoading} onClick={() => setSelectedRefund(refund)} className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                              Process Refund
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">No actions</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-500">No refunds found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RefundProcessModal
        refund={selectedRefund}
        loading={actionLoading}
        onClose={() => setSelectedRefund(null)}
        onSubmit={handleProcessRefund}
      />
    </div>
  );
}
