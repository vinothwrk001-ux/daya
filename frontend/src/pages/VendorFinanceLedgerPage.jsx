import { useCallback, useEffect, useMemo, useState } from "react";
import { InlineToast } from "../components/commerce/InlineToast";
import {
  FinancePagination,
  FinanceTabs,
  formatFinanceDateTime,
} from "../components/finance/FinanceComponents";
import { FilterBar } from "../components/FilterBar";
import { StatusBadge } from "../components/StatusBadge";
import { VendorDataTable, VendorSection } from "../components/VendorPanel";
import * as vendorDashboardService from "../services/vendorDashboardService";
import { formatCurrency } from "../utils/formatCurrency";

const financeTabs = [
  { label: "Wallet", to: "/vendor/finance" },
  { label: "Payout History", to: "/vendor/finance/payouts" },
  { label: "Ledger", to: "/vendor/finance/ledger" },
  { label: "Payout Account", to: "/vendor/finance/account" },
  { label: "Invoices", to: "/vendor/finance/invoices" },
];

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Failed to load ledger.";
}

export function VendorFinanceLedgerPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [type, setType] = useState("");
  const [dateRange, setDateRange] = useState({ startDate: "", endDate: "" });
  const [appliedFilters, setAppliedFilters] = useState({ type: "", startDate: "", endDate: "" });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, pages: 1, total: 0 });
  const [entries, setEntries] = useState([]);

  const query = useMemo(
    () => ({
      page: pagination.page,
      limit: pagination.limit,
      ...(appliedFilters.type ? { type: appliedFilters.type } : {}),
      ...(appliedFilters.startDate ? { startDate: appliedFilters.startDate } : {}),
      ...(appliedFilters.endDate ? { endDate: appliedFilters.endDate } : {}),
    }),
    [appliedFilters, pagination.limit, pagination.page]
  );

  const loadLedger = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await vendorDashboardService.getVendorLedger(query);
      setEntries(response.data?.entries || []);
      setPagination((current) => {
        const next = { ...current, ...(response.data?.pagination || {}) };
        return current.page === next.page && current.limit === next.limit && current.pages === next.pages && current.total === next.total
          ? current
          : next;
      });
    } catch (err) {
      const message = normalizeError(err);
      setError(message);
      setToast({ type: "error", message });
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  function handleApplyFilters() {
    setPagination((current) => ({ ...current, page: 1 }));
    setAppliedFilters({
      type,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });
  }

  return (
    <div className="space-y-6">
      <FinanceTabs items={financeTabs} />

      <FilterBar
        actions={
          <button type="button" onClick={handleApplyFilters} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
            Apply Filters
          </button>
        }
      >
        <input type="date" value={dateRange.startDate} onChange={(event) => setDateRange((current) => ({ ...current, startDate: event.target.value }))} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
        <input type="date" value={dateRange.endDate} onChange={(event) => setDateRange((current) => ({ ...current, endDate: event.target.value }))} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
        <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
          <option value="">All types</option>
          <option value="CREDIT">Credit</option>
          <option value="DEBIT">Debit</option>
        </select>
      </FilterBar>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <VendorSection title="Transaction Ledger" description="This is the audit trail for every balance movement affecting your vendor wallet.">
        {loading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">Loading ledger...</div>
        ) : (
          <VendorDataTable
            rows={entries.map((entry) => ({
              id: entry._id,
              date: formatFinanceDateTime(entry.createdAt),
              type: entry.type,
              source: entry.source,
              amount: formatCurrency(entry.amount),
              balanceAfter: formatCurrency(entry.balanceAfter),
            }))}
            columns={[
              { key: "date", label: "Date" },
              { key: "type", label: "Type", render: (row) => <StatusBadge value={row.type} /> },
              { key: "source", label: "Source" },
              { key: "amount", label: "Amount" },
              { key: "balanceAfter", label: "Balance After" },
            ]}
            emptyMessage="No ledger transactions found for the selected filters."
          />
        )}
      </VendorSection>

      <FinancePagination
        pagination={pagination}
        disabled={loading}
        onPageChange={(page) => setPagination((current) => ({ ...current, page }))}
      />

      <InlineToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
