import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FinanceTabs } from "../components/finance/FinanceComponents";
import { listVendorInvoices } from "../services/invoiceService";
import { formatCurrency } from "../utils/formatCurrency";

const financeTabs = [
  { label: "Wallet", to: "/vendor/finance" },
  { label: "Payout History", to: "/vendor/finance/payouts" },
  { label: "Ledger", to: "/vendor/finance/ledger" },
  { label: "Payout Account", to: "/vendor/finance/account" },
  { label: "Invoices", to: "/vendor/finance/invoices" },
];

export function VendorInvoicesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    setLoading(true);
    listVendorInvoices({ page: 1, limit: 50 })
      .then((response) => setInvoices(response.invoices || []))
      .catch((err) => setError(err?.response?.data?.message || err?.message || "Failed to load vendor invoices."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="grid gap-6">
      <FinanceTabs items={financeTabs} />
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Vendor Invoices</h2>
        <p className="mt-1 text-sm text-slate-500">View invoice-ready order summaries without exposing platform-wide finance data.</p>
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Invoice</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Total</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? <tr><td className="px-4 py-8 text-slate-500" colSpan={5}>Loading invoices...</td></tr> : invoices.map((invoice) => (
                <tr key={invoice.orderId}>
                  <td className="px-4 py-3"><div className="font-semibold text-slate-950">{invoice.invoiceNumber}</div><div className="text-xs text-slate-500">{invoice.orderNumber}</div></td>
                  <td className="px-4 py-3 text-slate-700">{invoice.customerName}</td>
                  <td className="px-4 py-3 text-slate-700">{invoice.paymentStatus} / {invoice.orderStatus}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-950">{formatCurrency(invoice.totalAmount, { currency: invoice.currency })}</td>
                  <td className="px-4 py-3"><Link to={`/vendor/finance/invoices/${invoice.orderId}`} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
