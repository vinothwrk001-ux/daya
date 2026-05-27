import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Banknote,
  BarChart3,
  ClipboardList,
  CreditCard,
  Download,
  FileText,
  Landmark,
  Search,
  Wallet,
} from "lucide-react";
import {
  cancelInfluencerWithdrawal,
  getInfluencerWalletEarnings,
  requestInfluencerWithdrawal,
  saveInfluencerPayoutAccount,
} from "../../services/influencerCommerceService";
import { formatCurrency } from "../../utils/formatCurrency";

const EARNING_TABS = [
  ["total", "Total Earnings"],
  ["pending", "Pending Earnings"],
  ["approved", "Approved Earnings"],
  ["balance", "Withdrawable Balance"],
  ["history", "Earnings History"],
  ["commission", "Commission Breakdown"],
  ["bonus", "Bonus Earnings"],
  ["tax", "Tax Summary"],
];

const WITHDRAWAL_TABS = [
  ["request", "Request Withdrawal"],
  ["withdrawal_pending", "Pending Requests"],
  ["withdrawal_approved", "Approved Requests"],
  ["withdrawal_rejected", "Rejected Requests"],
  ["payments", "Payment History"],
  ["banks", "Bank Accounts"],
];

function asDate(value) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function MoneyCard({ label, value, hint, icon: Icon = Wallet }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <Icon className="h-5 w-5 text-indigo-500" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">{formatCurrency(value || 0)}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}

function StatusBadge({ value }) {
  const normalized = String(value || "").toUpperCase();
  const tone = normalized.includes("PAID") || normalized.includes("APPROVED") || normalized.includes("SETTLED")
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200"
    : normalized.includes("REJECTED") || normalized.includes("FAILED") || normalized.includes("CANCELLED")
      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-200"
      : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{normalized.replace(/_/g, " ") || "PENDING"}</span>;
}

function DataTable({ columns, rows, empty = "No records found." }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
          <tr>{columns.map((column) => <th key={column.key} className={`px-4 py-3 ${column.align === "right" ? "text-right" : "text-left"}`}>{column.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.length ? rows.map((row, index) => (
            <tr key={row._id || row.id || index} className="text-slate-700 dark:text-slate-200">
              {columns.map((column) => (
                <td key={column.key} className={`px-4 py-3 ${column.align === "right" ? "text-right" : "text-left"}`}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          )) : (
            <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function WithdrawalForm({ summary, onSubmit, busy }) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [remarks, setRemarks] = useState("");
  const rules = summary?.withdrawalRules || {};
  const account = summary?.payoutAccount;

  return (
    <form
      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[1fr_1fr_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ amount: Number(amount), paymentMethod, remarks });
        setAmount("");
        setRemarks("");
      }}
    >
      <div className="lg:col-span-3">
        <h3 className="font-semibold text-slate-950 dark:text-white">Request withdrawal</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Available {formatCurrency(summary?.wallet?.availableBalance || 0)}. Minimum {formatCurrency(rules.minimumAmount || 0)}. Processing {rules.processingTime || "2-5 business days"}.
        </p>
        {account ? (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Default payout: {account.bankName || account.upiId || account.paypalEmail || account.paymentMethod} · {account.verificationStatus}
          </p>
        ) : (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-200">Add a bank account before requesting withdrawal.</p>
        )}
      </div>
      <input
        type="number"
        min={rules.minimumAmount || 1}
        max={rules.maximumAmount || undefined}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        placeholder="Withdrawal amount"
        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      />
      <select
        value={paymentMethod}
        onChange={(event) => setPaymentMethod(event.target.value)}
        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      >
        <option value="bank_transfer">Bank Transfer</option>
        <option value="upi">UPI</option>
        <option value="paypal">PayPal</option>
        <option value="stripe_connect">Stripe Connect</option>
        <option value="wise">Wise</option>
      </select>
      <button disabled={busy || !account} className="h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
        Submit
      </button>
      <input
        value={remarks}
        onChange={(event) => setRemarks(event.target.value)}
        placeholder="Remarks"
        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white lg:col-span-3"
      />
    </form>
  );
}

function BankAccountForm({ onSubmit, busy }) {
  const [form, setForm] = useState({
    paymentMethod: "bank_transfer",
    accountHolderName: "",
    accountNumber: "",
    ifscCode: "",
    bankName: "",
    upiId: "",
    paypalEmail: "",
  });
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <form
      className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form);
      }}
    >
      <div className="md:col-span-2">
        <h3 className="font-semibold text-slate-950 dark:text-white">Add or update payout account</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sensitive values are encrypted and only masked values are returned.</p>
      </div>
      <select value={form.paymentMethod} onChange={(event) => setField("paymentMethod", event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
        <option value="bank_transfer">Bank Transfer</option>
        <option value="upi">UPI</option>
        <option value="paypal">PayPal</option>
        <option value="wise">Wise</option>
      </select>
      <input value={form.accountHolderName} onChange={(event) => setField("accountHolderName", event.target.value)} placeholder="Account holder name" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
      <input value={form.bankName} onChange={(event) => setField("bankName", event.target.value)} placeholder="Bank name" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
      <input value={form.accountNumber} onChange={(event) => setField("accountNumber", event.target.value)} placeholder="Account number" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
      <input value={form.ifscCode} onChange={(event) => setField("ifscCode", event.target.value)} placeholder="IFSC / SWIFT" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
      <input value={form.upiId} onChange={(event) => setField("upiId", event.target.value)} placeholder="UPI ID" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
      <input value={form.paypalEmail} onChange={(event) => setField("paypalEmail", event.target.value)} placeholder="PayPal email" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
      <button disabled={busy} className="h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 md:col-span-2">Save payout account</button>
    </form>
  );
}

export default function InfluencerEarningsPage() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "total";
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ range: "30d", search: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getInfluencerWalletEarnings({ range: filters.range, limit: 50 });
      setSummary(res?.data || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load earnings and wallet.");
    } finally {
      setLoading(false);
    }
  }, [filters.range]);

  useEffect(() => {
    load();
  }, [load]);

  const allTabs = [...EARNING_TABS, ...WITHDRAWAL_TABS];
  const activeLabel = allTabs.find(([id]) => id === tab)?.[1] || "Total Earnings";

  const withdrawalRows = useMemo(() => {
    const buckets = summary?.withdrawals || {};
    if (tab === "withdrawal_pending") return buckets.pending || [];
    if (tab === "withdrawal_approved") return buckets.approved || [];
    if (tab === "withdrawal_rejected") return buckets.rejected || [];
    if (tab === "payments") return buckets.history || [];
    return [];
  }, [summary, tab]);

  async function handleWithdrawal(payload) {
    setBusy(true);
    setError("");
    try {
      await requestInfluencerWithdrawal(payload);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Withdrawal request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(request) {
    setBusy(true);
    try {
      await cancelInfluencerWithdrawal(request._id);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Cancel failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveAccount(payload) {
    setBusy(true);
    setError("");
    try {
      await saveInfluencerPayoutAccount(payload);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Payout account save failed.");
    } finally {
      setBusy(false);
    }
  }

  const historyRows = (summary?.earningsHistory || []).filter((row) => {
    if (!filters.search) return true;
    const haystack = `${row.type} ${row.source} ${row.idempotencyKey}`.toLowerCase();
    return haystack.includes(filters.search.toLowerCase());
  });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
              <Wallet className="h-3.5 w-3.5" />
              Earnings & Wallet
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">{activeLabel}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              Centralized creator finance using existing commission records, wallet balances, ledger entries, payout methods, and withdrawal workflow.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["today", "7d", "30d", "90d", "12m"].map((range) => (
              <button
                key={range}
                onClick={() => setFilters((current) => ({ ...current, range }))}
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${filters.range === range ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200"}`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MoneyCard label="Total Earnings" value={summary?.kpis?.totalEarnings} icon={Banknote} />
        <MoneyCard label="Pending" value={summary?.kpis?.pendingEarnings} icon={ClipboardList} />
        <MoneyCard label="Approved" value={summary?.kpis?.approvedEarnings} icon={BarChart3} />
        <MoneyCard label="Withdrawable" value={summary?.kpis?.withdrawableBalance} icon={Wallet} />
        <MoneyCard label="Withdrawn" value={summary?.kpis?.totalWithdrawn} icon={CreditCard} />
        <MoneyCard label="Bonus" value={summary?.kpis?.bonusEarnings} icon={Banknote} />
      </section>

      {loading ? <div className="h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" /> : null}

      {!loading && tab === "total" ? (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <DataTable
            columns={[
              { key: "date", label: "Date", render: (row) => row.date },
              { key: "commission", label: "Commission", align: "right", render: (row) => formatCurrency(row.commission || 0) },
              { key: "revenue", label: "Revenue", align: "right", render: (row) => formatCurrency(row.revenue || 0) },
              { key: "orders", label: "Orders", align: "right" },
            ]}
            rows={summary?.revenueTrend || []}
            empty="No revenue trend yet."
          />
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-950 dark:text-white">Wallet architecture</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p>Credits are created when existing commission records settle.</p>
              <p>Withdrawal requests reserve available balance into pending balance.</p>
              <p>Tax and bonus summaries are derived from ledger and commission records.</p>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && tab === "pending" ? (
        <DataTable
          columns={[
            { key: "referenceId", label: "Reference ID" },
            { key: "source", label: "Source" },
            { key: "orderId", label: "Order" },
            { key: "campaign", label: "Campaign" },
            { key: "amount", label: "Amount", align: "right", render: (row) => formatCurrency(row.amount || 0) },
            { key: "expectedApprovalDate", label: "Expected Approval", render: (row) => asDate(row.expectedApprovalDate) },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
          ]}
          rows={summary?.pendingEarnings || []}
        />
      ) : null}

      {!loading && tab === "approved" ? (
        <DataTable
          columns={[
            { key: "date", label: "Date", render: (row) => asDate(row.date) },
            { key: "source", label: "Source" },
            { key: "order", label: "Order" },
            { key: "campaign", label: "Campaign" },
            { key: "amount", label: "Amount", align: "right", render: (row) => formatCurrency(row.amount || 0) },
            { key: "commission", label: "Commission", align: "right", render: (row) => formatCurrency(row.commission || 0) },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
          ]}
          rows={summary?.approvedEarnings || []}
        />
      ) : null}

      {!loading && tab === "balance" ? (
        <div className="grid gap-4 md:grid-cols-4">
          <MoneyCard label="Available Balance" value={summary?.wallet?.availableBalance} />
          <MoneyCard label="Reserved Balance" value={summary?.wallet?.reservedBalance} />
          <MoneyCard label="Pending Balance" value={summary?.wallet?.pendingBalance} />
          <MoneyCard label="Total Balance" value={summary?.wallet?.totalBalance} />
        </div>
      ) : null}

      {!loading && tab === "history" ? (
        <div className="space-y-4">
          <label className="relative block max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search ledger..." className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          </label>
          <DataTable
            columns={[
              { key: "createdAt", label: "Date", render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleString() : "-" },
              { key: "type", label: "Type" },
              { key: "source", label: "Source" },
              { key: "amount", label: "Amount", align: "right", render: (row) => `${row.type === "CREDIT" ? "+" : "-"}${formatCurrency(row.amount || 0)}` },
              { key: "balanceAfter", label: "Running Balance", align: "right", render: (row) => formatCurrency(row.balanceAfter || 0) },
            ]}
            rows={historyRows}
          />
        </div>
      ) : null}

      {!loading && tab === "commission" ? (
        <DataTable
          columns={[
            { key: "productName", label: "Product" },
            { key: "campaign", label: "Campaign" },
            { key: "orders", label: "Orders", align: "right" },
            { key: "revenue", label: "Revenue", align: "right", render: (row) => formatCurrency(row.revenue || 0) },
            { key: "commissionRate", label: "Rate", align: "right", render: (row) => `${row.commissionRate || 0}%` },
            { key: "commissionEarned", label: "Commission", align: "right", render: (row) => formatCurrency(row.commissionEarned || 0) },
          ]}
          rows={summary?.commissionBreakdown?.products || []}
        />
      ) : null}

      {!loading && tab === "bonus" ? (
        <DataTable
          columns={[
            { key: "type", label: "Bonus Type" },
            { key: "description", label: "Description" },
            { key: "amount", label: "Amount", align: "right", render: (row) => formatCurrency(row.amount || 0) },
            { key: "count", label: "Count", align: "right" },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
          ]}
          rows={summary?.bonusEarnings || []}
          empty="No bonus incentives have been credited yet."
        />
      ) : null}

      {!loading && tab === "tax" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MoneyCard label="Taxable Income" value={summary?.taxSummary?.taxableIncome} icon={FileText} />
          <MoneyCard label="Total Earnings" value={summary?.taxSummary?.totalEarnings} icon={Banknote} />
          <MoneyCard label="Tax Withheld" value={summary?.taxSummary?.taxWithheld} icon={Landmark} />
          <MoneyCard label="Net Earnings" value={summary?.taxSummary?.netEarnings} icon={Wallet} />
          <MoneyCard label="Deductions" value={summary?.taxSummary?.deductions} icon={Download} />
        </div>
      ) : null}

      {!loading && tab === "request" ? <WithdrawalForm summary={summary} onSubmit={handleWithdrawal} busy={busy} /> : null}

      {!loading && ["withdrawal_pending", "withdrawal_approved", "withdrawal_rejected", "payments"].includes(tab) ? (
        <DataTable
          columns={[
            { key: "_id", label: "Request ID", render: (row) => String(row._id || "").slice(-8) },
            { key: "amount", label: "Amount", align: "right", render: (row) => formatCurrency(row.amount || 0) },
            { key: "paymentMethod", label: "Method" },
            { key: "requestedAt", label: "Request Date", render: (row) => asDate(row.requestedAt) },
            { key: "expectedProcessingAt", label: "Expected Processing", render: (row) => asDate(row.expectedProcessingAt || row.processedAt) },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
            { key: "action", label: "Action", render: (row) => ["PENDING", "UNDER_REVIEW"].includes(row.status) ? <button disabled={busy} onClick={() => handleCancel(row)} className="font-semibold text-rose-600 disabled:opacity-50">Cancel</button> : row.referenceNumber || "-" },
          ]}
          rows={withdrawalRows}
        />
      ) : null}

      {!loading && tab === "banks" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-950 dark:text-white">Default payout account</h3>
            {summary?.payoutAccount ? (
              <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <p>Holder: <span className="font-semibold text-slate-950 dark:text-white">{summary.payoutAccount.accountHolderName || "-"}</span></p>
                <p>Bank: <span className="font-semibold text-slate-950 dark:text-white">{summary.payoutAccount.bankName || "-"}</span></p>
                <p>Account: <span className="font-semibold text-slate-950 dark:text-white">{summary.payoutAccount.accountNumber || summary.payoutAccount.upiId || summary.payoutAccount.paypalEmail || "-"}</span></p>
                <p>Status: <StatusBadge value={summary.payoutAccount.verificationStatus} /></p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No payout account added yet.</p>
            )}
          </div>
          <BankAccountForm onSubmit={handleSaveAccount} busy={busy} />
        </div>
      ) : null}
    </div>
  );
}
