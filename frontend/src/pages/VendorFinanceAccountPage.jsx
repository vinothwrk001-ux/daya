import { useEffect, useState } from "react";
import { InlineToast } from "../components/commerce/InlineToast";
import {
  FinanceField,
  FinanceInput,
  FinanceInfoBanner,
  FinanceModal,
  FinanceTabs,
  getPayoutAccountStatus,
  maskAccountNumber,
} from "../components/finance/FinanceComponents";
import { StatusBadge } from "../components/StatusBadge";
import { VendorPermissionGate } from "../components/VendorModuleRoute";
import { VendorSection } from "../components/VendorPanel";
import * as vendorDashboardService from "../services/vendorDashboardService";

const financeTabs = [
  { label: "Wallet", to: "/vendor/finance" },
  { label: "Payout History", to: "/vendor/finance/payouts" },
  { label: "Ledger", to: "/vendor/finance/ledger" },
  { label: "Payout Account", to: "/vendor/finance/account" },
  { label: "Invoices", to: "/vendor/finance/invoices" },
];

const initialForm = {
  accountHolderName: "",
  accountNumber: "",
  ifscCode: "",
  bankName: "",
  upiId: "",
};

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Failed to load payout account.";
}

export function VendorFinanceAccountPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [account, setAccount] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [isModalOpen, setIsModalOpen] = useState(false);

  async function loadAccount() {
    setLoading(true);
    setError("");
    try {
      const response = await vendorDashboardService.getVendorPayoutAccount();
      const nextAccount = response.data || null;
      setAccount(nextAccount);
      setForm({
        accountHolderName: nextAccount?.accountHolderName || "",
        accountNumber: nextAccount?.accountNumber || "",
        ifscCode: nextAccount?.ifscCode || "",
        bankName: nextAccount?.bankName || "",
        upiId: nextAccount?.upiId || "",
      });
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccount();
  }, []);

  const status = getPayoutAccountStatus(account);

  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      await vendorDashboardService.updateVendorPayoutAccount(form);
      setToast({ type: "success", message: "Payout account submitted. Status is now pending verification." });
      setIsModalOpen(false);
      await loadAccount();
    } catch (err) {
      const message = normalizeError(err);
      setError(message);
      setToast({ type: "error", message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <FinanceTabs items={financeTabs} />

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <VendorSection
        title="Payout Account Management"
        description="Keep bank or UPI details current. Sensitive data is masked after save."
        action={
          <VendorPermissionGate
            permission="payments.update"
            fallback={
              <button type="button" disabled className="rounded-xl bg-slate-300 px-4 py-2 text-sm font-semibold text-white">
                Add / Update Account
              </button>
            }
          >
            <button type="button" onClick={() => setIsModalOpen(true)} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
              Add / Update Account
            </button>
          </VendorPermissionGate>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
            {loading ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">Loading payout account...</div>
            ) : (
              <div className="grid gap-3 text-sm text-slate-600 dark:text-slate-300">
                <div>Bank Name: <span className="font-semibold text-slate-950 dark:text-white">{account?.bankName || "Not added"}</span></div>
                <div>Account Number: <span className="font-semibold text-slate-950 dark:text-white">{maskAccountNumber(account?.accountNumber)}</span></div>
                <div>IFSC: <span className="font-semibold text-slate-950 dark:text-white">{account?.ifscCode || "Not added"}</span></div>
                <div>UPI ID: <span className="font-semibold text-slate-950 dark:text-white">{account?.upiId || "Not added"}</span></div>
                <div>Account Holder: <span className="font-semibold text-slate-950 dark:text-white">{account?.accountHolderName || "Not added"}</span></div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Verification status</div>
                <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">Payout reviews and approvals rely on this account status.</div>
              </div>
              <StatusBadge value={status.label} />
            </div>
            {!account?.isVerified ? (
              <FinanceInfoBanner tone="warning" title="Pending Verification">
                After you submit account details, finance operations continue with a pending verification state until admin review.
              </FinanceInfoBanner>
            ) : null}
          </div>
        </div>
      </VendorSection>

      <FinanceModal
        open={isModalOpen}
        title="Add or update payout account"
        description="Provide either complete bank details or a UPI ID. Finance uses these details during payout processing."
        onClose={() => {
          if (saving) return;
          setIsModalOpen(false);
        }}
        footer={
          <>
            <button type="button" disabled={saving} onClick={() => setIsModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">
              Cancel
            </button>
            <button type="button" disabled={saving} onClick={handleSubmit} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-950">
              {saving ? "Saving..." : "Save Account"}
            </button>
          </>
        }
      >
        <FinanceField label="Account Holder Name">
          <FinanceInput value={form.accountHolderName} onChange={(event) => setForm((current) => ({ ...current, accountHolderName: event.target.value }))} placeholder="Account holder name" />
        </FinanceField>
        <FinanceField label="Account Number">
          <FinanceInput value={form.accountNumber} onChange={(event) => setForm((current) => ({ ...current, accountNumber: event.target.value }))} placeholder="Bank account number" />
        </FinanceField>
        <FinanceField label="IFSC">
          <FinanceInput value={form.ifscCode} onChange={(event) => setForm((current) => ({ ...current, ifscCode: event.target.value.toUpperCase() }))} placeholder="IFSC code" />
        </FinanceField>
        <FinanceField label="Bank Name">
          <FinanceInput value={form.bankName} onChange={(event) => setForm((current) => ({ ...current, bankName: event.target.value }))} placeholder="Bank name" />
        </FinanceField>
        <FinanceField label="UPI ID">
          <FinanceInput value={form.upiId} onChange={(event) => setForm((current) => ({ ...current, upiId: event.target.value }))} placeholder="Optional UPI ID" />
        </FinanceField>
      </FinanceModal>

      <InlineToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
