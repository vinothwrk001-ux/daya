import { useCallback, useEffect, useState } from "react";
import { FilterBar } from "../components/FilterBar";
import { PaymentTable } from "../components/PaymentTable";
import { RefundModal } from "../components/RefundModal";
import * as paymentService from "../services/paymentService";

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

export function AdminPaymentsPage() {
  const [filters, setFilters] = useState({ search: "", status: "", method: "" });
  const [payments, setPayments] = useState([]);
  const [overview, setOverview] = useState(null);
  const [codAnalytics, setCodAnalytics] = useState(null);
  const [codSettings, setCodSettings] = useState(null);
  const [razorpaySettings, setRazorpaySettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refundTarget, setRefundTarget] = useState(null);
  const [refunding, setRefunding] = useState(false);
  const [savingCodSettings, setSavingCodSettings] = useState(false);
  const [savingRazorpaySettings, setSavingRazorpaySettings] = useState(false);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [response, analyticsResponse, settingsResponse] = await Promise.all([
        paymentService.listPayments(filters),
        paymentService.getCodAnalytics().catch(() => null),
        paymentService.getCodSettings().catch(() => null),
      ]);
      const razorpaySettingsResponse = await paymentService.getRazorpaySettings().catch(() => null);
      setPayments(response?.payments || []);
      setOverview(response?.overview || null);
      setCodAnalytics(analyticsResponse || null);
      setCodSettings(settingsResponse || null);
      setRazorpaySettings(razorpaySettingsResponse || null);
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

  async function handleSaveCodSettings() {
    if (!codSettings) return;
    setSavingCodSettings(true);
    setError("");
    try {
      const response = await paymentService.updateCodSettings(codSettings);
      setCodSettings(response || null);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSavingCodSettings(false);
    }
  }

  async function handleSaveRazorpaySettings() {
    if (!razorpaySettings) return;
    setSavingRazorpaySettings(true);
    setError("");
    try {
      const response = await paymentService.updateRazorpaySettings(razorpaySettings);
      setRazorpaySettings(response || null);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSavingRazorpaySettings(false);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold text-slate-950">Payments</h1>
        <p className="mt-1 text-sm text-slate-600">Track captured payments, failed attempts, verification state, and refund controls.</p>
      </section>

      <FilterBar>
        <input
          type="text"
          placeholder="Search by gateway id or receipt"
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
            { label: "Gateway fee revenue", value: overview.gatewayFeeRevenue },
          ].map((card) => (
            <div key={card.label} className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">{card.label}</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">Rs {Number(card.value || 0).toFixed(2)}</div>
            </div>
          ))}
        </div>
      ) : null}

      {codAnalytics ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "COD success", value: `${Number(codAnalytics.successRate || 0).toFixed(2)}%` },
            { label: "COD failure", value: `${Number(codAnalytics.failureRate || 0).toFixed(2)}%` },
            { label: "COD RTO", value: `${Number(codAnalytics.rtoPercentage || 0).toFixed(2)}%` },
            { label: "COD volume", value: `Rs ${Number(codAnalytics.totalAmount || 0).toFixed(2)}` },
          ].map((card) => (
            <div key={card.label} className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">{card.label}</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{card.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {codSettings ? (
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">COD settings</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(codSettings.isEnabled)}
                onChange={(event) => setCodSettings((current) => ({ ...current, isEnabled: event.target.checked }))}
              />
              Enable COD
            </label>
            <input
              type="number"
              value={codSettings.maxOrderValue ?? 50000}
              onChange={(event) => setCodSettings((current) => ({ ...current, maxOrderValue: Number(event.target.value || 0) }))}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              placeholder="Max order value"
            />
            <input
              type="number"
              value={codSettings.defaultFeeValue ?? 0}
              onChange={(event) => setCodSettings((current) => ({ ...current, defaultFeeValue: Number(event.target.value || 0) }))}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              placeholder="Default COD fee"
            />
            <input
              type="number"
              value={codSettings.vendorHoldDays ?? 3}
              onChange={(event) => setCodSettings((current) => ({ ...current, vendorHoldDays: Number(event.target.value || 0) }))}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              placeholder="Vendor hold days"
            />
          </div>
          <button
            type="button"
            onClick={handleSaveCodSettings}
            disabled={savingCodSettings}
            className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {savingCodSettings ? "Saving..." : "Save COD settings"}
          </button>
        </section>
      ) : null}

      {razorpaySettings ? (
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Razorpay settings</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(razorpaySettings.isEnabled)}
                onChange={(event) => setRazorpaySettings((current) => ({ ...current, isEnabled: event.target.checked }))}
              />
              Enable Razorpay
            </label>
            <input
              type="number"
              value={razorpaySettings.sessionTimeoutMinutes ?? 15}
              onChange={(event) => setRazorpaySettings((current) => ({ ...current, sessionTimeoutMinutes: Number(event.target.value || 15) }))}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              placeholder="Session timeout (min)"
            />
            <input
              type="text"
              value={razorpaySettings.webhookUrl ?? ""}
              onChange={(event) => setRazorpaySettings((current) => ({ ...current, webhookUrl: event.target.value }))}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              placeholder="Webhook URL"
            />
            <div className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600">
              Webhook secret: {razorpaySettings.webhookSecretConfigured ? "Configured" : "Missing"}
            </div>
          </div>
          <button
            type="button"
            onClick={handleSaveRazorpaySettings}
            disabled={savingRazorpaySettings}
            className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {savingRazorpaySettings ? "Saving..." : "Save Razorpay settings"}
          </button>
        </section>
      ) : null}

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <PaymentTable rows={payments} onRefund={setRefundTarget} detailsBasePath="/admin/payment-details" />
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
