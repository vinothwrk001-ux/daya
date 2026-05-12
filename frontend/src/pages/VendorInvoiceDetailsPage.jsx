import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FinanceTabs } from "../components/finance/FinanceComponents";
import { InvoicePreviewCard } from "../components/invoice/InvoicePreviewCard";
import { downloadVendorInvoicePdf, getVendorInvoice } from "../services/invoiceService";

const financeTabs = [
  { label: "Wallet", to: "/vendor/finance" },
  { label: "Payout History", to: "/vendor/finance/payouts" },
  { label: "Ledger", to: "/vendor/finance/ledger" },
  { label: "Payout Account", to: "/vendor/finance/account" },
  { label: "Invoices", to: "/vendor/finance/invoices" },
];

export function VendorInvoiceDetailsPage() {
  const { orderId } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    getVendorInvoice(orderId)
      .then((response) => setInvoice(response))
      .catch((err) => setError(err?.response?.data?.message || err?.message || "Failed to load invoice."))
      .finally(() => setLoading(false));
  }, [orderId]);

  return (
    <div className="grid gap-6">
      <FinanceTabs items={financeTabs} />
      <div className="flex items-center justify-between gap-3">
        <Link to="/vendor/finance/invoices" className="text-sm font-semibold text-sky-700 hover:underline">Back to invoices</Link>
        <button type="button" onClick={() => downloadVendorInvoicePdf(orderId)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Download PDF</button>
      </div>
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {loading ? <div className="h-80 animate-pulse rounded-3xl bg-slate-100" /> : <InvoicePreviewCard invoice={invoice} />}
    </div>
  );
}
