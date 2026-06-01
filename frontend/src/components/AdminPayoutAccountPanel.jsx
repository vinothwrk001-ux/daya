import { useState } from "react";
import { confirmAction } from "../services/notificationService";
import {
  verifyPayoutAccount,
  rejectPayoutAccount,
} from "../services/payoutAccountService";

/**
 * AdminPayoutAccountVerificationPanel
 * Used in admin dashboard to verify/reject vendor payout accounts
 */
export function AdminPayoutAccountVerificationPanel({
  account,
  onSuccess,
  onError,
}) {
  const [verifying, setVerifying] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [error, setError] = useState("");

  if (!account) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        No payout account found for this vendor.
      </div>
    );
  }

  const isVerified = account.verificationStatus === "VERIFIED";
  const isRejected = account.verificationStatus === "REJECTED";

  const handleVerify = async () => {
    if (!(await confirmAction({ message: "Verify this payout account?", tone: "danger", confirmLabel: "Confirm" }))) return;

    setVerifying(true);
    setError("");
    try {
      await verifyPayoutAccount(account._id);
      if (onSuccess) onSuccess("Account verified successfully");
    } catch (err) {
      const msg =
        err?.response?.data?.message || err?.message || "Verification failed";
      setError(msg);
      if (onError) onError(msg);
    } finally {
      setVerifying(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError("Please enter a rejection reason (at least 10 characters)");
      return;
    }

    if (!(await confirmAction({ message: "Reject this payout account?", tone: "danger", confirmLabel: "Confirm" }))) return;

    setRejecting(true);
    setError("");
    try {
      await rejectPayoutAccount(account._id, rejectionReason);
      if (onSuccess) onSuccess("Account rejected successfully");
      setRejectionReason("");
      setShowRejectForm(false);
    } catch (err) {
      const msg =
        err?.response?.data?.message || err?.message || "Rejection failed";
      setError(msg);
      if (onError) onError(msg);
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Account Details */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 text-sm font-semibold text-slate-900">
          Payout Account Details
        </div>
        <div className="grid gap-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <span className="text-slate-600">Account Holder:</span>
            <span className="font-semibold">
              {account.accountHolderName || "—"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <span className="text-slate-600">Bank Name:</span>
            <span className="font-semibold">{account.bankName || "—"}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <span className="text-slate-600">Account Number:</span>
            <span className="font-mono font-semibold">
              {account.accountNumber || "XXXX****"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <span className="text-slate-600">IFSC Code:</span>
            <span className="font-mono font-semibold">
              {account.ifscCode || "—"}
            </span>
          </div>
          {account.upiId && (
            <div className="grid grid-cols-2 gap-2">
              <span className="text-slate-600">UPI ID:</span>
              <span className="font-mono font-semibold">{account.upiId}</span>
            </div>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-700">Status:</span>
        <div
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            account.verificationStatus === "VERIFIED"
              ? "bg-emerald-100 text-emerald-800"
              : account.verificationStatus === "REJECTED"
                ? "bg-rose-100 text-rose-800"
                : "bg-amber-100 text-amber-800"
          }`}
        >
          {account.verificationStatus}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Rejection Reason (if rejected) */}
      {isRejected && account.rejectionReason && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm">
          <div className="font-semibold text-rose-900">Rejection Reason:</div>
          <div className="mt-1 text-rose-800">{account.rejectionReason}</div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {!isVerified && !isRejected && (
          <>
            <button
              onClick={handleVerify}
              disabled={verifying || rejecting}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400"
            >
              {verifying ? "Verifying..." : "✓ Verify Account"}
            </button>
            <button
              onClick={() => setShowRejectForm(!showRejectForm)}
              disabled={verifying || rejecting || showRejectForm}
              className="flex-1 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:bg-slate-100"
            >
              ✗ Reject Account
            </button>
          </>
        )}

        {isRejected && !isVerified && (
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-400"
          >
            {verifying ? "Verifying..." : "Approve Resubmission"}
          </button>
        )}

        {isVerified && (
          <div className="flex-1 rounded-lg bg-emerald-100 px-4 py-2 text-center text-sm font-semibold text-emerald-800">
            ✓ Account Verified
          </div>
        )}
      </div>

      {/* Rejection Form */}
      {showRejectForm && !isVerified && (
        <div className="space-y-3 rounded-lg border border-rose-300 bg-rose-50 p-4">
          <label className="block text-sm font-semibold text-rose-900">
            Rejection Reason
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Provide a detailed reason for rejection (min 10 chars)..."
              minLength="10"
              maxLength="500"
              rows="3"
              className="mt-2 w-full rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
          </label>

          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={rejecting || rejectionReason.trim().length < 10}
              className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:bg-slate-400"
            >
              {rejecting ? "Rejecting..." : "Confirm Rejection"}
            </button>
            <button
              onClick={() => {
                setShowRejectForm(false);
                setRejectionReason("");
              }}
              disabled={rejecting}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="border-t border-slate-200 pt-3 text-xs text-slate-500">
        <div>Account Version: {account.version}</div>
        <div>Created: {new Date(account.createdAt).toLocaleString()}</div>
        {account.verifiedAt && (
          <div>
            Verified: {new Date(account.verifiedAt).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * AdminPayoutAccountsList
 * Shows a table/list of all vendor payout accounts for admin review
 */
export function AdminPayoutAccountsList({
  accounts = [],
  loading = false,
  onVerify,
  onReject,
}) {
  if (loading) {
    return (
      <div className="text-center py-8 text-slate-500">
        Loading payout accounts...
      </div>
    );
  }

  if (!accounts.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
        No payout accounts found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b-2 border-slate-300 bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-slate-900">
              Vendor
            </th>
            <th className="px-4 py-2 text-left font-semibold text-slate-900">
              Account Holder
            </th>
            <th className="px-4 py-2 text-left font-semibold text-slate-900">
              Bank
            </th>
            <th className="px-4 py-2 text-center font-semibold text-slate-900">
              Status
            </th>
            <th className="px-4 py-2 text-right font-semibold text-slate-900">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {accounts.map((account) => (
            <tr key={account._id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-900">
                <div className="font-semibold">
                  {account.vendorId?.companyName || "Unknown"}
                </div>
                <div className="text-xs text-slate-500">
                  {account.vendorId?.shopName}
                </div>
              </td>
              <td className="px-4 py-3 text-slate-700">
                {account.accountHolderName}
              </td>
              <td className="px-4 py-3">
                <div className="text-slate-900">{account.bankName}</div>
                <div className="text-xs text-slate-500">{account.ifscCode}</div>
              </td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                    account.verificationStatus === "VERIFIED"
                      ? "bg-emerald-100 text-emerald-800"
                      : account.verificationStatus === "REJECTED"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {account.verificationStatus}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  {account.verificationStatus !== "VERIFIED" && (
                    <button
                      onClick={() => onVerify?.(account._id)}
                      className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Verify
                    </button>
                  )}
                  {account.verificationStatus !== "REJECTED" && (
                    <button
                      onClick={() => onReject?.(account._id)}
                      className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      Reject
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
