import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
} from "recharts";
import { getAnalytics, listCategories, listSellers } from "../services/adminApi";
import { ReportingToolbar } from "../components/ReportingToolbar";
import { InlineToast } from "../components/commerce/InlineToast";
import { useReporting } from "../hooks/useReporting";
import { formatCurrency } from "../utils/formatCurrency";
import { StatusBadge } from "../components/StatusBadge";

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Failed to load product analytics.";
}

const DEFAULT_FILTERS = {
  vendorId: "",
  categoryId: "",
  paymentMethod: "",
  orderStatus: "",
};

function truncateLabel(value, max = 18) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function CustomAxisTick({ x, y, payload, multiline = false }) {
  const raw = String(payload?.value || "");
  const text = truncateLabel(raw, multiline ? 42 : 18);
  const words = multiline ? text.split(" ") : [text];
  const lines = [];

  if (multiline) {
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length <= 18) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
      if (lines.length === 2) break;
    }
    if (current && lines.length < 2) lines.push(current);
  } else {
    lines.push(text);
  }

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={multiline ? 12 : 16} textAnchor="middle" fill="#64748b" fontSize={12}>
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={0} dy={index === 0 ? 0 : 14}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

export function AdminAnalyticsPage() {
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [analytics, setAnalytics] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reporting = useReporting({
    module: "analytics",
    getFilters: () => appliedFilters,
  });

  useEffect(() => {
    let active = true;
    Promise.all([listSellers(), listCategories()])
      .then(([vendorsResponse, categoriesResponse]) => {
        if (!active) return;
        setVendors(Array.isArray(vendorsResponse?.data) ? vendorsResponse.data : []);
        setCategories(Array.isArray(categoriesResponse?.data) ? categoriesResponse.data : []);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    getAnalytics({
      ...reporting.appliedParams,
      ...appliedFilters,
    })
      .then((response) => {
        if (!active) return;
        setAnalytics(response.data);
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

  const overview = analytics?.overview || {};
  const categoryPerformance = useMemo(() => analytics?.categoryPerformance || [], [analytics?.categoryPerformance]);
  const highestRevenueProducts = useMemo(() => analytics?.highestRevenueProducts || [], [analytics?.highestRevenueProducts]);
  const highestReturnProducts = analytics?.highestReturnProducts || [];
  const inventoryMovement = analytics?.inventoryMovement || [];
  const productRows = analytics?.productRows || [];
  const insights = analytics?.insights || {};

  const categoryChartData = useMemo(
    () =>
      categoryPerformance.slice(0, 8).map((row) => ({
        name: row.categoryName,
        revenue: Math.round(row.revenue || 0),
        orders: row.orders || 0,
      })),
    [categoryPerformance]
  );

  const productTrendData = useMemo(
    () =>
      highestRevenueProducts.slice(0, 8).map((row) => ({
        name: row.productName,
        revenue: Math.round(row.totalRevenue || 0),
        units: row.totalUnitsSold || 0,
        fullName: row.productName,
      })),
    [highestRevenueProducts]
  );

  function applyFilters() {
    setAppliedFilters(draftFilters);
    reporting.applyDateRange();
  }

  async function handleExport(format) {
    try {
      await reporting.exportReport(format);
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Global product filters</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Narrow performance by vendor, category, payment mode, and operational status.
            </p>
          </div>
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950"
          >
            Apply analytics filters
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FilterSelect
            label="Vendor"
            value={draftFilters.vendorId}
            onChange={(value) => setDraftFilters((current) => ({ ...current, vendorId: value }))}
            options={vendors.map((vendor) => ({
              value: vendor._id,
              label: vendor.shopName || vendor.companyName || vendor.userId?.name || vendor.vendorCode || vendor._id,
            }))}
          />
          <FilterSelect
            label="Category"
            value={draftFilters.categoryId}
            onChange={(value) => setDraftFilters((current) => ({ ...current, categoryId: value }))}
            options={categories.map((category) => ({
              value: category._id,
              label: category.name,
            }))}
          />
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
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total Product Revenue" value={formatCurrency(overview.totalProductRevenue)} hint="Gross product revenue across the active filter set" />
        <MetricCard label="Net Revenue" value={formatCurrency(overview.totalNetRevenue)} hint="Vendor net after commission deductions" />
        <MetricCard label="Units Sold" value={overview.unitsSold || 0} hint="Aggregated item quantity sold" />
        <MetricCard label="Avg Order Value" value={formatCurrency(overview.avgOrderValue)} hint="Revenue divided by product order volume" />
        <MetricCard label="Return Rate" value={`${Number(overview.returnRate || 0).toFixed(2)}%`} hint="Orders affected by approved or refunded returns" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <AnalyticsCard
          title="Category revenue contribution"
          description="Use this to spot the strongest product families and weaker category lanes."
        >
          <ChartContainer loading={loading} hasData={categoryChartData.length}>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={categoryChartData} margin={{ top: 10, right: 16, left: 8, bottom: 28 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.35} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  height={54}
                  tick={<CustomAxisTick />}
                />
                <YAxis tickLine={false} axisLine={false} width={64} />
                <Tooltip
                  formatter={(value, key) => [key === "revenue" ? formatCurrency(value) : value, key === "revenue" ? "Revenue" : "Orders"]}
                  labelFormatter={(label) => label}
                />
                <Bar dataKey="revenue" fill="#0f172a" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </AnalyticsCard>

        <AnalyticsCard
          title="Product revenue leaderboard"
          description="The most valuable products in the selected reporting window."
        >
          <ChartContainer loading={loading} hasData={productTrendData.length}>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={productTrendData} margin={{ top: 10, right: 16, left: 8, bottom: 56 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.35} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  height={82}
                  tick={<CustomAxisTick multiline />}
                />
                <YAxis tickLine={false} axisLine={false} width={64} />
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
                />
                <Line type="monotone" dataKey="revenue" stroke="#1d4ed8" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </AnalyticsCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <InsightPanel title="Top product" row={overview.topProduct} />
        <InsightPanel title="Fastest growing signal" row={insights.fastestGrowingProduct} />
        <InsightPanel title="High-return risk" row={insights.highReturnProduct} emphasize="returns" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <AnalyticsCard title="Highest return products" description="Products that need merchandising, QC, or packaging attention.">
          <CompactList
            rows={highestReturnProducts.slice(0, 8)}
            emptyMessage="No return-heavy products found for this range."
            renderExtra={(row) => `${Number(row.returnRate || 0).toFixed(2)}% return rate`}
          />
        </AnalyticsCard>

        <AnalyticsCard title="Inventory movement watchlist" description="Fast-moving and depletion-prone products that deserve replenishment focus.">
          <CompactList
            rows={inventoryMovement.slice(0, 8)}
            emptyMessage="Inventory movement data is not available yet."
            renderExtra={(row) =>
              `${Number(row.inventory?.stockVelocity || 0).toFixed(2)} units/day • ${Math.round(row.inventory?.estimatedDaysToStockout || 0)} days left`
            }
          />
        </AnalyticsCard>
      </div>

      <AnalyticsCard title="Product analytics table" description="Drill into individual products for revenue, operations, and inventory signals.">
        {loading ? (
          <div className="h-60 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        ) : productRows.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead>
                <tr>
                  <HeaderCell>Product</HeaderCell>
                  <HeaderCell>Revenue</HeaderCell>
                  <HeaderCell>Net</HeaderCell>
                  <HeaderCell>Units</HeaderCell>
                  <HeaderCell>Orders</HeaderCell>
                  <HeaderCell>Returns</HeaderCell>
                  <HeaderCell>Refunds</HeaderCell>
                  <HeaderCell>Stock</HeaderCell>
                  <HeaderCell>Status</HeaderCell>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {productRows.slice(0, 24).map((row) => (
                  <tr key={row.productId}>
                    <td className="px-3 py-3 align-top">
                      <Link to={`/admin/analytics/products/${row.productId}`} className="font-semibold text-slate-950 hover:underline dark:text-white">
                        {row.productName}
                      </Link>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{row.categoryName || "Uncategorized"}</div>
                    </td>
                    <BodyCell>{formatCurrency(row.totalRevenue)}</BodyCell>
                    <BodyCell>{formatCurrency(row.totalNetRevenue)}</BodyCell>
                    <BodyCell>{row.totalUnitsSold || 0}</BodyCell>
                    <BodyCell>{row.totalOrders || 0}</BodyCell>
                    <BodyCell>{row.totalReturns || 0}</BodyCell>
                    <BodyCell>{row.totalRefunds || 0}</BodyCell>
                    <BodyCell>
                      <div>{row.availableStock || 0}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {Math.round(row.estimatedDaysToStockout || 0)} days
                      </div>
                    </BodyCell>
                    <td className="px-3 py-3 align-top">
                      <StatusBadge value={row.productStatus || "UNKNOWN"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No product analytics rows match the current filter set." />
        )}
      </AnalyticsCard>

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
    <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{value}</div>
      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{hint}</div>
    </div>
  );
}

function AnalyticsCard({ title, description, children }) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ChartContainer({ loading, hasData, children }) {
  if (loading) return <div className="h-80 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />;
  if (!hasData) return <EmptyState message="No chart data is available for this range." />;
  return children;
}

function InsightPanel({ title, row, emphasize = "revenue" }) {
  return (
    <AnalyticsCard title={title}>
      {row ? (
        <div>
          <div className="text-lg font-semibold text-slate-950 dark:text-white">{row.productName}</div>
          <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{row.categoryName || "Uncategorized"}</div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <MiniStat label="Revenue" value={formatCurrency(row.totalRevenue)} />
            <MiniStat label="Units" value={row.totalUnitsSold || 0} />
            <MiniStat label="Return Rate" value={`${Number(row.returnRate || 0).toFixed(2)}%`} />
            <MiniStat
              label={emphasize === "returns" ? "Refunded" : "Net Revenue"}
              value={emphasize === "returns" ? formatCurrency(row.totalRefundedAmount) : formatCurrency(row.totalNetRevenue)}
            />
          </div>
        </div>
      ) : (
        <EmptyState message="Not enough analytics volume yet." />
      )}
    </AnalyticsCard>
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

function CompactList({ rows, renderExtra, emptyMessage }) {
  if (!rows.length) return <EmptyState message={emptyMessage} />;
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.productId} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 break-words font-semibold text-slate-950 dark:text-white">{row.productName}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{renderExtra(row)}</div>
            </div>
            <div className="shrink-0 text-right text-sm font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(row.totalRevenue || 0)}</div>
          </div>
        </div>
      ))}
    </div>
  );
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
