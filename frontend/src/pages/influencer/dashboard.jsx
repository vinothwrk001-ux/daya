import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  Bell,
  ChevronRight,
  CircleDollarSign,
  Clapperboard,
  Download,
  Megaphone,
  Package,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart as ReAreaChart,
  CartesianGrid,
  Cell,
  Line as ReLine,
  LineChart as ReLineChart,
  Pie as RePie,
  PieChart as RePieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getInfluencerDashboard } from "../../services/influencerCommerceService";
import { formatCurrency } from "../../utils/formatCurrency";

const numberFormatter = new Intl.NumberFormat("en-IN");
const COLORS = ["#4f46e5", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444"];

const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "12m", label: "12 Months" },
  { value: "custom", label: "Custom" },
];

function formatValue(value, format) {
  if (format === "currency") return formatCurrency(value || 0);
  if (format === "percent") return `${Number(value || 0).toFixed(2)}%`;
  return numberFormatter.format(Number(value || 0));
}

function compactDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function shortText(value = "", max = 22) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function Card({ title, action, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function EmptyState({ label }) {
  return <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">{label}</div>;
}

function Sparkline({ values = [], positive = true }) {
  const data = values.length ? values.map((value, index) => ({ index, value })) : [{ index: 0, value: 0 }];
  return (
    <ResponsiveContainer width="100%" height={42}>
      <ReLineChart data={data} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
        <ReLine type="monotone" dataKey="value" stroke={positive ? "#16a34a" : "#dc2626"} strokeWidth={2} dot={false} />
      </ReLineChart>
    </ResponsiveContainer>
  );
}

function KpiCard({ item, loading }) {
  const positive = Number(item?.growth || 0) >= 0;
  if (loading) {
    return <div className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800" />;
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{formatValue(item.value, item.format)}</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${positive ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"}`}>
          {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {Math.abs(Number(item.growth || 0)).toFixed(1)}%
        </span>
      </div>
      <div className="mt-3 h-11">
        <Sparkline values={item.sparkline} positive={positive} />
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Compared with previous period</p>
    </div>
  );
}

function DashboardFilters({ filters, onChange, onRefresh, loading }) {
  function update(key, value) {
    onChange((current) => ({ ...current, [key]: value, page: 1 }));
  }

  return (
    <Card
      title="Dashboard"
      action={
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      }
      className="overflow-hidden"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <label className="xl:col-span-2">
          <span className="sr-only">Search</span>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={filters.search}
              onChange={(event) => update("search", event.target.value)}
              placeholder="Search products, campaigns"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-white"
            />
          </div>
        </label>
        <select value={filters.range} onChange={(event) => update("range", event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
          {RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <input type="date" value={filters.startDate} onChange={(event) => update("startDate", event.target.value)} disabled={filters.range !== "custom"} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
        <input type="date" value={filters.endDate} onChange={(event) => update("endDate", event.target.value)} disabled={filters.range !== "custom"} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
        <input value={filters.category} onChange={(event) => update("category", event.target.value)} placeholder="Category" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
        <input value={filters.brand} onChange={(event) => update("brand", event.target.value)} placeholder="Brand" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
      </div>
    </Card>
  );
}

function RevenueOverview({ data = [], metrics = {}, loading }) {
  return (
    <Card title="Revenue Overview" action={<Download className="h-4 w-4 text-slate-400" />} className="lg:col-span-6">
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        {[
          ["Gross", metrics.grossRevenue, "currency"],
          ["Commission", metrics.commissionRevenue, "currency"],
          ["Campaign", metrics.campaignRevenue, "currency"],
          ["AOV", metrics.averageOrderValue, "currency"],
        ].map(([label, value, format]) => (
          <div key={label} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950">
            <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
            <p className="font-semibold text-slate-950 dark:text-white">{formatValue(value, format)}</p>
          </div>
        ))}
      </div>
      {loading ? <EmptyState label="Loading revenue..." /> : data.length ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ReAreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={compactDate} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={56} />
              <Tooltip formatter={(value, name) => [name === "orders" ? value : formatCurrency(value), name]} />
              <Area type="monotone" dataKey="commission" stroke="#4f46e5" fill="url(#revenueFill)" strokeWidth={2} />
              <Area type="monotone" dataKey="revenue" stroke="#06b6d4" fillOpacity={0} strokeWidth={2} />
              <Area type="monotone" dataKey="orders" stroke="#22c55e" fillOpacity={0} strokeWidth={2} />
            </ReAreaChart>
          </ResponsiveContainer>
        </div>
      ) : <EmptyState label="No revenue in this period" />}
    </Card>
  );
}

function EarningsBreakdown({ rows = [] }) {
  const total = rows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return (
    <Card title="Earnings Breakdown" className="lg:col-span-3">
      {rows.length ? (
        <div className="grid gap-4 sm:grid-cols-[150px_1fr] lg:grid-cols-1 xl:grid-cols-[150px_1fr]">
          <div className="relative h-40">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <RePie data={rows} dataKey="amount" innerRadius={45} outerRadius={70} paddingAngle={3}>
                  {rows.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </RePie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </RePieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xs text-slate-500">Total</span>
              <span className="text-sm font-semibold text-slate-950 dark:text-white">{formatCurrency(total)}</span>
            </div>
          </div>
          <div className="space-y-2">
            {rows.map((item, index) => (
              <div key={item.source} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="truncate">{item.source}</span>
                </span>
                <span className="font-semibold text-slate-950 dark:text-white">{item.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : <EmptyState label="No earning sources yet" />}
    </Card>
  );
}

function TopProducts({ rows = [] }) {
  return (
    <Card title="Top Products" className="lg:col-span-3">
      <div className="space-y-3">
        {rows.length ? rows.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
              {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-slate-400" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{item.name}</p>
              <p className="text-xs text-slate-500">{item.orders} orders - {item.conversionRate}% CVR</p>
              {item.appliedRuleType ? <p className="mt-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300">{item.appliedRuleType} rule</p> : null}
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-950 dark:text-white">{formatCurrency(item.commission)}</p>
              <p className="text-xs text-slate-500">{formatCurrency(item.revenue)}</p>
            </div>
          </div>
        )) : <EmptyState label="No attributed products yet" />}
      </div>
    </Card>
  );
}

function RecentOrders({ data, onPage }) {
  const rows = data?.rows || [];
  return (
    <Card title="Recent Orders" className="lg:col-span-6">
      <div className="overflow-x-auto">
        <table className="min-w-[820px] w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[150px]" />
            <col className="w-[210px]" />
            <col className="w-[110px]" />
            <col className="w-[120px]" />
            <col className="w-[120px]" />
            <col className="w-[150px]" />
            <col className="w-[100px]" />
            <col className="w-[90px]" />
          </colgroup>
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              {["Order", "Product", "Customer", "Amount", "Commission", "Applied Rule", "Status", "Created"].map((head) => <th key={head} className="px-3 py-2 font-semibold">{head}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) => (
              <tr key={row.id} className="h-14 text-slate-700 dark:text-slate-200">
                <td className="truncate px-3 py-3 font-semibold" title={row.orderNumber}>{shortText(row.orderNumber, 18)}</td>
                <td className="truncate px-3 py-3" title={row.product}>{shortText(row.product, 28)}</td>
                <td className="truncate px-3 py-3" title={row.customer}>{shortText(row.customer, 14)}</td>
                <td className="whitespace-nowrap px-3 py-3">{formatCurrency(row.amount)}</td>
                <td className="whitespace-nowrap px-3 py-3">{formatCurrency(row.commission)}<div className="text-xs text-slate-500">{Number(row.commissionPercent || 0)}%</div></td>
                <td className="truncate px-3 py-3" title={row.appliedRule?.ruleName || row.appliedRuleType || ""}>
                  {row.appliedRuleType ? <span className="inline-flex rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">{shortText(row.appliedRuleType, 16)}</span> : "-"}
                </td>
                <td className="px-3 py-3"><span className="inline-flex max-w-full rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold dark:bg-slate-800">{shortText(row.status, 10)}</span></td>
                <td className="whitespace-nowrap px-3 py-3">{compactDate(row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length ? <EmptyState label="No recent orders found" /> : null}
      {data?.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
          <span>Page {data.page} of {data.totalPages}</span>
          <div className="flex gap-2">
            <button disabled={data.page <= 1} onClick={() => onPage(data.page - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700">Previous</button>
            <button disabled={data.page >= data.totalPages} onClick={() => onPage(data.page + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700">Next</button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function Campaigns({ rows = [] }) {
  return (
    <Card title="Active Campaigns" className="lg:col-span-3">
      <div className="space-y-3">
        {rows.length ? rows.slice(0, 5).map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-semibold text-slate-950 dark:text-white">{item.name}</p>
              <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">{item.status}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{item.brand} - {item.commissionPercent}% commission</p>
            {item.appliedRuleType ? <p className="mt-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300">Applied: {item.appliedRuleType} rule</p> : null}
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(item.revenueEarned)}</p>
          </div>
        )) : <EmptyState label="No active campaigns" />}
      </div>
    </Card>
  );
}

function FollowersGrowth({ rows = [] }) {
  return (
    <Card title="Followers Growth" className="lg:col-span-3">
      {rows.length ? (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ReLineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={compactDate} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={52} />
              <Tooltip />
              <ReLine type="monotone" dataKey="followers" stroke="#4f46e5" strokeWidth={2} dot={false} />
            </ReLineChart>
          </ResponsiveContainer>
        </div>
      ) : <EmptyState label="No follower trend available" />}
    </Card>
  );
}

function TopVideos({ rows = [] }) {
  return (
    <Card title="Top Videos" className="lg:col-span-4">
      <div className="space-y-3">
        {rows.length ? rows.slice(0, 5).map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            <div className="flex h-12 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
              <Clapperboard className="h-5 w-5 text-slate-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{item.title}</p>
              <p className="text-xs text-slate-500">{numberFormatter.format(item.views)} views - {numberFormatter.format(item.clicks)} clicks - {item.ctr}% CTR</p>
            </div>
            <p className="text-sm font-semibold text-slate-950 dark:text-white">{formatCurrency(item.revenue)}</p>
          </div>
        )) : <EmptyState label="No content performance yet" />}
      </div>
    </Card>
  );
}

function EarningsSummary({ data = {} }) {
  return (
    <Card title="Earnings Summary" className="lg:col-span-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["Pending", data.pending],
          ["Approved", data.approved],
          ["Withdrawable", data.withdrawable],
          ["Withdrawn", data.withdrawn],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-lg font-semibold text-slate-950 dark:text-white">{formatCurrency(value || 0)}</p>
          </div>
        ))}
      </div>
      <Link to="/influencer/earnings" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-300">
        View transactions <ChevronRight className="h-4 w-4" />
      </Link>
    </Card>
  );
}

function CommissionRuleSummary({ data = {} }) {
  const rule = data.mostAppliedRule || data.currentApplicableRule;
  return (
    <Card title="Applied Commission Rule" className="lg:col-span-4">
      {rule ? (
        <div className="space-y-3">
          <div className="rounded-xl bg-indigo-50 p-4 dark:bg-indigo-950/30">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">{rule.ruleTypeLabel || "Rule"}</p>
            <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{rule.ruleName || "Commission rule"}</p>
            <p className="mt-1 font-mono text-xs text-slate-500">{rule.ruleCode || rule.appliedRuleId || rule.id}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
              <p className="text-xs text-slate-500">Method</p>
              <p className="font-semibold capitalize text-slate-950 dark:text-white">{rule.commissionMethodLabel || "-"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
              <p className="text-xs text-slate-500">Rate</p>
              <p className="font-semibold text-slate-950 dark:text-white">{Number(rule.commissionPercent ?? rule.commissionValue ?? rule.revenueSharePercent ?? 0)}%</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
              <p className="text-xs text-slate-500">Version</p>
              <p className="font-semibold text-slate-950 dark:text-white">v{rule.appliedRuleVersion || rule.version || 1}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
              <p className="text-xs text-slate-500">Source</p>
              <p className="font-semibold capitalize text-slate-950 dark:text-white">{String(data.ruleSource || "").replace(/_/g, " ") || "-"}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{data.note}</p>
        </div>
      ) : (
        <EmptyState label="No active commission rule applies yet" />
      )}
    </Card>
  );
}

function Activity({ rows = [] }) {
  return (
    <Card title="Recent Activity" className="lg:col-span-4">
      <div className="space-y-3">
        {rows.length ? rows.slice(0, 6).map((item) => (
          <div key={item.id} className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
              {item.type === "campaign" ? <Megaphone className="h-4 w-4" /> : <CircleDollarSign className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950 dark:text-white">{item.title}</p>
              <p className="text-xs text-slate-500">{item.message}</p>
              <p className="text-xs text-slate-400">{compactDate(item.createdAt)}</p>
            </div>
          </div>
        )) : <EmptyState label="No recent activity" />}
      </div>
    </Card>
  );
}

function QuickActions({ rows = [] }) {
  const icons = {
    affiliate: Zap,
    product: Package,
    video: Clapperboard,
    collection: Sparkles,
    withdraw: Wallet,
    analytics: BarChart3,
  };
  return (
    <Card title="Quick Actions" className="lg:col-span-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.filter((item) => item.enabled).map((item) => {
          const Icon = icons[item.key] || ChevronRight;
          return (
            <Link key={item.key} to={item.href} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-3 text-sm font-semibold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-indigo-950/30">
              <Icon className="h-4 w-4 text-indigo-500" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

export default function InfluencerDashboardPage() {
  const [filters, setFilters] = useState({
    range: "30d",
    startDate: "",
    endDate: "",
    campaignId: "",
    productId: "",
    category: "",
    brand: "",
    marketplace: "",
    country: "",
    search: "",
    page: 1,
    limit: 8,
  });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedFilters(filters), 350);
    return () => clearTimeout(timeout);
  }, [filters]);

  const params = useMemo(() => {
    const next = { ...debouncedFilters };
    if (next.range !== "custom") {
      delete next.startDate;
      delete next.endDate;
    }
    delete next.search;
    Object.keys(next).forEach((key) => {
      if (next[key] === "") delete next[key];
    });
    return next;
  }, [debouncedFilters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getInfluencerDashboard(params);
      setData(response?.data || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load dashboard.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => load(), 60000);
    return () => clearInterval(interval);
  }, [load]);

  const filteredProducts = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    if (!term) return data?.topProducts || [];
    return (data?.topProducts || []).filter((item) => item.name.toLowerCase().includes(term));
  }, [data?.topProducts, filters.search]);

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
      <DashboardFilters filters={filters} onChange={setFilters} onRefresh={load} loading={loading} />

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {(data?.kpis || Array.from({ length: 6 })).map((item, index) => <KpiCard key={item?.key || index} item={item} loading={loading} />)}
      </section>

      <section className="grid gap-5 lg:grid-cols-12">
        <RevenueOverview data={data?.revenueOverview || []} metrics={data?.metrics || {}} loading={loading} />
        <EarningsBreakdown rows={data?.earningsBreakdown || []} />
        <TopProducts rows={filteredProducts} />
      </section>

      <section className="grid gap-5 lg:grid-cols-12">
        <RecentOrders data={data?.recentOrders} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
        <Campaigns rows={data?.activeCampaigns || []} />
        <FollowersGrowth rows={data?.followersGrowth || []} />
      </section>

      <section className="grid gap-5 lg:grid-cols-12">
        <TopVideos rows={data?.topVideos || []} />
        <CommissionRuleSummary data={data?.commissionRuleSummary || {}} />
        <EarningsSummary data={data?.earningsSummary || {}} />
        <Activity rows={data?.recentActivity || []} />
        <QuickActions rows={data?.quickActions || []} />
      </section>

      <section className="grid gap-5 lg:grid-cols-12">
        <Card title="Campaign Invitations" className="lg:col-span-8">
          <div className="space-y-3">
            {(data?.campaignInvitations || []).length ? data.campaignInvitations.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                <div>
                  <p className="font-semibold text-slate-950 dark:text-white">{item.name}</p>
                  <p className="text-sm text-slate-500">{item.brand} - {item.commissionPercent}% commission - invited {compactDate(item.startDate)}</p>
                  {item.appliedRuleType ? <p className="mt-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300">Rule type: {item.appliedRuleType}</p> : null}
                </div>
                <Link to="/influencer/campaigns" className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">Review</Link>
              </div>
            )) : <EmptyState label="No pending campaign invitations" />}
          </div>
        </Card>
        <Card title="Notifications" className="lg:col-span-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
            <Bell className="h-5 w-5 text-indigo-500" />
            <div>
              <p className="font-semibold text-slate-950 dark:text-white">{data?.notifications?.unreadCount || 0} unread</p>
              <p className="text-sm text-slate-500">Orders, campaigns, commissions, wallet, and system alerts.</p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
