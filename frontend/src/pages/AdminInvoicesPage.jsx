import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FinanceTabs } from "../components/finance/FinanceComponents";
import { ReportingToolbar } from "../components/ReportingToolbar";
import { listAdminInvoices } from "../services/invoiceService";
import { useReporting } from "../hooks/useReporting";
import { formatCurrency } from "../utils/formatCurrency";

const financeTabs = [
  { label: "Invoices", to: "/admin/finance/invoices" },
  { label: "Invoice Settings", to: "/admin/finance/invoices/settings" },
  { label: "Payout Management", to: "/admin/finance/payouts" },
];

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Failed to load invoices.";
}

export function AdminInvoicesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  const reporting = useReporting({
    module: "invoices",
    getFilters: () => ({}),
    onApply: () => {},
  });

  const fetchInvoices = (page = 1, search = "", startDate = null, endDate = null) => {
    setLoading(true);
    const params = { page, limit: 50, search };
    if (startDate) params.startDate = startDate.toISOString().split("T")[0];
    if (endDate) params.endDate = endDate.toISOString().split("T")[0];
    
    listAdminInvoices(params)
      .then((response) => {
        setInvoices(response.invoices || []);
        setError("");
      })
      .catch((err) => setError(normalizeError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInvoices(1, "", reporting.appliedStartDate, reporting.appliedEndDate);
  }, [reporting.appliedStartDate, reporting.appliedEndDate]);

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    fetchInvoices(1, query, reporting.appliedStartDate, reporting.appliedEndDate);
  };

  const handleExport = async (format) => {
    try {
      await reporting.exportReport(format);
    } catch (err) {
      setError(normalizeError(err));
    }
  };

  return (
    <div className="grid gap-6">
      <FinanceTabs items={financeTabs} />

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <ReportingToolbar
        startDate={reporting.startDate}
        endDate={reporting.endDate}
        onDateChange={reporting.setDateRange}
        onApply={reporting.applyDateRange}
        onExport={handleExport}
        exportingFormat={reporting.exportingFormat}
        isDirty={reporting.hasPendingChanges}
      />

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Invoice Registry</h2>
            <p className="mt-1 text-sm text-slate-500">Immutable order totals, editable invoice metadata, and PDF-ready previews.</p>
          </div>
        </div>

        <div className="mt-5 flex gap-3 mb-4">
          <input
            type="text"
            placeholder="Search by invoice #, order #, or phone..."
            value={searchQuery}
            onChange={handleSearch}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Invoice</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Vendor</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Total</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr><td className="px-4 py-8 text-slate-500" colSpan={6}>Loading invoices...</td></tr>
              ) : invoices.length ? (
                invoices.map((invoice) => (
                  <tr key={invoice.orderId}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-950">{invoice.invoiceNumber}</div>
                      <div className="text-xs text-slate-500">{invoice.orderNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{invoice.customerName}</td>
                    <td className="px-4 py-3 text-slate-700">{invoice.vendorName || "Platform Store"}</td>
                    <td className="px-4 py-3 text-slate-700">{invoice.paymentStatus} / {invoice.orderStatus}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-950">{formatCurrency(invoice.totalAmount, { currency: invoice.currency })}</td>
                    <td className="px-4 py-3">
                      <Link to={`/admin/orders/${invoice.orderId}/invoice`} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td className="px-4 py-8 text-slate-500" colSpan={6}>No invoices found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
