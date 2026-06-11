import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FinanceField, FinanceInput, FinanceTabs, FinanceTextarea, formatFinanceDateTime } from "../components/finance/FinanceComponents";
import { InvoicePreviewCard } from "../components/invoice/InvoicePreviewCard";
import { downloadAdminInvoicePdf, getAdminInvoice, getAdminInvoiceAudit, updateAdminInvoiceMetadata } from "../services/invoiceService";

const financeTabs = [
  { label: "Invoices", to: "/admin/finance/invoices" },
  { label: "Invoice Settings", to: "/admin/finance/invoices/settings" },
];

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Failed to load invoice.";
}

export function AdminInvoiceDetailsPage() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    customNotes: "",
    footerText: "",
    billingLabel: "Bill To",
    issuerLabel: "Sold By",
    gstLabel: "GST",
    organizationOverrides: {
      organizationName: "",
      legalCompanyName: "",
      gstNumber: "",
      supportEmail: "",
      supportPhone: "",
      billingAddress: "",
      registeredAddress: "",
    },
  });

  const loadInvoice = useCallback(async () => {
    setLoading(true);
    try {
      const [invoiceResponse, auditResponse] = await Promise.all([getAdminInvoice(id), getAdminInvoiceAudit(id)]);
      setInvoice(invoiceResponse);
      setAudit(auditResponse.logs || []);
      setForm({
        customNotes: invoiceResponse.metadata?.customNotes || "",
        footerText: invoiceResponse.metadata?.footerText || "",
        billingLabel: invoiceResponse.metadata?.billingLabel || "Bill To",
        issuerLabel: invoiceResponse.metadata?.issuerLabel || "Sold By",
        gstLabel: invoiceResponse.metadata?.gstLabel || "GST",
        organizationOverrides: {
          organizationName: invoiceResponse.organization?.organizationName || "",
          legalCompanyName: invoiceResponse.organization?.legalCompanyName || "",
          gstNumber: invoiceResponse.organization?.gstNumber || "",
          supportEmail: invoiceResponse.organization?.supportEmail || "",
          supportPhone: invoiceResponse.organization?.supportPhone || "",
          billingAddress: invoiceResponse.organization?.billingAddress || "",
          registeredAddress: invoiceResponse.organization?.registeredAddress || "",
        },
      });
      setError("");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  async function onSave(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await updateAdminInvoiceMetadata(id, form);
      setInvoice(updated);
      await loadInvoice();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <FinanceTabs items={financeTabs} />
      <div className="flex items-center justify-between gap-3">
        <Link to="/admin/finance/invoices" className="text-sm font-semibold text-sky-700 hover:underline">Back to invoices</Link>
        <button type="button" onClick={() => downloadAdminInvoicePdf(id)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Download PDF</button>
      </div>
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_420px]">
        <InvoicePreviewCard invoice={invoice} />
        <div className="grid gap-6">
          <form onSubmit={onSave} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Editable Metadata</h2>
            <p className="mt-1 text-sm text-slate-500">These changes affect invoice presentation only. Order totals and payment values remain immutable.</p>
            <div className="mt-5 grid gap-4">
              <FinanceField label="Custom Notes"><FinanceTextarea rows={4} value={form.customNotes} onChange={(e) => setForm((c) => ({ ...c, customNotes: e.target.value }))} /></FinanceField>
              <FinanceField label="Footer Text"><FinanceTextarea rows={3} value={form.footerText} onChange={(e) => setForm((c) => ({ ...c, footerText: e.target.value }))} /></FinanceField>
              <FinanceField label="Billing Label"><FinanceInput value={form.billingLabel} onChange={(e) => setForm((c) => ({ ...c, billingLabel: e.target.value }))} /></FinanceField>
              <FinanceField label="Issuer Label"><FinanceInput value={form.issuerLabel} onChange={(e) => setForm((c) => ({ ...c, issuerLabel: e.target.value }))} /></FinanceField>
              <FinanceField label="GST Label"><FinanceInput value={form.gstLabel} onChange={(e) => setForm((c) => ({ ...c, gstLabel: e.target.value }))} /></FinanceField>
            </div>
            <button type="submit" disabled={loading || saving} className="mt-5 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? "Saving..." : "Save Metadata"}
            </button>
          </form>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Audit Trail</h2>
            <div className="mt-4 grid gap-3">
              {(audit || []).length ? audit.map((entry) => (
                <div key={entry._id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="font-semibold text-slate-950">{entry.action}</div>
                  <div className="mt-1 text-xs text-slate-500">{formatFinanceDateTime(entry.createdAt)}</div>
                  <pre className="mt-3 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(entry.changes || {}, null, 2)}</pre>
                </div>
              )) : <div className="text-sm text-slate-500">No invoice audit entries yet.</div>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
