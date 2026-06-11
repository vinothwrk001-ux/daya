import { useCallback, useEffect, useState } from "react";
import { DailyRevenueChart } from "../components/DailyRevenueChart";
import { ReportingToolbar } from "../components/ReportingToolbar";
import { InlineToast } from "../components/commerce/InlineToast";
import { useReporting } from "../hooks/useReporting";
import { exportRevenueReport, getRevenueSummary } from "../services/adminApi";
import { formatCurrency } from "../utils/formatCurrency";

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

export function AdminRevenuePage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reporting = useReporting({
    module: "revenue",
    exporter: ({ format, startDate, endDate }) => exportRevenueReport({ format, startDate, endDate }),
  });

  const loadRevenue = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await getRevenueSummary(reporting.appliedParams);
      setSummary(response.data);
    } catch (loadError) {
      setError(normalizeError(loadError));
    } finally {
      setLoading(false);
    }
  }, [reporting.appliedParams]);

  useEffect(() => {
    loadRevenue();
  }, [loadRevenue]);

  return (
    <div className="grid gap-4">
      <ReportingToolbar
        startDate={reporting.startDate}
        endDate={reporting.endDate}
        onDateChange={reporting.setDateRange}
        onApply={reporting.applyDateRange}
        onExport={reporting.exportReport}
        exportingFormat={reporting.exportingFormat}
        isDirty={reporting.hasPendingChanges}
      />

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RevenueCard label="Total Sales" value={loading ? "..." : formatCurrency(summary?.totalSales || 0)} tone="blue" />
        <RevenueCard label="Platform Revenue" value={loading ? "..." : formatCurrency(summary?.platformRevenue || summary?.totalSales || 0)} tone="emerald" />
        <RevenueCard label="Valid Orders" value={loading ? "..." : summary?.totalOrders || 0} tone="slate" />
        <RevenueCard label="Average Order Value" value={loading ? "..." : formatCurrency(summary?.averageOrderValue || 0)} tone="purple" />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950 dark:text-white sm:text-lg">Revenue Trend</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Paid and fulfilled platform orders. Range: {summary?.dateRange || "All time"}
            </p>
          </div>
          <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Platform sales: {formatCurrency(summary?.platformRevenue || summary?.totalSales || 0)}
          </div>
        </div>
        <div className="mt-5">
          <DailyRevenueChart data={summary?.revenueTrend || []} loading={loading} type="combined" />
        </div>
      </section>

      <InlineToast toast={reporting.toast} onClose={reporting.clearToast} />
    </div>
  );
}

function RevenueCard({ label, value, tone }) {
  const tones = {
    slate: "from-slate-950 to-slate-700 text-white",
    blue: "from-blue-600 to-cyan-500 text-white",
    emerald: "from-emerald-500 to-green-500 text-white",
    purple: "from-purple-600 to-violet-500 text-white",
  };

  return (
    <div className={`rounded-3xl bg-gradient-to-br p-4 shadow-sm sm:p-5 ${tones[tone]}`}>
      <div className="text-sm font-medium opacity-90">{label}</div>
      <div className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{value}</div>
    </div>
  );
}
