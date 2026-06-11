import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import { getProductAnalyticsDetail } from "../services/adminApi";
import { ReportingToolbar } from "../components/ReportingToolbar";
import { useReporting } from "../hooks/useReporting";
import { formatCurrency } from "../utils/formatCurrency";
import { StatusBadge } from "../components/StatusBadge";
import { InlineToast } from "../components/commerce/InlineToast";

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Failed to load product detail analytics.";
}

export function AdminProductAnalyticsDetailPage() {
  const { productId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reporting = useReporting({
    module: "analytics",
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    getProductAnalyticsDetail(productId, reporting.appliedParams)
      .then((response) => {
        if (!active) return;
        setData(response.data);
      })
      .catch((err) => {
        if (!active) return;
        setError(normalizeError(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [productId, reporting.appliedParams]);

  async function handleExport(format) {
    try {
      await reporting.exportReport(format);
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  const product = data?.product || {};
  const summary = data?.summary || {};
  const trends = data?.trends || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link to="/admin/analytics" className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-300">
          Back to product analytics
        </Link>
        {product.productStatus ? <StatusBadge value={product.productStatus} /> : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <ReportingToolbar
        startDate={reporting.startDate}
        endDate={reporting.endDate}
        onDateChange={reporting.setDateRange}
        onApply={reporting.applyDateRange}
        onExport={handleExport}
        exportingFormat={reporting.exportingFormat}
        isDirty={reporting.hasPendingChanges}
      />

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">{product.productName || "Product analytics"}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {product.categoryName || "Uncategorized"} {product.sku ? `• SKU ${product.sku}` : ""}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <MiniStat label="Revenue" value={formatCurrency(summary.totalRevenue)} />
            <MiniStat label="Net Earnings" value={formatCurrency(summary.totalNetRevenue)} />
            <MiniStat label="Platform Fees" value={formatCurrency(summary.totalPlatformFees)} />
            <MiniStat label="Repeat Rate" value={`${Number(summary.repeatPurchaseRate || 0).toFixed(2)}%`} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Units Sold" value={summary.totalUnitsSold || 0} />
        <MetricCard label="Orders" value={summary.totalOrders || 0} />
        <MetricCard label="Returns" value={summary.totalReturns || 0} />
        <MetricCard label="Refunds" value={summary.totalRefunds || 0} />
        <MetricCard label="Available Stock" value={summary.availableStock || 0} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <ChartCard title="Daily sales and revenue">
          {loading ? (
            <Skeleton />
          ) : trends.daily?.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trends.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.35} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip formatter={(value, key) => [key === "grossRevenue" ? formatCurrency(value) : value, key === "grossRevenue" ? "Revenue" : "Units Sold"]} />
                <Line type="monotone" dataKey="grossRevenue" stroke="#0f172a" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="unitsSold" stroke="#1d4ed8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </ChartCard>

        <ChartCard title="Return and refund trend">
          {loading ? (
            <Skeleton />
          ) : trends.daily?.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trends.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.35} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="returnCount" fill="#dc2626" radius={[8, 8, 0, 0]} />
                <Bar dataKey="refundCount" fill="#f59e0b" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-5 text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
      {children}
    </section>
  );
}

function EmptyState() {
  return <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">No detail trend data available.</div>;
}

function Skeleton() {
  return <div className="h-72 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />;
}
