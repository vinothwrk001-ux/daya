import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import { ReportingToolbar } from "../components/ReportingToolbar";
import { InlineToast } from "../components/commerce/InlineToast";
import { useReporting } from "../hooks/useReporting";
import { formatCurrency } from "../utils/formatCurrency";
import { StatusBadge } from "../components/StatusBadge";
import { VendorSection } from "../components/VendorPanel";
import * as vendorDashboardService from "../services/vendorDashboardService";

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Failed to load vendor analytics.";
}

const DEFAULT_FILTERS = {
  paymentMethod: "",
  orderStatus: "",
};

export function VendorAnalyticsPage() {
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [data, setData] = useState(null);
  const [storefrontData, setStorefrontData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reporting = useReporting({
    module: "analytics",
    getFilters: () => appliedFilters,
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([
      vendorDashboardService.getVendorAnalytics({
        ...reporting.appliedParams,
        ...appliedFilters,
      }),
      vendorDashboardService.getVendorStorefrontAnalytics({ days: 30 }),
    ])
      .then(([response, storefrontResponse]) => {
        if (!active) return;
        setData(response.data);
        setStorefrontData(storefrontResponse.data);
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
  }, [appliedFilters, reporting.appliedParams]);

  async function handleExport(format) {
    try {
      await reporting.exportReport(format);
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  const overview = data?.overview || {};
  const topProducts = useMemo(() => data?.topProducts || [], [data?.topProducts]);
  const categoryPerformance = useMemo(() => data?.categoryPerformance || [], [data?.categoryPerformance]);
  const inventoryPerformance = data?.inventoryPerformance || [];
  const insights = data?.insights || {};

  const revenueChartData = useMemo(
    () =>
      topProducts.slice(0, 8).map((row) => ({
        name: row.productName,
        revenue: Math.round(row.totalRevenue || 0),
      })),
    [topProducts]
  );

  const categoryChartData = useMemo(
    () =>
      categoryPerformance.slice(0, 6).map((row) => ({
        name: row.categoryName,
        revenue: Math.round(row.revenue || 0),
        orders: row.orders || 0,
      })),
    [categoryPerformance]
  );

  return (
    <div className="space-y-6">
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

      <VendorSection
        title="Performance filters"
        description="Focus your catalog analytics by payment mode and operational state."
        action={(
          <button
            type="button"
            onClick={() => {
              setAppliedFilters(draftFilters);
              reporting.applyDateRange();
            }}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950"
          >
            Apply filters
          </button>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FilterSelect
            label="Payment Method"
            value={draftFilters.paymentMethod}
            onChange={(value) => setDraftFilters((current) => ({ ...current, paymentMethod: value }))}
            options={[
              { value: "ONLINE", label: "Online" },
              { value: "COD", label: "COD" },
            ]}
          />
          <FilterSelect
            label="Order Status"
            value={draftFilters.orderStatus}
            onChange={(value) => setDraftFilters((current) => ({ ...current, orderStatus: value }))}
            options={[
              { value: "Placed", label: "Placed" },
              { value: "Packed", label: "Packed" },
              { value: "Shipped", label: "Shipped" },
              { value: "Delivered", label: "Delivered" },
              { value: "Returned", label: "Returned" },
              { value: "Cancelled", label: "Cancelled" },
            ]}
          />
        </div>
      </VendorSection>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Product Revenue" value={formatCurrency(overview.totalProductRevenue)} hint="Gross catalog revenue for your store" />
        <MetricCard label="Net Revenue" value={formatCurrency(overview.totalNetRevenue)} hint="Net earnings after marketplace commission" />
        <MetricCard label="Units Sold" value={overview.unitsSold || 0} hint="Total quantity sold across your catalog" />
        <MetricCard label="Refund Rate" value={`${Number(overview.refundRate || 0).toFixed(2)}%`} hint="Orders that needed refunds" />
        <MetricCard label="Top Product" value={overview.topProduct?.productName || "None"} hint={overview.topProduct ? formatCurrency(overview.topProduct.totalRevenue) : "Waiting for more sales data"} />
      </div>

      <VendorSection title="Storefront analytics" description="Customer store visits, follows, product interactions, conversions, and retention signals.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Store Visits" value={storefrontData?.storeVisits || 0} hint={`${storefrontData?.uniqueVisitors || 0} unique visitors`} />
          <MetricCard label="Followers" value={storefrontData?.followers || 0} hint="Customers subscribed to vendor alerts" />
          <MetricCard label="Product Views" value={storefrontData?.productViews || 0} hint={`${storefrontData?.wishlistAdds || 0} wishlist adds`} />
          <MetricCard label="Conversions" value={storefrontData?.conversions || 0} hint={`${storefrontData?.cartAdds || 0} cart adds`} />
          <MetricCard label="Store Revenue" value={formatCurrency(storefrontData?.revenue || 0)} hint={`AOV ${formatCurrency(storefrontData?.averageOrderValue || 0)}`} />
        </div>
      </VendorSection>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <VendorSection title="Top product revenue" description="Your strongest product performers in the selected reporting range.">
          <ChartContainer loading={loading} hasData={revenueChartData.length}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <defs>
                  <linearGradient id="vendorRevenueFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#0f172a" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.35} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-18} textAnchor="end" height={70} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Area type="monotone" dataKey="revenue" stroke="#0f172a" fill="url(#vendorRevenueFill)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </VendorSection>

        <VendorSection title="Category traction" description="See which categories contribute the most vendor-side revenue and order flow.">
          <ChartContainer loading={loading} hasData={categoryChartData.length}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.35} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-18} textAnchor="end" height={70} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip formatter={(value, key) => [key === "revenue" ? formatCurrency(value) : value, key === "revenue" ? "Revenue" : "Orders"]} />
                <Bar dataKey="revenue" fill="#1d4ed8" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </VendorSection>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <InsightCard title="Fastest growing" row={insights.fastestGrowingProduct} />
        <InsightCard title="Best conversion signal" row={insights.highConversionProduct} />
        <InsightCard title="Return risk" row={insights.highReturnProduct} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <VendorSection title="Inventory performance" description="Fast and slow moving products based on stock velocity and projected depletion.">
          {loading ? (
            <Skeleton />
          ) : inventoryPerformance.length ? (
            <div className="space-y-3">
              {inventoryPerformance.slice(0, 8).map((row) => (
                <div key={row.productId} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/vendor/analytics/products/${row.productId}`} className="truncate font-semibold text-slate-950 hover:underline dark:text-white">
                        {row.productName}
                      </Link>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {Number(row.inventory?.stockVelocity || 0).toFixed(2)} units/day
                      </div>
                    </div>
                    <div className="text-right text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {Math.round(row.inventory?.estimatedDaysToStockout || 0)} days
                      <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                        {row.availableStock || 0} in stock
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="Inventory performance metrics will appear once sales and stock activity accumulate." />
          )}
        </VendorSection>

        <VendorSection title="Product performance table" description="Detailed view of your product-wise revenue, returns, and inventory posture.">
          {loading ? (
            <Skeleton />
          ) : topProducts.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead>
                  <tr>
                    <HeaderCell>Product</HeaderCell>
                    <HeaderCell>Revenue</HeaderCell>
                    <HeaderCell>Units</HeaderCell>
                    <HeaderCell>Orders</HeaderCell>
                    <HeaderCell>Return Rate</HeaderCell>
                    <HeaderCell>Stock</HeaderCell>
                    <HeaderCell>Status</HeaderCell>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {topProducts.slice(0, 16).map((row) => (
                    <tr key={row.productId}>
                      <td className="px-3 py-3 align-top">
                        <Link to={`/vendor/analytics/products/${row.productId}`} className="font-semibold text-slate-950 hover:underline dark:text-white">
                          {row.productName}
                        </Link>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{row.categoryName || "Uncategorized"}</div>
                      </td>
                      <BodyCell>{formatCurrency(row.totalRevenue)}</BodyCell>
                      <BodyCell>{row.totalUnitsSold || 0}</BodyCell>
                      <BodyCell>{row.totalOrders || 0}</BodyCell>
                      <BodyCell>{Number(row.returnRate || 0).toFixed(2)}%</BodyCell>
                      <BodyCell>{row.availableStock || 0}</BodyCell>
                      <td className="px-3 py-3 align-top">
                        <StatusBadge value={row.productStatus || "UNKNOWN"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No vendor products match the current analytics range." />
          )}
        </VendorSection>
      </div>

      <InlineToast toast={reporting.toast} onClose={reporting.clearToast} />
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-700 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricCard({ label, value, hint }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{value}</div>
      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{hint}</div>
    </div>
  );
}

function InsightCard({ title, row }) {
  return (
    <VendorSection title={title}>
      {row ? (
        <div className="space-y-3">
          <div className="text-lg font-semibold text-slate-950 dark:text-white">{row.productName}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">{row.categoryName || "Uncategorized"}</div>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Revenue" value={formatCurrency(row.totalRevenue)} />
            <MiniStat label="Units" value={row.totalUnitsSold || 0} />
            <MiniStat label="Return Rate" value={`${Number(row.returnRate || 0).toFixed(2)}%`} />
            <MiniStat label="Conversion" value={`${Number(row.conversionRate || 0).toFixed(2)}%`} />
          </div>
        </div>
      ) : (
        <EmptyState message="Not enough data yet for this insight." />
      )}
    </VendorSection>
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

function ChartContainer({ loading, hasData, children }) {
  if (loading) return <Skeleton />;
  if (!hasData) return <EmptyState message="No chart data available for this range." />;
  return children;
}

function HeaderCell({ children }) {
  return <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{children}</th>;
}

function BodyCell({ children }) {
  return <td className="px-3 py-3 align-top text-slate-700 dark:text-slate-200">{children}</td>;
}

function EmptyState({ message }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
      {message}
    </div>
  );
}

function Skeleton() {
  return <div className="h-60 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />;
}
