import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { InlineToast } from "../components/commerce/InlineToast";
import {
  FinanceField,
  FinanceInfoBanner,
  FinanceInput,
  FinanceModal,
  FinancePagination,
  FinanceTabs,
  FinanceTextarea,
  formatFinanceDateTime,
} from "../components/finance/FinanceComponents";
import { FilterBar } from "../components/FilterBar";
import { PayoutCard } from "../components/PayoutCard";
import { StatusBadge } from "../components/StatusBadge";
import {
  approvePayoutRequest,
  listPayoutAccounts,
  listPayoutRequests,
  payPayoutRequest,
  rejectPayoutRequest,
  verifyVendorPayoutAccount,
} from "../services/adminApi";
import { formatCurrency } from "../utils/formatCurrency";

const financeTabs = [
  { label: "Invoices", to: "/admin/finance/invoices" },
  { label: "Invoice Settings", to: "/admin/finance/invoices/settings" },
  { label: "Payout Management", to: "/admin/finance/payouts" },
];

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Finance request failed.";
}

function buildOverview(requests = []) {
  return requests.reduce(
    (summary, request) => {
      const amount = Number(request.amount || 0);
      summary.totalAmount += amount;
      if (["PENDING", "APPROVED", "PROCESSING"].includes(request.status)) summary.pendingAmount += amount;
      if (request.status === "PAID") summary.paidAmount += amount;
      if (request.status === "REJECTED") summary.rejectedAmount += amount;
      return summary;
    },
    { totalAmount: 0, pendingAmount: 0, paidAmount: 0, rejectedAmount: 0 }
  );
}

export function AdminFinancePayoutManagementPage() {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [status, setStatus] = useState("");
  const [requests, setRequests] = useState([]);
  const [accountBusyId, setAccountBusyId] = useState("");
  const [pendingAccounts, setPendingAccounts] = useState([]);
  const [accountsPagination, setAccountsPagination] = useState({ page: 1, limit: 10, pages: 1, total: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, pages: 1, total: 0 });
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [payTarget, setPayTarget] = useState(null);
  const [adminNote, setAdminNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [payForm, setPayForm] = useState({ mode: "MANUAL", transactionId: "", adminNote: "" });

  async function loadRequests(nextPage = pagination.page) {
    setLoading(true);
    setError("");
    try {
      const response = await listPayoutRequests({
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
  }

  async function loadAccounts(nextPage = accountsPagination.page) {
    try {
      const response = await listPayoutAccounts({
        page: nextPage,
        limit: accountsPagination.limit,
        verified: "false",
      });
      setPendingAccounts(response.data?.accounts || []);
      setAccountsPagination(response.data?.pagination || { page: 1, limit: 10, pages: 1, total: 0 });
    } catch (err) {
      const message = normalizeError(err);
      setError(message);
      setToast({ type: "error", message });
    }
  }

  useEffect(() => {
    loadRequests(1);
    loadAccounts(1);
  }, [status]);

  async function handleVerifyAccount(account) {
    if (!account?._id) return;
    setAccountBusyId(account._id);
    setError("");
    try {
      await verifyVendorPayoutAccount(account._id);
      await loadAccounts(accountsPagination.page);
      setToast({ type: "success", message: "Payout account verified." });
    } catch (err) {
      const message = normalizeError(err);
      setError(message);
      setToast({ type: "error", message });
    } finally {
      setAccountBusyId("");
    }
  }

  async function runAction(target, handler, onSuccess) {
    if (!target?._id) return;
    setBusyId(target._id);
    setError("");
    try {
      await handler();
      await loadRequests(pagination.page);
      onSuccess?.();
    } catch (err) {
      const message = normalizeError(err);
      setError(message);
      setToast({ type: "error", message });
    } finally {
      setBusyId("");
    }
  }

  const overview = buildOverview(requests);

  return (
    <div className="space-y-6">
      <FinanceTabs items={financeTabs} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PayoutCard label="Total Requested" value={overview.totalAmount} hint="Current page payout request value" />
        <PayoutCard label="In Review" value={overview.pendingAmount} hint="Pending approval, approved, or processing" accent="bg-amber-100 text-amber-700" />
        <PayoutCard label="Paid" value={overview.paidAmount} hint="Successfully completed vendor withdrawals" accent="bg-emerald-100 text-emerald-700" />
        <PayoutCard label="Rejected" value={overview.rejectedAmount} hint="Requests returned to vendor wallet" accent="bg-rose-100 text-rose-700" />
      </div>

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

      <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="text-base font-semibold text-slate-950">Pending Payout Account Verification</div>
          <div className="mt-1 text-sm text-slate-500">Vendor bank and UPI submissions waiting for finance review.</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Vendor Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Bank / UPI</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Submitted</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">Loading payout accounts...</td></tr>
              ) : pendingAccounts.length ? (
                pendingAccounts.map((account) => (
                  <tr key={account._id}>
                    <td className="px-4 py-3">
                      <Link to={`/admin/vendors/${account.vendorId?._id}/finance`} className="font-semibold text-slate-950 hover:underline">
                        {account.vendorId?.companyName || account.vendorId?.shopName || "Vendor"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {account.bankName || account.accountNumber ? `${account.bankName || "Bank"} / ${account.accountNumber ? `****${String(account.accountNumber).slice(-4)}` : "-"}` : account.upiId || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatFinanceDateTime(account.createdAt)}</td>
                    <td className="px-4 py-3"><StatusBadge value={account.isVerified ? "VERIFIED" : "PENDING"} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          disabled={accountBusyId === account._id}
                          onClick={() => handleVerifyAccount(account)}
                          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {accountBusyId === account._id ? "Verifying..." : "Verify"}
                        </button>
                        <Link to={`/admin/vendors/${account.vendorId?._id}/finance`} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
                          View Vendor
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No pending payout account verifications found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 px-4 py-4">
          <FinancePagination pagination={accountsPagination} disabled={loading} onPageChange={loadAccounts} />
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Vendor Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Amount</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Requested Date</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Transaction ID</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Loading payout requests...</td></tr>
              ) : requests.length ? (
                requests.map((request) => (
                  <tr key={request._id}>
                    <td className="px-4 py-3">
                      <Link to={`/admin/vendors/${request.vendorId?._id}/finance`} className="font-semibold text-slate-950 hover:underline">
                        {request.vendorId?.companyName || request.vendorId?.shopName || "Vendor"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-950">{formatCurrency(request.amount)}</td>
                    <td className="px-4 py-3"><StatusBadge value={request.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{formatFinanceDateTime(request.requestedAt || request.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{request.transactionId || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {request.status === "PENDING" ? (
                          <>
                            <button type="button" disabled={busyId === request._id} onClick={() => { setApproveTarget(request); setAdminNote(request.adminNote || ""); }} className="rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                              Approve
                            </button>
                            <button type="button" disabled={busyId === request._id} onClick={() => { setRejectTarget(request); setRejectNote(request.adminNote || ""); }} className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                              Reject
                            </button>
                          </>
                        ) : null}
                        {request.status === "APPROVED" ? (
                          <>
                            <button type="button" disabled={busyId === request._id} onClick={() => { setPayTarget(request); setPayForm({ mode: "MANUAL", transactionId: request.transactionId || "", adminNote: request.adminNote || "" }); }} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                              Pay
                            </button>
                            <button type="button" disabled={busyId === request._id} onClick={() => { setRejectTarget(request); setRejectNote(request.adminNote || ""); }} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50">
                              Reject
                            </button>
                          </>
                        ) : null}
                        <Link to={`/admin/vendors/${request.vendorId?._id}/finance`} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
                          View Vendor
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No payout requests found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <FinancePagination pagination={pagination} disabled={loading} onPageChange={loadRequests} />

      <FinanceModal
        open={Boolean(approveTarget)}
        title="Approve payout request"
        description="Confirm that vendor details are ready and finance can move this request into the payable stage."
        onClose={() => setApproveTarget(null)}
        footer={
          <>
            <button type="button" disabled={busyId === approveTarget?._id} onClick={() => setApproveTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
              Cancel
            </button>
            <button
              type="button"
              disabled={busyId === approveTarget?._id}
              onClick={() =>
                runAction(
                  approveTarget,
                  () => approvePayoutRequest(approveTarget._id, { adminNote }),
                  () => {
                    setToast({ type: "success", message: "Payout request approved." });
                    setApproveTarget(null);
                  }
                )
              }
              className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busyId === approveTarget?._id ? "Approving..." : "Approve"}
            </button>
          </>
        }
      >
        <FinanceInfoBanner title="Amount">{formatCurrency(approveTarget?.amount || 0)}</FinanceInfoBanner>
        <FinanceField label="Admin Note">
          <FinanceTextarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Optional approval note for finance traceability" />
        </FinanceField>
      </FinanceModal>

      <FinanceModal
        open={Boolean(rejectTarget)}
        title="Reject payout request"
        description="Enter a clear rejection reason. The amount will be returned to available balance."
        onClose={() => setRejectTarget(null)}
        footer={
          <>
            <button type="button" disabled={busyId === rejectTarget?._id} onClick={() => setRejectTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
              Cancel
            </button>
            <button
              type="button"
              disabled={busyId === rejectTarget?._id || !rejectNote.trim()}
              onClick={() =>
                runAction(
                  rejectTarget,
                  () => rejectPayoutRequest(rejectTarget._id, { adminNote: rejectNote.trim() }),
                  () => {
                    setToast({ type: "success", message: "Payout request rejected." });
                    setRejectTarget(null);
                  }
                )
              }
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busyId === rejectTarget?._id ? "Rejecting..." : "Reject"}
            </button>
          </>
        }
      >
        <FinanceField label="Reason">
          <FinanceTextarea value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} placeholder="Explain why this request cannot be processed." />
        </FinanceField>
      </FinanceModal>

      <FinanceModal
        open={Boolean(payTarget)}
        title="Mark payout as paid"
        description="Use the actual transfer reference to keep finance records accurate."
        onClose={() => setPayTarget(null)}
        footer={
          <>
            <button type="button" disabled={busyId === payTarget?._id} onClick={() => setPayTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
              Cancel
            </button>
            <button
              type="button"
              disabled={busyId === payTarget?._id || (payForm.mode === "MANUAL" && !payForm.transactionId.trim())}
              onClick={() =>
                runAction(
                  payTarget,
                  () => payPayoutRequest(payTarget._id, { ...payForm, transactionId: payForm.transactionId.trim() }),
                  () => {
                    setToast({ type: "success", message: "Payout marked as paid." });
                    setPayTarget(null);
                  }
                )
              }
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busyId === payTarget?._id ? "Paying..." : "Confirm Payment"}
            </button>
          </>
        }
      >
        <FinanceField label="Payment Mode">
          <select value={payForm.mode} onChange={(event) => setPayForm((current) => ({ ...current, mode: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950">
            <option value="MANUAL">Manual</option>
            <option value="RAZORPAY">Razorpay</option>
          </select>
        </FinanceField>
        <FinanceField label="Transaction ID">
          <FinanceInput value={payForm.transactionId} onChange={(event) => setPayForm((current) => ({ ...current, transactionId: event.target.value }))} placeholder="Required for manual payouts" />
        </FinanceField>
        <FinanceField label="Admin Note">
          <FinanceTextarea value={payForm.adminNote} onChange={(event) => setPayForm((current) => ({ ...current, adminNote: event.target.value }))} placeholder="Optional payment note" />
        </FinanceField>
      </FinanceModal>

      <InlineToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
