import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { InlineToast } from "../components/commerce/InlineToast";
import {
  FinanceInfoBanner,
  FinancePagination,
  FinanceTabs,
  formatFinanceDateTime,
  getPayoutAccountStatus,
  maskAccountNumber,
} from "../components/finance/FinanceComponents";
import { FilterBar } from "../components/FilterBar";
import { StatusBadge } from "../components/StatusBadge";
import { VendorDataTable, VendorMetricCard, VendorSection } from "../components/VendorPanel";
import {
  getAdminVendorLedger,
  getAdminVendorPayoutAccount,
  getAdminVendorWallet,
  getSellerDetails,
  listPayoutRequests,
  verifyVendorPayoutAccount,
} from "../services/adminApi";
import { formatCurrency } from "../utils/formatCurrency";

const financeTabs = [
  { label: "Payout Management", to: "/admin/finance/payouts" },
];

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Failed to load vendor finance data.";
}

export function AdminVendorFinancePage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [consistency, setConsistency] = useState(null);
  const [account, setAccount] = useState(null);
  const [requests, setRequests] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [type, setType] = useState("");
  const [pagination, setPagination] = useState({ page: 1, limit: 10, pages: 1, total: 0 });

  const accountStatus = getPayoutAccountStatus(account);

  const ledgerQuery = useMemo(
    () => ({
      page: pagination.page,
      limit: pagination.limit,
      ...(type ? { type } : {}),
    }),
    [pagination.limit, pagination.page, type]
  );

  const loadFinance = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [vendorRes, walletRes, ledgerRes, requestsRes, accountRes] = await Promise.all([
        getSellerDetails(id),
        getAdminVendorWallet(id),
        getAdminVendorLedger(id, ledgerQuery),
        listPayoutRequests({ vendorId: id, page: 1, limit: 10 }),
        getAdminVendorPayoutAccount(id),
      ]);
      setVendor(vendorRes.data || null);
      setWallet(walletRes.data?.wallet || null);
      setConsistency(walletRes.data?.consistency || null);
      setLedgerEntries(ledgerRes.data?.entries || []);
      setPagination((current) => {
        const next = { ...current, ...(ledgerRes.data?.pagination || {}) };
        return current.page === next.page && current.limit === next.limit && current.pages === next.pages && current.total === next.total
          ? current
          : next;
      });
      setRequests(requestsRes.data?.requests || []);
      setAccount(accountRes.data || null);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, [id, ledgerQuery]);

  useEffect(() => {
    loadFinance();
  }, [loadFinance]);

  async function handleVerifyAccount() {
    if (!account?._id) return;
    setVerifying(true);
    setError("");
    try {
      await verifyVendorPayoutAccount(account._id);
      setToast({ type: "success", message: "Vendor payout account verified." });
      await loadFinance();
    } catch (err) {
      const message = normalizeError(err);
      setError(message);
      setToast({ type: "error", message });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-6">
      <FinanceTabs items={financeTabs} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">Vendor finance</div>
          <div className="mt-1 text-2xl font-semibold text-slate-950">{vendor?.companyName || vendor?.shopName || "Vendor"}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/admin/sellers/${id}`} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            Vendor Profile
          </Link>
          <Link to="/admin/finance/payouts" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
            Back to Payouts
          </Link>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {consistency && !consistency.ledgerMatchesWallet ? (
        <FinanceInfoBanner tone="warning" title="Ledger mismatch detected">
          The current wallet snapshot does not match the latest ledger snapshot for this vendor.
        </FinanceInfoBanner>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <VendorMetricCard label="Available Balance" value={formatCurrency(wallet?.availableBalance)} hint="Amount available for vendor withdrawal" />
        <VendorMetricCard label="Pending Balance" value={formatCurrency(wallet?.pendingBalance)} hint="Reserved in open payout requests" />
        <VendorMetricCard label="Total Earnings" value={formatCurrency(wallet?.totalEarnings)} hint="Lifetime wallet credits" />
        <VendorMetricCard label="Withdrawn Amount" value={formatCurrency(wallet?.withdrawnAmount)} hint="Successfully paid out total" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <VendorSection title="Ledger History" description="Latest wallet-affecting transactions for this vendor.">
          <FilterBar>
            <select value={type} onChange={(event) => { setPagination((current) => ({ ...current, page: 1 })); setType(event.target.value); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm">
              <option value="">All types</option>
              <option value="CREDIT">Credit</option>
              <option value="DEBIT">Debit</option>
            </select>
          </FilterBar>
          <div className="mt-4">
            {loading ? (
              <div className="text-sm text-slate-500">Loading ledger...</div>
            ) : (
              <VendorDataTable
                rows={ledgerEntries.map((entry) => ({
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
                emptyMessage="No ledger entries found."
              />
            )}
          </div>
          <div className="mt-4">
            <FinancePagination pagination={pagination} disabled={loading} onPageChange={(page) => setPagination((current) => ({ ...current, page }))} />
          </div>
        </VendorSection>

        <VendorSection title="Payout Account" description="Verification state and destination details used during payout processing.">
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-3">
              <span>Status</span>
              <StatusBadge value={accountStatus.label} />
            </div>
            <div>Bank Name: <span className="font-semibold text-slate-950">{account?.bankName || "Not added"}</span></div>
            <div>Account Number: <span className="font-semibold text-slate-950">{maskAccountNumber(account?.accountNumber)}</span></div>
            <div>IFSC: <span className="font-semibold text-slate-950">{account?.ifscCode || "Not added"}</span></div>
            <div>UPI ID: <span className="font-semibold text-slate-950">{account?.upiId || "Not added"}</span></div>
          </div>
          {account && !account.isVerified ? (
            <button type="button" disabled={verifying} onClick={handleVerifyAccount} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {verifying ? "Verifying..." : "Verify Account"}
            </button>
          ) : null}
        </VendorSection>
      </div>

      <VendorSection title="Payout Requests" description="Review request status alongside notes and final transfer references.">
        {loading ? (
          <div className="text-sm text-slate-500">Loading payout requests...</div>
        ) : (
          <VendorDataTable
            rows={requests.map((request) => ({
              id: request._id,
              date: formatFinanceDateTime(request.requestedAt || request.createdAt),
              amount: formatCurrency(request.amount),
              status: request.status,
              transactionId: request.transactionId || "-",
              adminNote: request.adminNote || "-",
            }))}
            columns={[
              { key: "date", label: "Date" },
              { key: "amount", label: "Amount" },
              { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
              { key: "transactionId", label: "Transaction ID" },
              { key: "adminNote", label: "Admin Note" },
            ]}
            emptyMessage="No payout requests found."
          />
        )}
      </VendorSection>

      <InlineToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
