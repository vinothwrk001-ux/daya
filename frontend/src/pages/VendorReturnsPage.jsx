import { useCallback, useEffect, useState } from "react";
import { requestInput } from "../services/notificationService";
import { ReportingToolbar } from "../components/ReportingToolbar";
import { InlineToast } from "../components/commerce/InlineToast";
import { useReporting } from "../hooks/useReporting";
import { formatCurrency } from "../utils/formatCurrency";
import { StatusBadge } from "../components/StatusBadge";
import { VendorDataTable, VendorSection } from "../components/VendorPanel";
import * as vendorDashboardService from "../services/vendorDashboardService";

export function VendorReturnsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const reporting = useReporting({
    module: "returns",
  });

  const load = useCallback(async () => {
    try {
      const response = await vendorDashboardService.getVendorReturns({ limit: 20, ...reporting.appliedParams });
      setData(response.data);
      setError("");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load returns.");
    }
  }, [reporting.appliedParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);

    return () => clearTimeout(timer);
  }, [load]);

  async function updateReturn(id, status) {
    const resolutionNote = await requestInput({ title: "Update return", label: "Resolution note", defaultValue: "", required: false, multiline: true });
    if (resolutionNote == null) return;
    const refundAmount = status === "REFUNDED" ? await requestInput({ title: "Refund return", label: "Refund amount", defaultValue: "0" }) : 0;
    if (refundAmount == null) return;

    try {
      await vendorDashboardService.updateVendorReturn(id, {
        status,
        resolutionNote,
        refundAmount: Number(refundAmount || 0),
      });
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update return request.");
    }
  }

  async function handleExport(format) {
    try {
      await reporting.exportReport(format);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to export returns.");
    }
  }

  return (
    <VendorSection title="Returns & Refunds" description="Approve, reject, or refund return requests with a decision trail.">
      <div className="mb-4">
        <ReportingToolbar
          startDate={reporting.startDate}
          endDate={reporting.endDate}
          onDateChange={reporting.setDateRange}
          onApply={reporting.applyDateRange}
          onExport={handleExport}
          exportingFormat={reporting.exportingFormat}
          isDirty={reporting.hasPendingChanges}
        />
      </div>
      {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      <VendorDataTable
        rows={(data?.returns || []).map((item) => ({
          id: item._id,
          order: item.orderId?.orderNumber || "Order",
          customer: item.customerId?.name || "Customer",
          reason: item.reason,
          refundAmount: formatCurrency(item.refundAmount || 0),
          status: item.status,
        }))}
        columns={[
          { key: "order", label: "Order" },
          { key: "customer", label: "Customer" },
          { key: "reason", label: "Reason" },
          { key: "refundAmount", label: "Refund" },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
          {
            key: "actions",
            label: "Decision",
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                {["APPROVED", "REJECTED", "REFUNDED"].map((status) => (
                  <button key={status} onClick={() => updateReturn(row.id, status)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                    {status}
                  </button>
                ))}
              </div>
            ),
          },
        ]}
      />
      <InlineToast toast={reporting.toast} onClose={reporting.clearToast} />
    </VendorSection>
  );
}
