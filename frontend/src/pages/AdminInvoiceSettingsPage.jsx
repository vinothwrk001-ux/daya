import { useEffect, useMemo, useState } from "react";
import { FinanceField, FinanceInput, FinanceTabs, FinanceTextarea } from "../components/finance/FinanceComponents";
import { InvoicePreviewCard } from "../components/invoice/InvoicePreviewCard";
import { getInvoiceSettings, updateInvoiceSettings } from "../services/invoiceService";

const financeTabs = [
  { label: "Invoices", to: "/admin/finance/invoices" },
  { label: "Invoice Settings", to: "/admin/finance/invoices/settings" },
  { label: "Payout Management", to: "/admin/finance/payouts" },
];

const EMPTY_FORM = {
  organizationName: "",
  legalCompanyName: "",
  gstNumber: "",
  cinNumber: "",
  supportEmail: "",
  supportPhone: "",
  billingAddress: "",
  registeredAddress: "",
  taxLabel: "GST",
  invoicePrefix: "INV",
  footerNotes: "",
  companyWebsite: "",
  bankDetails: {
    accountName: "",
    accountNumber: "",
    ifscCode: "",
    bankName: "",
    branchName: "",
    upiId: "",
  },
};

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Failed to save invoice settings.";
}

export function AdminInvoiceSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [logoFile, setLogoFile] = useState(null);
  const [signatureFile, setSignatureFile] = useState(null);

  useEffect(() => {
    setLoading(true);
    getInvoiceSettings()
      .then((settings) => setForm({ ...EMPTY_FORM, ...settings, bankDetails: { ...EMPTY_FORM.bankDetails, ...(settings?.bankDetails || {}) } }))
      .catch((err) => setError(normalizeError(err)))
      .finally(() => setLoading(false));
  }, []);

  const previewInvoice = useMemo(
    () => ({
      invoiceNumber: `${form.invoicePrefix || "INV"}-PREVIEW-001`,
      orderNumber: "ORD-PREVIEW-001",
      orderDate: new Date().toISOString(),
      invoiceIssuedAt: new Date().toISOString(),
      customer: {
        name: "Preview Customer",
        phone: "+91 99999 99999",
        email: "customer@example.com",
        shippingAddress: {
          line1: "123 Billing Street",
          city: "Coimbatore",
          state: "Tamil Nadu",
          postalCode: "641001",
          country: "India",
        },
      },
      vendors: [{ name: "Preview Vendor" }],
      items: [{ lineId: "1", name: "Preview Item", variantName: "Default", variantSku: "SKU-001", quantity: 1, unitPrice: 1999, total: 1999 }],
      pricing: { currency: "INR", subtotal: 1999, deliveryFee: 50, platformFee: 20, paymentFee: 10, taxes: 0, discounts: 0, grandTotal: 2079 },
      payment: { method: "ONLINE", status: "Paid", transactionId: "pay_preview_001" },
      shipping: { shippingMethod: "Platform Shipping", courier: "Preview Courier", trackingNumber: "TRK123456" },
      organization: form,
      metadata: { version: 1, billingLabel: "Bill To", sellerLabel: "Sold By", gstLabel: form.taxLabel || "GST", customNotes: "", footerText: form.footerNotes || "" },
    }),
    [form]
  );

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key === "bankDetails") {
          body.append("bankDetails[accountName]", value.accountName || "");
          body.append("bankDetails[accountNumber]", value.accountNumber || "");
          body.append("bankDetails[ifscCode]", value.ifscCode || "");
          body.append("bankDetails[bankName]", value.bankName || "");
          body.append("bankDetails[branchName]", value.branchName || "");
          body.append("bankDetails[upiId]", value.upiId || "");
        } else {
          body.append(key, value || "");
        }
      });
      if (logoFile) body.append("logo", logoFile);
      if (signatureFile) body.append("signature", signatureFile);
      const saved = await updateInvoiceSettings(body, { isFormData: true });
      setForm({ ...EMPTY_FORM, ...saved, bankDetails: { ...EMPTY_FORM.bankDetails, ...(saved?.bankDetails || {}) } });
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <FinanceTabs items={financeTabs} />
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <form onSubmit={onSubmit} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Invoice Settings</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <FinanceField label="Organization Name"><FinanceInput value={form.organizationName} onChange={(e) => setForm((c) => ({ ...c, organizationName: e.target.value }))} /></FinanceField>
            <FinanceField label="Legal Company Name"><FinanceInput value={form.legalCompanyName} onChange={(e) => setForm((c) => ({ ...c, legalCompanyName: e.target.value }))} /></FinanceField>
            <FinanceField label="GST Number"><FinanceInput value={form.gstNumber} onChange={(e) => setForm((c) => ({ ...c, gstNumber: e.target.value }))} /></FinanceField>
            <FinanceField label="CIN Number"><FinanceInput value={form.cinNumber} onChange={(e) => setForm((c) => ({ ...c, cinNumber: e.target.value }))} /></FinanceField>
            <FinanceField label="Support Email"><FinanceInput value={form.supportEmail} onChange={(e) => setForm((c) => ({ ...c, supportEmail: e.target.value }))} /></FinanceField>
            <FinanceField label="Support Phone"><FinanceInput value={form.supportPhone} onChange={(e) => setForm((c) => ({ ...c, supportPhone: e.target.value }))} /></FinanceField>
            <FinanceField label="Invoice Prefix"><FinanceInput value={form.invoicePrefix} onChange={(e) => setForm((c) => ({ ...c, invoicePrefix: e.target.value }))} /></FinanceField>
            <FinanceField label="Tax Label"><FinanceInput value={form.taxLabel} onChange={(e) => setForm((c) => ({ ...c, taxLabel: e.target.value }))} /></FinanceField>
            <div className="sm:col-span-2"><FinanceField label="Billing Address"><FinanceTextarea rows={3} value={form.billingAddress} onChange={(e) => setForm((c) => ({ ...c, billingAddress: e.target.value }))} /></FinanceField></div>
            <div className="sm:col-span-2"><FinanceField label="Registered Address"><FinanceTextarea rows={3} value={form.registeredAddress} onChange={(e) => setForm((c) => ({ ...c, registeredAddress: e.target.value }))} /></FinanceField></div>
            <div className="sm:col-span-2"><FinanceField label="Footer Notes"><FinanceTextarea rows={4} value={form.footerNotes} onChange={(e) => setForm((c) => ({ ...c, footerNotes: e.target.value }))} /></FinanceField></div>
            <FinanceField label="Logo Upload"><input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} className="block w-full text-sm" /></FinanceField>
            <FinanceField label="Signature Upload"><input type="file" accept="image/*" onChange={(e) => setSignatureFile(e.target.files?.[0] || null)} className="block w-full text-sm" /></FinanceField>
          </div>

          <h3 className="mt-6 text-base font-semibold text-slate-950">Bank Details</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FinanceField label="Account Name"><FinanceInput value={form.bankDetails.accountName} onChange={(e) => setForm((c) => ({ ...c, bankDetails: { ...c.bankDetails, accountName: e.target.value } }))} /></FinanceField>
            <FinanceField label="Bank Name"><FinanceInput value={form.bankDetails.bankName} onChange={(e) => setForm((c) => ({ ...c, bankDetails: { ...c.bankDetails, bankName: e.target.value } }))} /></FinanceField>
            <FinanceField label="Account Number"><FinanceInput value={form.bankDetails.accountNumber} onChange={(e) => setForm((c) => ({ ...c, bankDetails: { ...c.bankDetails, accountNumber: e.target.value } }))} /></FinanceField>
            <FinanceField label="IFSC Code"><FinanceInput value={form.bankDetails.ifscCode} onChange={(e) => setForm((c) => ({ ...c, bankDetails: { ...c.bankDetails, ifscCode: e.target.value } }))} /></FinanceField>
            <FinanceField label="Branch Name"><FinanceInput value={form.bankDetails.branchName} onChange={(e) => setForm((c) => ({ ...c, bankDetails: { ...c.bankDetails, branchName: e.target.value } }))} /></FinanceField>
            <FinanceField label="UPI ID"><FinanceInput value={form.bankDetails.upiId} onChange={(e) => setForm((c) => ({ ...c, bankDetails: { ...c.bankDetails, upiId: e.target.value } }))} /></FinanceField>
          </div>

          <button type="submit" disabled={loading || saving} className="mt-6 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "Saving..." : "Save Invoice Settings"}
          </button>
        </form>

        <InvoicePreviewCard invoice={previewInvoice} />
      </div>
    </div>
  );
}
