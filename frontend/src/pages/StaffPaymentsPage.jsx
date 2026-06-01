import { useCallback, useEffect, useState } from "react";
import { FilterBar } from "../components/FilterBar";
import { PaymentTable } from "../components/PaymentTable";
import { RefundModal } from "../components/RefundModal";
import { useStaffPermission, useRequirePermission } from "../hooks/useStaffAuth";
import * as paymentService from "../services/paymentService";

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

export function StaffPaymentsPage() {
  useRequirePermission("payments.read");
  const { hasPermission } = useStaffPermission();
  const canRefund = hasPermission("payments.refund");
  const [filters, setFilters] = useState({ search: "", status: "", method: "" });
  const [payments, setPayments] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refundTarget, setRefundTarget] = useState(null);
  const [refunding, setRefunding] = useState(false);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await paymentService.listPayments(filters);
      setPayments(response.data?.payments || []);
      setOverview(response.data?.overview || null);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  async function handleRefund(payload) {
    if (!refundTarget) return;
    setRefunding(true);
    setError("");
    try {
      await paymentService.createRefund({
        paymentId: refundTarget._id,
        orderId: refundTarget.orderIds?.[0]?._id,
        amount: payload.amount,
        reason: payload.reason,
      });
      setRefundTarget(null);
      await loadPayments();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setRefunding(false);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold text-slate-950">Payments</h1>
        <p className="mt-1 text-sm text-slate-600">Monitor payment verification, order linkage, and refund actions.</p>
      </section>

      <FilterBar>
        <input
          type="text"
          placeholder="Search by Razorpay id or receipt"
          value={filters.search}
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          className="min-w-[240px] rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
        />
        <select
          value={filters.status}
          onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="CREATED">Created</option>
          <option value="PAID">Paid</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
          <option value="PARTIALLY_REFUNDED">Partially refunded</option>
        </select>
        <select
          value={filters.method}
          onChange={(event) => setFilters((current) => ({ ...current, method: event.target.value }))}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
        >
          <option value="">All methods</option>
          <option value="ONLINE">Online</option>
          <option value="COD">COD</option>
        </select>
      </FilterBar>

      {overview ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Total volume", value: overview.totalAmount },
            { label: "Paid", value: overview.paidAmount },
            { label: "Failed", value: overview.failedAmount },
            { label: "Refunded", value: overview.refundedAmount },
          ].map((card) => (
            <div key={card.label} className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">{card.label}</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">Rs {Number(card.value || 0).toFixed(2)}</div>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <PaymentTable rows={payments} onRefund={canRefund ? setRefundTarget : null} detailsBasePath="/admin/payment-details" />
      )}

      <RefundModal
        open={Boolean(refundTarget)}
        payment={refundTarget}
        loading={refunding}
        onClose={() => setRefundTarget(null)}
        onSubmit={handleRefund}
      />
    </div>
  );
}
