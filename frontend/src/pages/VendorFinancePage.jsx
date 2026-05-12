import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { InlineToast } from "../components/commerce/InlineToast";
import {
  FinanceField,
  FinanceInfoBanner,
  FinanceInput,
  FinanceModal,
  FinanceTabs,
  formatFinanceDateTime,
  getPayoutAccountStatus,
  maskAccountNumber,
} from "../components/finance/FinanceComponents";
import { StatusBadge } from "../components/StatusBadge";
import { VendorDataTable, VendorMetricCard, VendorSection } from "../components/VendorPanel";
import { VendorPermissionGate } from "../components/VendorModuleRoute";
import * as vendorDashboardService from "../services/vendorDashboardService";
import { formatCurrency } from "../utils/formatCurrency";

const MIN_PAYOUT_AMOUNT = 500;

const financeTabs = [
  { label: "Wallet", to: "/vendor/finance" },
  { label: "Payout History", to: "/vendor/finance/payouts" },
  { label: "Ledger", to: "/vendor/finance/ledger" },
  { label: "Payout Account", to: "/vendor/finance/account" },
  { label: "Invoices", to: "/vendor/finance/invoices" },
];

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Something went wrong.";
}

export function VendorFinancePage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [consistency, setConsistency] = useState(null);
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [payoutAccount, setPayoutAccount] = useState(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [amount, setAmount] = useState("");

  async function loadFinance() {
    setLoading(true);
    setError("");

    try {
      const [walletRes, payoutRes, ledgerRes, accountRes] = await Promise.all([
        vendorDashboardService.getVendorWallet(),
        vendorDashboardService.getVendorPayoutRequests({ page: 1, limit: 5 }),
        vendorDashboardService.getVendorLedger({ page: 1, limit: 5 }),
        vendorDashboardService.getVendorPayoutAccount(),
      ]);

      setWallet(walletRes.data?.wallet || null);
      setConsistency(walletRes.data?.consistency || null);
      setPayoutRequests(payoutRes.data?.requests || []);
      setLedgerEntries(ledgerRes.data?.entries || []);
      setPayoutAccount(accountRes.data || null);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFinance();
  }, []);

  const availableBalance = Number(wallet?.availableBalance || 0);
  const parsedAmount = Number(amount || 0);
  const hasPendingRequest = useMemo(
    () => payoutRequests.some((request) => request.status === "PENDING"),
    [payoutRequests]
  );
  const payoutAccountStatus = getPayoutAccountStatus(payoutAccount);
  const validationMessage =
    !amount
      ? ""
      : parsedAmount < MIN_PAYOUT_AMOUNT
        ? `Minimum payout request amount is ${formatCurrency(MIN_PAYOUT_AMOUNT)}.`
        : parsedAmount > availableBalance
          ? "Requested amount exceeds available balance."
          : hasPendingRequest
            ? "A payout request is already pending review."
            : "";
  const canSubmit = Boolean(amount) && !validationMessage && !submitting;

  async function handleRequestPayout() {
    if (!canSubmit) return;

    setSubmitting(true);
    setError("");
    try {
      await vendorDashboardService.requestVendorPayout({ amount: parsedAmount });
      setToast({ type: "success", message: "Payout request submitted successfully." });
      setAmount("");
      setIsRequestModalOpen(false);
      await loadFinance();
    } catch (err) {
      const message = normalizeError(err);
      setError(message);
      setToast({ type: "error", message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <FinanceTabs items={financeTabs} />

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {consistency && !consistency.ledgerMatchesWallet ? (
        <FinanceInfoBanner tone="warning" title="Finance sync check">
          The latest ledger snapshot does not match the current wallet snapshot. Please avoid manual reconciliation until this is reviewed.
        </FinanceInfoBanner>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <VendorMetricCard label="Available Balance" value={formatCurrency(wallet?.availableBalance)} hint="Amount currently eligible for payout requests" />
        <VendorMetricCard label="Pending Balance" value={formatCurrency(wallet?.pendingBalance)} hint="Amount already reserved in payout workflow" />
        <VendorMetricCard label="Total Earnings" value={formatCurrency(wallet?.totalEarnings)} hint="Lifetime vendor earnings credited to wallet" />
        <VendorMetricCard label="Withdrawn Amount" value={formatCurrency(wallet?.withdrawnAmount)} hint="Total successfully paid out to your account" />
      </div>

      {/* Payout Account Details Section */}
      {payoutAccount && (payoutAccount.accountHolderName || payoutAccount.upiId) ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Payout Account Details</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Bank information from your registration
              </p>
            </div>
            <div>
              <StatusBadge value={payoutAccountStatus.label} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {payoutAccount.accountHolderName && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  Account Holder
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                  {payoutAccount.accountHolderName}
                </div>
              </div>
            )}

            {payoutAccount.bankName && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  Bank Name
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                  {payoutAccount.bankName}
                </div>
              </div>
            )}

            {payoutAccount.accountNumber && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  Account Number
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-950 dark:text-white font-mono">
                  {maskAccountNumber(payoutAccount.accountNumber)}
                </div>
              </div>
            )}

            {payoutAccount.ifscCode && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  IFSC Code
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-950 dark:text-white font-mono">
                  {payoutAccount.ifscCode}
                </div>
              </div>
            )}

            {payoutAccount.upiId && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  UPI ID
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-950 dark:text-white font-mono">
                  {payoutAccount.upiId}
                </div>
              </div>
            )}
          </div>

          {!payoutAccount.isVerified && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200">
              <div className="font-semibold">Pending Verification</div>
              <div className="mt-1">Your payout account details are under review. You can still request payouts, but they won't be processed until verified.</div>
            </div>
          )}

          <div className="mt-4">
            <Link
              to="/vendor/finance/account"
              className="inline-flex text-sm font-semibold text-sky-700 hover:underline dark:text-sky-300"
            >
              Update account details →
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800/40 dark:bg-amber-900/20">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-xl">⚠️</div>
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-200">No Payout Account Configured</h3>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                You haven't provided bank details yet. Add your payout account to enable withdrawals.
              </p>
              <Link
                to="/vendor/finance/account"
                className="mt-3 inline-flex rounded-lg bg-amber-900 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-950 dark:bg-amber-800 dark:hover:bg-amber-700"
              >
                Add Bank Details
              </Link>
            </div>
          </div>
        </div>
      )}

      <VendorSection
        title="Wallet Controls"
        description="Use verified payout details and request withdrawals against your available balance."
        action={
          <VendorPermissionGate
            permission="payments.update"
            fallback={
              <button type="button" disabled className="rounded-xl bg-slate-300 px-4 py-2 text-sm font-semibold text-white">
                Request Payout
              </button>
            }
          >
            <button
              type="button"
              disabled={loading || submitting}
              onClick={() => setIsRequestModalOpen(true)}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-950"
            >
              Request Payout
            </button>
          </VendorPermissionGate>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Payout readiness</div>
            <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Available now: <span className="font-semibold text-slate-950 dark:text-white">{formatCurrency(availableBalance)}</span>
            </div>
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Minimum request amount: <span className="font-semibold text-slate-950 dark:text-white">{formatCurrency(MIN_PAYOUT_AMOUNT)}</span>
            </div>
            {hasPendingRequest ? (
              <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                One payout request is already pending. Submit a new request after review is complete.
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Payout account</div>
                <div className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{payoutAccount?.bankName || payoutAccount?.upiId || "Not configured"}</div>
              </div>
              <StatusBadge value={payoutAccountStatus.label} />
            </div>
            <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              {payoutAccount?.isVerified
                ? "Your account is verified for finance operations."
                : "Add or update details to keep payout processing smooth."}
            </div>
            <Link to="/vendor/finance/account" className="mt-4 inline-flex text-sm font-semibold text-sky-700 hover:underline dark:text-sky-300">
              Manage account
            </Link>
          </div>
        </div>
      </VendorSection>

      <div className="grid gap-6 xl:grid-cols-2">
        <VendorSection title="Recent Payout Requests" description="Latest withdrawal requests and their review status.">
          {loading ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">Loading payout requests...</div>
          ) : (
            <VendorDataTable
              rows={payoutRequests.map((request) => ({
                id: request._id,
                requestedAt: formatFinanceDateTime(request.requestedAt || request.createdAt),
                amount: formatCurrency(request.amount),
                status: request.status,
                transactionId: request.transactionId || "-",
                adminNote: request.adminNote || "-",
              }))}
              columns={[
                { key: "requestedAt", label: "Date" },
                { key: "amount", label: "Amount" },
                { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
                { key: "transactionId", label: "Transaction ID" },
              ]}
              emptyMessage="No payout requests yet."
            />
          )}
          <div className="mt-4">
            <Link to="/vendor/finance/payouts" className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-300">
              View all payout history
            </Link>
          </div>
        </VendorSection>

        <VendorSection title="Recent Ledger Entries" description="Audit-friendly balance movements from orders, payouts, and reversals.">
          {loading ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">Loading ledger...</div>
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
              emptyMessage="No ledger entries yet."
            />
          )}
          <div className="mt-4">
            <Link to="/vendor/finance/ledger" className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-300">
              Open full ledger
            </Link>
          </div>
        </VendorSection>
      </div>

      <FinanceModal
        open={isRequestModalOpen}
        title="Request payout"
        description="Double-check the amount before submitting. Financial requests are tracked in the wallet ledger."
        onClose={() => {
          if (submitting) return;
          setIsRequestModalOpen(false);
        }}
        footer={
          <>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsRequestModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleRequestPayout}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-950"
            >
              {submitting ? "Requesting..." : "Request"}
            </button>
          </>
        }
      >
        <FinanceField label="Amount">
          <FinanceInput
            type="number"
            min={MIN_PAYOUT_AMOUNT}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Enter payout amount"
          />
        </FinanceField>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          <div>Available: {formatCurrency(availableBalance)}</div>
          <div className="mt-1">Minimum: {formatCurrency(MIN_PAYOUT_AMOUNT)}</div>
        </div>
        {payoutAccount?.isVerified !== true ? (
          <FinanceInfoBanner tone="warning" title="Account verification pending">
            You can submit the request now, but admin approval and payment can be delayed until payout details are verified.
          </FinanceInfoBanner>
        ) : null}
        {validationMessage ? <div className="text-sm font-medium text-rose-700 dark:text-rose-300">{validationMessage}</div> : null}
      </FinanceModal>

      <InlineToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
