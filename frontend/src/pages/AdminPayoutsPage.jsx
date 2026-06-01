import { useCallback, useEffect, useState } from "react";
import { FilterBar } from "../components/FilterBar";
import { PayoutCard } from "../components/PayoutCard";
import { StatusBadge } from "../components/StatusBadge";
import { formatCurrency } from "../utils/formatCurrency";
import { listPayouts, processPayout, queueEligiblePayouts } from "../services/adminApi";

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

export function AdminPayoutsPage() {
  const [status, setStatus] = useState("");
  const [data, setData] = useState({ payouts: [], overview: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyOrderId, setBusyOrderId] = useState("");

  const loadPayouts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listPayouts(status ? { status } : {});
      setData(response.data || { payouts: [], overview: {} });
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  async function handleProcess(orderId) {
    setBusyOrderId(orderId);
    try {
      await processPayout(orderId);
      await loadPayouts();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusyOrderId("");
    }
  }

  async function handleQueue() {
    try {
      await queueEligiblePayouts();
      await loadPayouts();
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold text-slate-950">Payouts</h1>
        <p className="mt-1 text-sm text-slate-600">Queue settlement-ready payouts and transfer vendor earnings with a review trail.</p>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <PayoutCard label="Total volume" value={data.overview.totalAmount} hint="All payout records in scope" />
        <PayoutCard label="Pending" value={data.overview.pendingAmount} hint="Queued, pending, and on-hold" accent="bg-amber-100 text-amber-700" />
        <PayoutCard label="Paid" value={data.overview.paidAmount} hint="Transferred to vendors" accent="bg-emerald-100 text-emerald-700" />
        <PayoutCard label="Failed" value={data.overview.failedAmount} hint="Needs finance follow-up" accent="bg-rose-100 text-rose-700" />
      </div>

      <FilterBar
        actions={
          <button type="button" onClick={handleQueue} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
            Queue eligible payouts
          </button>
        }
      >
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm">
          <option value="">All statuses</option>
          <option value="ON_HOLD">On hold</option>
          <option value="PENDING">Pending</option>
          <option value="QUEUED">Queued</option>
          <option value="PAID">Paid</option>
          <option value="FAILED">Failed</option>
        </select>
      </FilterBar>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Order</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Vendor</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Net amount</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Scheduled</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Loading payouts...</td></tr>
              ) : data.payouts?.length ? (
                data.payouts.map((payout) => (
                  <tr key={payout._id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-950">{payout.orderId?.orderNumber || payout._id}</div>
                      <div className="mt-1 text-xs text-slate-500">{new Date(payout.createdAt).toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{payout.sellerId?.companyName || "Vendor"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-950">{formatCurrency(payout.netAmount || payout.amount || 0)}</td>
                    <td className="px-4 py-3"><StatusBadge value={payout.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{payout.scheduledFor ? new Date(payout.scheduledFor).toLocaleDateString() : "Awaiting delivery"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {["PENDING", "QUEUED"].includes(payout.status) ? (
                          <button
                            type="button"
                            disabled={busyOrderId === (payout.orderId?._id || payout.orderId)}
                            onClick={() => handleProcess(payout.orderId?._id || payout.orderId)}
                            className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            {busyOrderId === (payout.orderId?._id || payout.orderId) ? "Processing..." : "Trigger payout"}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">{payout.transferId || "No action"}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No payouts found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
