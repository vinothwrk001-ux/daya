import { useCallback, useEffect, useState } from "react";
import { InlineToast } from "../components/commerce/InlineToast";
import {
  FinanceInfoBanner,
  FinanceModal,
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
  return error?.response?.data?.message || error?.message || "Failed to load payout history.";
}

export function VendorFinancePayoutsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [status, setStatus] = useState("");
  const [pagination, setPagination] = useState({ page: 1, limit: 10, pages: 1, total: 0 });
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const loadRequests = useCallback(async (nextPage = 1) => {
    setLoading(true);
    setError("");
    try {
      const response = await vendorDashboardService.getVendorPayoutRequests({
        page: nextPage,
        limit: pagination.limit,
        ...(status ? { status } : {}),
      });
      setRequests(response.data?.requests || []);
      setPagination(response.data?.pagination || { page: 1, limit: 10, pages: 1, total: 0 });
    } catch (err) {
      const message = normalizeError(err);
      setError(message);
      setToast({ type: "error", message });
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, status]);

  useEffect(() => {
    loadRequests(1);
  }, [loadRequests]);

  return (
    <div className="space-y-6">
      <FinanceTabs items={financeTabs} />

      <FilterBar>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="PROCESSING">Processing</option>
          <option value="PAID">Paid</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </FilterBar>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <VendorSection title="Payout History" description="Track request amounts, review decisions, and final transfer references.">
        {loading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">Loading payout history...</div>
        ) : (
          <VendorDataTable
            rows={requests.map((request) => ({
              id: request._id,
              date: formatFinanceDateTime(request.requestedAt || request.createdAt),
              amount: formatCurrency(request.amount),
              status: request.status,
              transactionId: request.transactionId || "-",
              adminNote: request.adminNote || "-",
              raw: request,
            }))}
            columns={[
              { key: "date", label: "Date" },
              { key: "amount", label: "Amount" },
              { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
              { key: "transactionId", label: "Transaction ID" },
              { key: "adminNote", label: "Admin Note" },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <button type="button" onClick={() => setSelectedRequest(row.raw)} className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-300">
                    View Details
                  </button>
                ),
              },
            ]}
            emptyMessage="No payout requests found."
          />
        )}
      </VendorSection>

      <FinancePagination pagination={pagination} disabled={loading} onPageChange={loadRequests} />

      <FinanceModal
        open={Boolean(selectedRequest)}
        title="Payout request details"
        description="Review the current state before following up with support or finance."
        onClose={() => setSelectedRequest(null)}
      >
        {selectedRequest ? (
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between gap-3">
              <span>Status</span>
              <StatusBadge value={selectedRequest.status} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Amount</span>
              <span className="font-semibold text-slate-950 dark:text-white">{formatCurrency(selectedRequest.amount)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Requested</span>
              <span>{formatFinanceDateTime(selectedRequest.requestedAt || selectedRequest.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Transaction ID</span>
              <span>{selectedRequest.transactionId || "-"}</span>
            </div>
            {selectedRequest.adminNote ? (
              <FinanceInfoBanner title="Admin note">{selectedRequest.adminNote}</FinanceInfoBanner>
            ) : null}
          </div>
        ) : null}
      </FinanceModal>

      <InlineToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
