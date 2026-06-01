import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  Calculator,
  CheckCircle2,
  Download,
  FileCheck2,
  Link as LinkIcon,
  MessageSquare,
  Package,
  Percent,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  WalletCards,
  XCircle,
} from "lucide-react";
import {
  getAdminCampaignAnalytics,
  getAdminCommunicationCenter,
  getAdminCreatorPerformance,
  getAdminInfluencerCommerceDashboard,
  getAdminInfluencerReports,
  getAdminInfluencerSettings,
  getAdminInfluencerVendorMatching,
  getAdminRevenueAnalytics,
  getAdminVendorPerformance,
  getCommissionEngineDashboard,
  listAdminAffiliateProducts,
  listAdminAffiliateTracking,
  listAdminCampaignApplications,
  listAdminContentModeration,
  listAdminFraudAlerts,
  listAdminInfluencerCommerceCampaigns,
  listAdminInfluencerCommerceInfluencers,
  listAdminInfluencerCommerceVendors,
  listAdminInfluencerCommissions,
  listAdminInfluencerPayouts,
  listAdminInfluencerSettlements,
  listAdminInfluencerWithdrawals,
  listCommissionEngineAuditLogs,
  listCommissionEngineRules,
  listAdminProductPromotions,
  approveCommissionEngineRule,
  approveCommissionEngineSettlement,
  createCommissionEngineRule,
  createCommissionEngineSettlement,
  moderateAdminInfluencerContent,
  deactivateCommissionEngineRule,
  prepareCommissionEnginePayoutBatch,
  reviewAdminCampaignApplication,
  saveAdminInfluencerReportSchedule,
  simulateCommissionEngine,
  updateAdminFraudAlert,
  updateAdminInfluencerCommerceCampaign,
  updateAdminInfluencerCommission,
  updateAdminInfluencerSettings,
  updateAdminInfluencerWithdrawal,
  updateCommissionEngineRule,
} from "../services/adminInfluencerCommerceService";
import { formatCurrency } from "../utils/formatCurrency";

const MODULES = {
  dashboard: { label: "Dashboard", icon: BarChart3, path: "/admin/influencer-commerce" },
  influencers: { label: "Influencers", icon: Users, path: "/admin/influencer-commerce/influencers" },
  vendors: { label: "Vendors", icon: Users, path: "/admin/influencer-commerce/vendors" },
  campaigns: { label: "Campaign Management", icon: BarChart3, path: "/admin/influencer-commerce/campaigns" },
  applications: { label: "Campaign Applications", icon: FileCheck2, path: "/admin/influencer-commerce/applications" },
  matching: { label: "Influencer-Vendor Matching", icon: Search, path: "/admin/influencer-commerce/matching" },
  "affiliate-products": { label: "Affiliate Products", icon: Package, path: "/admin/influencer-commerce/affiliate-products" },
  tracking: { label: "Affiliate Tracking", icon: LinkIcon, path: "/admin/influencer-commerce/tracking" },
  content: { label: "Content Moderation", icon: FileCheck2, path: "/admin/influencer-commerce/content" },
  promotions: { label: "Product Promotions", icon: Package, path: "/admin/influencer-commerce/promotions" },
  "commission-engine": { label: "Commission Engine", icon: Percent, path: "/admin/influencer-commerce/commission-engine" },
  commissions: { label: "Commission Management", icon: WalletCards, path: "/admin/influencer-commerce/commissions" },
  settlements: { label: "Escrow & Settlements", icon: WalletCards, path: "/admin/influencer-commerce/settlements" },
  payouts: { label: "Payout Management", icon: WalletCards, path: "/admin/influencer-commerce/payouts" },
  withdrawals: { label: "Withdrawal Requests", icon: WalletCards, path: "/admin/influencer-commerce/withdrawals" },
  "creator-performance": { label: "Creator Performance", icon: BarChart3, path: "/admin/influencer-commerce/creator-performance" },
  "vendor-performance": { label: "Vendor Performance", icon: BarChart3, path: "/admin/influencer-commerce/vendor-performance" },
  "campaign-analytics": { label: "Campaign Analytics", icon: BarChart3, path: "/admin/influencer-commerce/campaign-analytics" },
  "revenue-analytics": { label: "Revenue Analytics", icon: BarChart3, path: "/admin/influencer-commerce/revenue-analytics" },
  fraud: { label: "Fraud & Compliance", icon: AlertTriangle, path: "/admin/influencer-commerce/fraud" },
  communication: { label: "Communication Center", icon: MessageSquare, path: "/admin/influencer-commerce/communication" },
  reports: { label: "Reports", icon: Download, path: "/admin/influencer-commerce/reports" },
  settings: { label: "Settings", icon: Settings, path: "/admin/influencer-commerce/settings" },
};

const MODULE_IDS = new Set(Object.keys(MODULES));
const defaultFilters = {
  search: "",
  vendorId: "",
  influencerId: "",
  campaignId: "",
  productId: "",
  category: "",
  status: "",
  startDate: "",
  endDate: "",
  page: 1,
  limit: 20,
};

const defaultRuleForm = {
  ruleName: "",
  ruleCode: "",
  ruleType: "global",
  priority: 0,
  commissionMethod: "percentage",
  commissionValue: 0,
  fixedAmount: 0,
  revenueSharePercent: 0,
  effectiveDate: new Date().toISOString().slice(0, 10),
  expiryDate: "",
  status: "pending_approval",
  description: "",
  categoryId: "",
  productId: "",
  campaignId: "",
  influencerId: "",
  affiliateId: "",
  trafficSource: "affiliate_link",
  customFormula: "",
};

const defaultBonusForm = {
  metric: "orders",
  operator: "gte",
  threshold: 100,
  type: "percent",
  value: 2,
};

const defaultSimulatorForm = {
  influencerId: "",
  campaignId: "",
  productId: "",
  categoryId: "",
  vendorId: "",
  trafficSource: "reels",
  revenue: 1000,
  expectedOrders: 100,
  conversionRate: 5,
  campaignCompletion: 90,
  reelEngagement: 0,
  reelEngagementTarget: 0,
  cycle: "weekly",
};

const defaultSettlementForm = {
  cycle: "weekly",
  periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  periodEnd: new Date().toISOString().slice(0, 10),
  settlementId: "",
};

const ruleTargetFields = {
  category: [["categoryId", "Category ID"]],
  product: [["productId", "Product ID"]],
  campaign: [["campaignId", "Campaign ID"]],
  influencer: [["influencerId", "Influencer ID"]],
  affiliate: [["affiliateId", "Affiliate ID"]],
};

const methodValueFields = {
  percentage: ["commissionValue"],
  fixed: ["fixedAmount"],
  hybrid: ["commissionValue", "fixedAmount"],
  tiered: ["commissionValue"],
  performance_bonus: ["commissionValue"],
  revenue_share: ["revenueSharePercent"],
  custom_formula: ["customFormula"],
};

function unwrap(response) {
  return response?.data ?? response ?? {};
}

function idOf(row) {
  return row?.id || row?._id;
}

function text(value, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function numberValue(value) {
  return Number(value || 0).toLocaleString();
}

function percentValue(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function dateValue(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
}

function statusText(value = "") {
  return String(value || "pending").replace(/_/g, " ");
}

function pickUserName(value) {
  return value?.name || value?.userId?.name || value?.profile?.name || value?.username || value?.userId?.email || "Creator";
}

function pickVendorName(value) {
  return value?.shopName || value?.companyName || value?.vendor?.shopName || value?.vendorId?.shopName || "Vendor";
}

function Section({ title, icon: Icon, action, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-indigo-500" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Metric({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}

function StatusBadge({ value }) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-200">
      {statusText(value)}
    </span>
  );
}

function FieldShell({ label, children, className = "" }) {
  return (
    <label className={`grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function ActionButton({ children, icon: Icon, tone = "indigo", disabled, onClick, type = "button" }) {
  const tones = {
    indigo: "bg-indigo-600 text-white hover:bg-indigo-500",
    slate: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200",
    green: "bg-emerald-600 text-white hover:bg-emerald-500",
    red: "bg-rose-600 text-white hover:bg-rose-500",
    amber: "bg-amber-500 text-white hover:bg-amber-400",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

function Filters({ filters, setFilters, compact = false }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-6">
      <label className="relative block md:col-span-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          value={filters.search}
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))}
          placeholder="Search influencer commerce"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          aria-label="Search influencer commerce"
        />
      </label>
      <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Status filter">
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="paid">Paid</option>
        <option value="hold">Hold</option>
      </select>
      {!compact ? (
        <>
          <input type="date" value={filters.startDate} onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value, page: 1 }))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Start date" />
          <input type="date" value={filters.endDate} onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value, page: 1 }))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="End date" />
          <input value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value, page: 1 }))} placeholder="Category" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Category filter" />
        </>
      ) : null}
    </div>
  );
}

function ResponsiveTable({ headers, rows, renderRow }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[980px] w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <tr>
            {headers.map((header) => (
              <th key={header} className="whitespace-nowrap px-3 py-3 font-semibold">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows?.length ? rows.map(renderRow) : (
            <tr>
              <td colSpan={headers.length} className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No records found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SimpleBars({ rows = [], valueKey = "revenue", labelKey = "date" }) {
  const max = Math.max(...rows.map((row) => Number(row[valueKey] || 0)), 1);
  return (
    <div className="flex h-52 items-end gap-2 overflow-x-auto rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
      {rows.map((row, index) => (
        <div key={`${row[labelKey] || index}-${index}`} className="flex min-w-8 flex-1 flex-col items-center gap-2">
          <div className="w-full rounded-t-lg bg-indigo-500" style={{ height: `${Math.max(6, (Number(row[valueKey] || 0) / max) * 170)}px` }} />
          <span className="max-w-16 truncate text-[10px] text-slate-500 dark:text-slate-400">{String(row[labelKey] || index).slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function Pagination({ pagination, setFilters }) {
  if (!pagination?.total) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
      <span>{numberValue(pagination.total)} records</span>
      <div className="flex items-center gap-2">
        <ActionButton tone="slate" disabled={pagination.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, Number(current.page || 1) - 1) }))}>Previous</ActionButton>
        <span>Page {pagination.page || 1} of {pagination.pages || 1}</span>
        <ActionButton tone="slate" disabled={(pagination.page || 1) >= (pagination.pages || 1)} onClick={() => setFilters((current) => ({ ...current, page: Number(current.page || 1) + 1 }))}>Next</ActionButton>
      </div>
    </div>
  );
}

export function AdminInfluencerCommercePage() {
  const location = useLocation();
  const moduleId = useMemo(() => {
    const suffix = location.pathname.replace(/^\/admin\/influencer-commerce\/?/, "");
    const next = suffix.split("/")[0] || "dashboard";
    return MODULE_IDS.has(next) ? next : null;
  }, [location.pathname]);
  const [filters, setFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [data, setData] = useState({});

  const params = useMemo(() => {
    const clean = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value) clean[key] = value;
    });
    return clean;
  }, [filters]);

  const fetcher = useMemo(() => ({
    dashboard: getAdminInfluencerCommerceDashboard,
    influencers: listAdminInfluencerCommerceInfluencers,
    vendors: listAdminInfluencerCommerceVendors,
    campaigns: listAdminInfluencerCommerceCampaigns,
    applications: listAdminCampaignApplications,
    matching: getAdminInfluencerVendorMatching,
    "affiliate-products": listAdminAffiliateProducts,
    tracking: listAdminAffiliateTracking,
    content: listAdminContentModeration,
    promotions: listAdminProductPromotions,
    "commission-engine": async (query) => {
      const [dashboard, rules, auditLogs] = await Promise.all([
        getCommissionEngineDashboard(query),
        listCommissionEngineRules({ limit: 100 }),
        listCommissionEngineAuditLogs({ limit: 10 }),
      ]);
      return {
        data: {
          dashboard: unwrap(dashboard),
          rules: unwrap(rules)?.rules || [],
          rulePagination: unwrap(rules)?.pagination,
          auditLogs: unwrap(auditLogs)?.logs || [],
        },
      };
    },
    commissions: listAdminInfluencerCommissions,
    settlements: listAdminInfluencerSettlements,
    payouts: listAdminInfluencerPayouts,
    withdrawals: listAdminInfluencerWithdrawals,
    "creator-performance": getAdminCreatorPerformance,
    "vendor-performance": getAdminVendorPerformance,
    "campaign-analytics": getAdminCampaignAnalytics,
    "revenue-analytics": getAdminRevenueAnalytics,
    fraud: listAdminFraudAlerts,
    communication: getAdminCommunicationCenter,
    reports: getAdminInfluencerReports,
    settings: getAdminInfluencerSettings,
  }), []);

  const load = useCallback(async () => {
    if (!moduleId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetcher[moduleId](moduleId === "settings" ? undefined : params);
      setData(unwrap(response));
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Unable to load influencer commerce data.");
    } finally {
      setLoading(false);
    }
  }, [fetcher, moduleId, params]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = useCallback(async (id, action, successMessage) => {
    setBusyId(id);
    setMessage("");
    setError("");
    try {
      await action();
      setMessage(successMessage);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Action failed.");
    } finally {
      setBusyId("");
    }
  }, [load]);

  if (!moduleId) return <Navigate to="/admin/influencer-commerce" replace />;

  const module = MODULES[moduleId];
  const Icon = module.icon;
  const items = data.items || [];
  const pagination = data.pagination;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-indigo-500" aria-hidden="true" />
            <h1 className="text-xl font-semibold text-slate-950 dark:text-white">{module.label}</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Admin control center synchronized with vendor and influencer commerce workflows.</p>
        </div>
        <ActionButton tone="slate" icon={RefreshCw} disabled={loading} onClick={load}>Refresh</ActionButton>
      </div>

      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">{message}</div> : null}
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{error}</div> : null}

      {moduleId !== "settings" ? <Filters filters={filters} setFilters={setFilters} compact={["dashboard", "reports"].includes(moduleId)} /> : null}
      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">Loading influencer commerce data...</div> : renderModule(moduleId, data, items, pagination, setFilters, runAction, busyId)}
    </div>
  );
}

function renderModule(moduleId, data, items, pagination, setFilters, runAction, busyId) {
  if (moduleId === "dashboard") return <DashboardView data={data} />;
  if (moduleId === "influencers") return <InfluencersView items={items} pagination={pagination} setFilters={setFilters} />;
  if (moduleId === "vendors") return <VendorsView items={items} pagination={pagination} setFilters={setFilters} />;
  if (moduleId === "campaigns") return <CampaignsView items={items} pagination={pagination} setFilters={setFilters} runAction={runAction} busyId={busyId} />;
  if (moduleId === "applications") return <ApplicationsView items={items} pagination={pagination} setFilters={setFilters} runAction={runAction} busyId={busyId} />;
  if (moduleId === "matching") return <MatchingView data={data} />;
  if (moduleId === "affiliate-products" || moduleId === "promotions") return <AffiliateProductsView items={items} pagination={pagination} setFilters={setFilters} title={moduleId === "promotions" ? "Product Promotions" : "Affiliate Products"} />;
  if (moduleId === "tracking") return <TrackingView items={items} pagination={pagination} setFilters={setFilters} />;
  if (moduleId === "content") return <ContentView items={items} pagination={pagination} setFilters={setFilters} runAction={runAction} busyId={busyId} />;
  if (moduleId === "commission-engine") return <CommissionEngineView data={data} refreshKey={busyId} runAction={runAction} />;
  if (moduleId === "commissions") return <CommissionsView items={items} pagination={pagination} setFilters={setFilters} runAction={runAction} busyId={busyId} />;
  if (moduleId === "settlements") return <SettlementsView items={items} pagination={pagination} setFilters={setFilters} />;
  if (moduleId === "payouts") return <PayoutsView items={items} pagination={pagination} setFilters={setFilters} />;
  if (moduleId === "withdrawals") return <WithdrawalsView items={items} pagination={pagination} setFilters={setFilters} runAction={runAction} busyId={busyId} />;
  if (moduleId === "creator-performance") return <PerformanceView title="Creator Performance" items={data.leaderboard || items} kind="creator" />;
  if (moduleId === "vendor-performance") return <PerformanceView title="Vendor Performance" items={data.leaderboard || items} kind="vendor" />;
  if (moduleId === "campaign-analytics") return <AnalyticsView title="Campaign Analytics" data={data} />;
  if (moduleId === "revenue-analytics") return <RevenueAnalyticsView data={data} />;
  if (moduleId === "fraud") return <FraudView items={items} pagination={pagination} setFilters={setFilters} runAction={runAction} busyId={busyId} />;
  if (moduleId === "communication") return <CommunicationView data={data} />;
  if (moduleId === "reports") return <ReportsView data={data} runAction={runAction} busyId={busyId} />;
  if (moduleId === "settings") return <SettingsView data={data} runAction={runAction} busyId={busyId} />;
  return null;
}

function DashboardView({ data }) {
  const metrics = data.metrics || {};
  const charts = data.charts || {};
  const widgets = data.widgets || {};
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric label="Total Influencers" value={numberValue(metrics.totalInfluencers)} />
        <Metric label="Active Influencers" value={numberValue(metrics.activeInfluencers)} />
        <Metric label="Total Vendors" value={numberValue(metrics.totalVendors)} />
        <Metric label="Active Campaigns" value={numberValue(metrics.activeCampaigns)} />
        <Metric label="Campaign Revenue" value={formatCurrency(metrics.campaignRevenue || 0)} />
        <Metric label="Commission Paid" value={formatCurrency(metrics.commissionPaid || 0)} />
        <Metric label="Escrow Balance" value={formatCurrency(metrics.escrowBalance || 0)} />
        <Metric label="Pending Withdrawals" value={numberValue(metrics.pendingWithdrawals)} />
        <Metric label="Content Pending Approval" value={numberValue(metrics.contentPendingApproval)} />
        <Metric label="Fraud Alerts" value={numberValue(metrics.fraudAlerts)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Revenue Trend" icon={BarChart3}><SimpleBars rows={charts.revenueTrend || []} valueKey="revenue" /></Section>
        <Section title="Commission Trend" icon={BarChart3}><SimpleBars rows={charts.commissionTrend || charts.revenueTrend || []} valueKey="commission" /></Section>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <MiniList title="Recent Campaigns" rows={widgets.recentCampaigns} label={(row) => row.title} value={(row) => <StatusBadge value={row.status || row.state} />} />
        <MiniList title="Top Influencers" rows={widgets.topInfluencers} label={pickUserName} value={(row) => formatCurrency(row.revenue || row.totalRevenue || 0)} />
        <MiniList title="Pending Withdrawals" rows={widgets.pendingWithdrawals} label={(row) => pickUserName(row.influencerId || row.influencer)} value={(row) => formatCurrency(row.amount || 0)} />
      </div>
    </div>
  );
}

function MiniList({ title, rows = [], label, value }) {
  return (
    <Section title={title} icon={SlidersHorizontal}>
      <div className="space-y-2">
        {rows?.length ? rows.slice(0, 6).map((row, index) => (
          <div key={idOf(row) || index} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950">
            <span className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">{label(row)}</span>
            <span className="shrink-0 text-slate-500 dark:text-slate-400">{value(row)}</span>
          </div>
        )) : <p className="text-sm text-slate-500 dark:text-slate-400">No records yet.</p>}
      </div>
    </Section>
  );
}

function InfluencersView({ items, pagination, setFilters }) {
  return (
    <Section title="Influencer Management" icon={Users}>
      <ResponsiveTable headers={["Influencer", "Email", "Category", "Followers", "Engagement", "Conversion", "Revenue", "Commission", "KYC", "Status"]} rows={items} renderRow={(row) => (
        <tr key={idOf(row)}>
          <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{pickUserName(row)}</td>
          <td className="px-3 py-3 text-slate-500">{text(row.email || row.userId?.email)}</td>
          <td className="px-3 py-3 text-slate-500">{text(row.category || row.niche)}</td>
          <td className="px-3 py-3">{numberValue(row.followers || row.totalFollowers)}</td>
          <td className="px-3 py-3">{percentValue(row.engagementRate)}</td>
          <td className="px-3 py-3">{percentValue(row.conversionRate)}</td>
          <td className="px-3 py-3">{formatCurrency(row.revenueGenerated || row.revenue || 0)}</td>
          <td className="px-3 py-3">{formatCurrency(row.commissionEarned || row.commission || 0)}</td>
          <td className="px-3 py-3"><StatusBadge value={row.kycStatus || row.verificationStatus} /></td>
          <td className="px-3 py-3"><StatusBadge value={row.accountStatus || row.status} /></td>
        </tr>
      )} />
      <Pagination pagination={pagination} setFilters={setFilters} />
    </Section>
  );
}

function VendorsView({ items, pagination, setFilters }) {
  return (
    <Section title="Vendor Commerce Oversight" icon={Users}>
      <ResponsiveTable headers={["Vendor", "Active Campaigns", "Influencers", "Revenue", "Commission Liability", "Escrow Usage", "Pending Settlements", "Fraud Flags", "Status"]} rows={items} renderRow={(row) => (
        <tr key={idOf(row)}>
          <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{pickVendorName(row)}</td>
          <td className="px-3 py-3">{numberValue(row.activeCampaigns)}</td>
          <td className="px-3 py-3">{numberValue(row.influencersConnected)}</td>
          <td className="px-3 py-3">{formatCurrency(row.campaignRevenue || 0)}</td>
          <td className="px-3 py-3">{formatCurrency(row.commissionLiability || 0)}</td>
          <td className="px-3 py-3">{formatCurrency(row.escrowUsage || 0)}</td>
          <td className="px-3 py-3">{numberValue(row.pendingSettlements)}</td>
          <td className="px-3 py-3">{numberValue(row.fraudFlags)}</td>
          <td className="px-3 py-3"><StatusBadge value={row.status} /></td>
        </tr>
      )} />
      <Pagination pagination={pagination} setFilters={setFilters} />
    </Section>
  );
}

function CampaignsView({ items, pagination, setFilters, runAction, busyId }) {
  return (
    <Section title="Campaign Center" icon={BarChart3}>
      <ResponsiveTable headers={["Campaign", "Vendor", "Budget", "Revenue", "Applications", "Creators", "Products", "Commission", "Status", "Actions"]} rows={items} renderRow={(row) => {
        const id = idOf(row);
        return (
          <tr key={id}>
            <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{text(row.title)}</td>
            <td className="px-3 py-3 text-slate-500">{pickVendorName(row.vendorId || row.vendor)}</td>
            <td className="px-3 py-3">{formatCurrency(row.budget || row.fixedFee || 0)}</td>
            <td className="px-3 py-3">{formatCurrency(row.revenue || 0)}</td>
            <td className="px-3 py-3">{numberValue(row.applicationsCount || row.applications?.length)}</td>
            <td className="px-3 py-3">{numberValue(row.approvedCreators || row.approvedInfluencers?.length)}</td>
            <td className="px-3 py-3">{numberValue(row.products?.length || row.productIds?.length)}</td>
            <td className="px-3 py-3">{percentValue(row.commissionPercent || row.commissionRate)}</td>
            <td className="px-3 py-3"><StatusBadge value={row.status || row.state} /></td>
            <td className="px-3 py-3">
              <div className="flex flex-wrap gap-2">
                <ActionButton tone="amber" disabled={busyId === `pause-${id}`} onClick={() => runAction(`pause-${id}`, () => updateAdminInfluencerCommerceCampaign(id, { status: "paused" }), "Campaign paused.")}>Pause</ActionButton>
                <ActionButton tone="slate" disabled={busyId === `feature-${id}`} onClick={() => runAction(`feature-${id}`, () => updateAdminInfluencerCommerceCampaign(id, { featured: true }), "Campaign featured.")}>Feature</ActionButton>
                <ActionButton tone="red" disabled={busyId === `close-${id}`} onClick={() => runAction(`close-${id}`, () => updateAdminInfluencerCommerceCampaign(id, { status: "closed" }), "Campaign closed.")}>Close</ActionButton>
              </div>
            </td>
          </tr>
        );
      }} />
      <Pagination pagination={pagination} setFilters={setFilters} />
    </Section>
  );
}

function ApplicationsView({ items, pagination, setFilters, runAction, busyId }) {
  return (
    <Section title="Campaign Applications" icon={FileCheck2}>
      <ResponsiveTable headers={["Influencer", "Vendor", "Campaign", "Status", "Expected Earnings", "Submitted", "Reviewed", "Actions"]} rows={items} renderRow={(row) => {
        const campaignId = idOf(row.campaignId || row.campaign);
        const influencerId = idOf(row.influencerId || row.influencer);
        const id = `${campaignId}-${influencerId}`;
        return (
          <tr key={id}>
            <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{pickUserName(row.influencerId || row.influencer)}</td>
            <td className="px-3 py-3 text-slate-500">{pickVendorName(row.vendorId || row.vendor)}</td>
            <td className="px-3 py-3">{text(row.campaignId?.title || row.campaign?.title || row.campaignTitle)}</td>
            <td className="px-3 py-3"><StatusBadge value={row.status} /></td>
            <td className="px-3 py-3">{formatCurrency(row.expectedEarnings || 0)}</td>
            <td className="px-3 py-3">{dateValue(row.createdAt || row.submittedAt)}</td>
            <td className="px-3 py-3">{dateValue(row.reviewedAt)}</td>
            <td className="px-3 py-3">
              <div className="flex flex-wrap gap-2">
                <ActionButton icon={CheckCircle2} tone="green" disabled={busyId === `approve-${id}`} onClick={() => runAction(`approve-${id}`, () => reviewAdminCampaignApplication(campaignId, influencerId, { status: "approved" }), "Application approved.")}>Approve</ActionButton>
                <ActionButton icon={XCircle} tone="red" disabled={busyId === `reject-${id}`} onClick={() => runAction(`reject-${id}`, () => reviewAdminCampaignApplication(campaignId, influencerId, { status: "rejected" }), "Application rejected.")}>Reject</ActionButton>
              </div>
            </td>
          </tr>
        );
      }} />
      <Pagination pagination={pagination} setFilters={setFilters} />
    </Section>
  );
}

function MatchingView({ data }) {
  const rows = data.recommendedInfluencersForVendor || data.recommendedVendorsForInfluencer || data.recommendedCampaignsForInfluencer || [];
  return (
    <Section title="Recommendation-Powered Matching" icon={Search}>
      <ResponsiveTable headers={["Recommended Match", "Category Fit", "Engagement", "Conversion", "Revenue", "Fraud Risk", "Location", "Language", "Action"]} rows={rows} renderRow={(row, index) => (
        <tr key={idOf(row) || index}>
          <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{pickUserName(row.influencer || row)}</td>
          <td className="px-3 py-3">{percentValue(row.categoryFit || row.score)}</td>
          <td className="px-3 py-3">{percentValue(row.engagementRate)}</td>
          <td className="px-3 py-3">{percentValue(row.conversionRate)}</td>
          <td className="px-3 py-3">{formatCurrency(row.revenue || row.pastRevenue || 0)}</td>
          <td className="px-3 py-3"><StatusBadge value={row.fraudRisk || "low"} /></td>
          <td className="px-3 py-3">{text(row.location || row.country)}</td>
          <td className="px-3 py-3">{text(row.language || row.languages?.join(", "))}</td>
          <td className="px-3 py-3"><ActionButton tone="slate">Recommend</ActionButton></td>
        </tr>
      )} />
    </Section>
  );
}

function AffiliateProductsView({ items, pagination, setFilters, title }) {
  return (
    <Section title={title} icon={Package}>
      <ResponsiveTable headers={["Product", "Vendor", "Influencers", "Clicks", "Orders", "Revenue", "Commission", "Conversion", "Status"]} rows={items} renderRow={(row) => (
        <tr key={idOf(row.product || row)}>
          <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{text(row.product?.name || row.name)}</td>
          <td className="px-3 py-3 text-slate-500">{pickVendorName(row.vendor || row.vendorId)}</td>
          <td className="px-3 py-3">{numberValue(row.influencersPromoting || row.promoters)}</td>
          <td className="px-3 py-3">{numberValue(row.clicks)}</td>
          <td className="px-3 py-3">{numberValue(row.orders)}</td>
          <td className="px-3 py-3">{formatCurrency(row.revenue || 0)}</td>
          <td className="px-3 py-3">{formatCurrency(row.commission || 0)}</td>
          <td className="px-3 py-3">{percentValue(row.conversionRate)}</td>
          <td className="px-3 py-3"><StatusBadge value={row.status || row.product?.status} /></td>
        </tr>
      )} />
      <Pagination pagination={pagination} setFilters={setFilters} />
    </Section>
  );
}

function TrackingView({ items, pagination, setFilters }) {
  return (
    <Section title="Affiliate Tracking Monitor" icon={LinkIcon}>
      <ResponsiveTable headers={["Session", "Influencer", "Vendor", "Product", "Campaign", "Click", "Order", "Conversion", "Token Expiry", "Fraud Risk"]} rows={items} renderRow={(row) => (
        <tr key={idOf(row)}>
          <td className="px-3 py-3 font-mono text-xs">{text(idOf(row))}</td>
          <td className="px-3 py-3">{pickUserName(row.influencerId || row.influencer)}</td>
          <td className="px-3 py-3">{pickVendorName(row.vendorId || row.vendor)}</td>
          <td className="px-3 py-3">{text(row.productId?.name || row.product?.name)}</td>
          <td className="px-3 py-3">{text(row.campaignId?.title || row.campaign?.title)}</td>
          <td className="px-3 py-3">{dateValue(row.createdAt || row.clickTimestamp)}</td>
          <td className="px-3 py-3">{text(row.orderId?.orderNumber || row.orderNumber)}</td>
          <td className="px-3 py-3"><StatusBadge value={row.conversionStatus || row.status} /></td>
          <td className="px-3 py-3">{dateValue(row.expiresAt || row.tokenExpiry)}</td>
          <td className="px-3 py-3"><StatusBadge value={row.fraudRisk || "low"} /></td>
        </tr>
      )} />
      <Pagination pagination={pagination} setFilters={setFilters} />
    </Section>
  );
}

function ContentView({ items, pagination, setFilters, runAction, busyId }) {
  return (
    <Section title="Content Moderation Queue" icon={FileCheck2}>
      <ResponsiveTable headers={["Creator", "Vendor", "Campaign", "Type", "Product", "Submitted", "Status", "Notes", "Actions"]} rows={items} renderRow={(row) => {
        const id = idOf(row);
        return (
          <tr key={id}>
            <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{pickUserName(row.influencerId || row.creator)}</td>
            <td className="px-3 py-3">{pickVendorName(row.vendorId || row.vendor)}</td>
            <td className="px-3 py-3">{text(row.campaignId?.title || row.campaign?.title)}</td>
            <td className="px-3 py-3">{text(row.type || row.contentType || "video")}</td>
            <td className="px-3 py-3">{text(row.productId?.name || row.product?.name)}</td>
            <td className="px-3 py-3">{dateValue(row.createdAt || row.submittedAt)}</td>
            <td className="px-3 py-3"><StatusBadge value={row.state || row.status} /></td>
            <td className="px-3 py-3">{text(row.moderation?.notes || row.moderationNotes)}</td>
            <td className="px-3 py-3">
              <div className="flex flex-wrap gap-2">
                <ActionButton tone="green" disabled={busyId === `approve-${id}`} onClick={() => runAction(`approve-${id}`, () => moderateAdminInfluencerContent(id, { decision: "approve" }), "Content approved.")}>Approve</ActionButton>
                <ActionButton tone="amber" disabled={busyId === `changes-${id}`} onClick={() => runAction(`changes-${id}`, () => moderateAdminInfluencerContent(id, { decision: "changes", requestedChanges: "Admin requested changes" }), "Changes requested.")}>Changes</ActionButton>
                <ActionButton tone="red" disabled={busyId === `reject-${id}`} onClick={() => runAction(`reject-${id}`, () => moderateAdminInfluencerContent(id, { decision: "reject" }), "Content rejected.")}>Reject</ActionButton>
              </div>
            </td>
          </tr>
        );
      }} />
      <Pagination pagination={pagination} setFilters={setFilters} />
    </Section>
  );
}

function CommissionEngineView({ data, runAction }) {
  const dashboard = data.dashboard || {};
  const rules = data.rules || [];
  const auditLogs = data.auditLogs || [];
  const [ruleForm, setRuleForm] = useState(defaultRuleForm);
  const [bonusForm, setBonusForm] = useState(defaultBonusForm);
  const [bonuses, setBonuses] = useState([]);
  const [editingRuleId, setEditingRuleId] = useState("");
  const [simulatorForm, setSimulatorForm] = useState(defaultSimulatorForm);
  const [simulation, setSimulation] = useState(null);
  const [settlementForm, setSettlementForm] = useState(defaultSettlementForm);
  const visibleTargetFields = ruleTargetFields[ruleForm.ruleType] || [];
  const visibleMethodFields = new Set(methodValueFields[ruleForm.commissionMethod] || ["commissionValue"]);
  const showTrafficSource = ruleForm.ruleType === "traffic_source";
  const showBonusBuilder = ruleForm.ruleType === "performance" || ruleForm.commissionMethod === "performance_bonus";
  const showCustomFormula = ruleForm.ruleType === "custom_formula" || visibleMethodFields.has("customFormula");

  function setRuleField(key, value) {
    setRuleForm((current) => ({ ...current, [key]: value }));
  }

  function setSimulatorField(key, value) {
    setSimulatorForm((current) => ({ ...current, [key]: value }));
  }

  function setSettlementField(key, value) {
    setSettlementForm((current) => ({ ...current, [key]: value }));
  }

  function resetRuleForm() {
    setRuleForm(defaultRuleForm);
    setBonuses([]);
    setEditingRuleId("");
  }

  function startEditRule(rule) {
    setEditingRuleId(idOf(rule));
    setRuleForm({
      ...defaultRuleForm,
      ruleName: rule.ruleName || "",
      ruleCode: rule.ruleCode || "",
      ruleType: rule.ruleType || "global",
      priority: Number(rule.priority || 0),
      commissionMethod: rule.commissionMethod || "percentage",
      commissionValue: Number(rule.commissionValue || 0),
      fixedAmount: Number(rule.fixedAmount || 0),
      revenueSharePercent: Number(rule.revenueSharePercent || 0),
      effectiveDate: rule.effectiveDate ? String(rule.effectiveDate).slice(0, 10) : defaultRuleForm.effectiveDate,
      expiryDate: rule.expiryDate ? String(rule.expiryDate).slice(0, 10) : "",
      status: rule.status || "pending_approval",
      description: rule.description || "",
      categoryId: rule.categoryId || "",
      productId: rule.productId || "",
      campaignId: rule.campaignId || "",
      influencerId: rule.influencerId || "",
      affiliateId: rule.affiliateId || "",
      trafficSource: rule.trafficSource || "affiliate_link",
      customFormula: rule.customFormula || "",
    });
    setBonuses(Array.isArray(rule.bonuses) ? rule.bonuses : []);
  }

  function buildRulePayload() {
    const payload = {
      ruleName: ruleForm.ruleName,
      ruleCode: ruleForm.ruleCode,
      ruleType: ruleForm.ruleType,
      priority: Number(ruleForm.priority || 0),
      commissionMethod: ruleForm.commissionMethod,
      effectiveDate: ruleForm.effectiveDate,
      expiryDate: ruleForm.expiryDate || null,
      status: ruleForm.status,
      description: ruleForm.description,
    };
    if (visibleMethodFields.has("commissionValue")) payload.commissionValue = Number(ruleForm.commissionValue || 0);
    if (visibleMethodFields.has("fixedAmount")) payload.fixedAmount = Number(ruleForm.fixedAmount || 0);
    if (visibleMethodFields.has("revenueSharePercent")) payload.revenueSharePercent = Number(ruleForm.revenueSharePercent || 0);
    if (showCustomFormula) payload.customFormula = ruleForm.customFormula;
    if (showBonusBuilder) payload.bonuses = bonuses;
    visibleTargetFields.forEach(([key]) => {
      if (ruleForm[key]) payload[key] = ruleForm[key];
    });
    if (showTrafficSource) payload.trafficSource = ruleForm.trafficSource;
    return payload;
  }

  function saveRule(event) {
    event.preventDefault();
    const payload = buildRulePayload();
    runAction(
      editingRuleId || "new-rule",
      () => (editingRuleId ? updateCommissionEngineRule(editingRuleId, payload) : createCommissionEngineRule(payload)),
      editingRuleId ? "Commission rule updated." : "Commission rule created."
    );
    resetRuleForm();
  }

  function addBonus() {
    setBonuses((current) => [
      ...current,
      {
        metric: bonusForm.metric,
        operator: bonusForm.operator,
        threshold: Number(bonusForm.threshold || 0),
        type: bonusForm.type,
        value: Number(bonusForm.value || 0),
      },
    ]);
  }

  async function runSimulation(event) {
    event.preventDefault();
    const response = await simulateCommissionEngine({
      ...simulatorForm,
      revenue: Number(simulatorForm.revenue || 0),
      expectedOrders: Number(simulatorForm.expectedOrders || 0),
      conversionRate: Number(simulatorForm.conversionRate || 0),
      campaignCompletion: Number(simulatorForm.campaignCompletion || 0),
      reelEngagement: Number(simulatorForm.reelEngagement || 0),
      reelEngagementTarget: Number(simulatorForm.reelEngagementTarget || 0),
    });
    setSimulation(unwrap(response));
  }

  function createSettlement(event) {
    event.preventDefault();
    runAction(
      "create-settlement",
      () => createCommissionEngineSettlement({
        cycle: settlementForm.cycle,
        periodStart: settlementForm.periodStart,
        periodEnd: settlementForm.periodEnd,
      }),
      "Settlement batch created."
    );
  }

  const metrics = [
    ["Total Commission", dashboard.totalCommission],
    ["Pending", dashboard.pendingCommission],
    ["Approved", dashboard.approvedCommission],
    ["Settled", dashboard.settledCommission],
    ["Paid", dashboard.paidCommission],
    ["Reversed", dashboard.reversedCommission],
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {metrics.map(([label, value]) => (
          <Metric key={label} label={label} value={formatCurrency(value || 0)} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Section title="Rules Engine" icon={Percent}>
          <form onSubmit={saveRule} className="grid gap-3 md:grid-cols-3">
            <FieldShell label="Rule Name">
              <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Rule name" value={ruleForm.ruleName} onChange={(event) => setRuleField("ruleName", event.target.value)} required />
            </FieldShell>
            <FieldShell label="Rule Code">
              <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm uppercase tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="RULE_CODE" value={ruleForm.ruleCode} onChange={(event) => setRuleField("ruleCode", event.target.value)} />
            </FieldShell>
            <FieldShell label="Priority">
              <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" type="number" min="0" placeholder="Priority" value={ruleForm.priority} onChange={(event) => setRuleField("priority", event.target.value)} />
            </FieldShell>
            <FieldShell label="Rule Type">
              <select className="h-11 rounded-xl border border-slate-200 px-3 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={ruleForm.ruleType} onChange={(event) => setRuleField("ruleType", event.target.value)}>
                {["global", "category", "product", "campaign", "influencer", "traffic_source", "performance", "affiliate", "custom_formula"].map((type) => <option key={type} value={type}>{statusText(type)}</option>)}
              </select>
            </FieldShell>
            <FieldShell label="Commission Method">
              <select className="h-11 rounded-xl border border-slate-200 px-3 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={ruleForm.commissionMethod} onChange={(event) => setRuleField("commissionMethod", event.target.value)}>
                {["percentage", "fixed", "hybrid", "tiered", "performance_bonus", "revenue_share", "custom_formula"].map((method) => <option key={method} value={method}>{statusText(method)}</option>)}
              </select>
            </FieldShell>
            <FieldShell label="Status">
              <select className="h-11 rounded-xl border border-slate-200 px-3 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={ruleForm.status} onChange={(event) => setRuleField("status", event.target.value)}>
                {["draft", "pending_approval", "active", "inactive"].map((status) => <option key={status} value={status}>{statusText(status)}</option>)}
              </select>
            </FieldShell>
            {visibleMethodFields.has("commissionValue") ? (
              <FieldShell label={ruleForm.commissionMethod === "performance_bonus" ? "Base Commission Percent" : "Commission Percent"}>
                <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" type="number" min="0" max="100" step="0.01" placeholder="Commission %" value={ruleForm.commissionValue} onChange={(event) => setRuleField("commissionValue", event.target.value)} />
              </FieldShell>
            ) : null}
            {visibleMethodFields.has("fixedAmount") ? (
              <FieldShell label="Fixed Amount">
                <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" type="number" min="0" step="0.01" placeholder="Fixed amount" value={ruleForm.fixedAmount} onChange={(event) => setRuleField("fixedAmount", event.target.value)} />
              </FieldShell>
            ) : null}
            {visibleMethodFields.has("revenueSharePercent") ? (
              <FieldShell label="Revenue Share Percent">
                <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" type="number" min="0" max="100" step="0.01" placeholder="Revenue share %" value={ruleForm.revenueSharePercent} onChange={(event) => setRuleField("revenueSharePercent", event.target.value)} />
              </FieldShell>
            ) : null}
            <FieldShell label="Effective Date">
              <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" type="date" value={ruleForm.effectiveDate} onChange={(event) => setRuleField("effectiveDate", event.target.value)} required />
            </FieldShell>
            <FieldShell label="Expiry Date">
              <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" type="date" value={ruleForm.expiryDate} onChange={(event) => setRuleField("expiryDate", event.target.value)} />
            </FieldShell>
            {showTrafficSource ? (
              <FieldShell label="Traffic Source">
                <select className="h-11 rounded-xl border border-slate-200 px-3 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={ruleForm.trafficSource} onChange={(event) => setRuleField("trafficSource", event.target.value)}>
                  {["reels", "posts", "stories", "livestream", "storefront", "collection", "affiliate_link", "campaign_landing_page", "creator_feed"].map((source) => <option key={source} value={source}>{statusText(source)}</option>)}
                </select>
              </FieldShell>
            ) : null}
            {visibleTargetFields.map(([key, placeholder]) => (
              <FieldShell key={key} label={placeholder}>
                <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder={placeholder} value={ruleForm[key]} onChange={(event) => setRuleField(key, event.target.value)} />
              </FieldShell>
            ))}
            <FieldShell label="Description" className="md:col-span-2">
              <textarea className="min-h-20 rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Description" value={ruleForm.description} onChange={(event) => setRuleField("description", event.target.value)} />
            </FieldShell>
            {showCustomFormula ? (
              <FieldShell label="Custom Formula">
                <textarea className="min-h-20 rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="eligibleRevenue * 0.12" value={ruleForm.customFormula} onChange={(event) => setRuleField("customFormula", event.target.value)} />
              </FieldShell>
            ) : null}
            {showBonusBuilder ? (
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800 md:col-span-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Performance Bonus</p>
              <div className="grid gap-2 md:grid-cols-5">
                <FieldShell label="Metric">
                  <select className="h-10 rounded-lg border border-slate-200 px-2 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={bonusForm.metric} onChange={(event) => setBonusForm((current) => ({ ...current, metric: event.target.value }))}>
                    {["orders", "conversionRate", "campaignCompletion", "reelEngagement"].map((metric) => <option key={metric} value={metric}>{metric}</option>)}
                  </select>
                </FieldShell>
                <FieldShell label="Operator">
                  <select className="h-10 rounded-lg border border-slate-200 px-2 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={bonusForm.operator} onChange={(event) => setBonusForm((current) => ({ ...current, operator: event.target.value }))}>
                    {["gt", "gte", "lt", "lte", "eq"].map((operator) => <option key={operator} value={operator}>{operator}</option>)}
                  </select>
                </FieldShell>
                <FieldShell label="Threshold">
                  <input className="h-10 rounded-lg border border-slate-200 px-2 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" type="number" value={bonusForm.threshold} onChange={(event) => setBonusForm((current) => ({ ...current, threshold: event.target.value }))} />
                </FieldShell>
                <FieldShell label="Bonus Value">
                  <input className="h-10 rounded-lg border border-slate-200 px-2 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" type="number" value={bonusForm.value} onChange={(event) => setBonusForm((current) => ({ ...current, value: event.target.value }))} />
                </FieldShell>
                <ActionButton tone="slate" onClick={addBonus}>Add Bonus</ActionButton>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {bonuses.map((bonus, index) => (
                  <button key={`${bonus.metric}-${index}`} type="button" onClick={() => setBonuses((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {bonus.metric} {bonus.operator} {bonus.threshold} +{bonus.value}{bonus.type === "fixed" ? "" : "%"}
                  </button>
                ))}
              </div>
            </div>
            ) : null}
            <div className="flex flex-wrap gap-2 md:col-span-3">
              <ActionButton type="submit" icon={CheckCircle2}>{editingRuleId ? "Update Rule" : "Create Rule"}</ActionButton>
              <ActionButton tone="slate" onClick={resetRuleForm}>Clear</ActionButton>
            </div>
          </form>
        </Section>

        <Section title="Simulator" icon={Calculator}>
          <form onSubmit={runSimulation} className="grid gap-3">
            {[
              ["influencerId", "Influencer ID"],
              ["campaignId", "Campaign ID"],
              ["productId", "Product ID"],
              ["categoryId", "Category ID"],
              ["vendorId", "Vendor ID"],
            ].map(([key, placeholder]) => (
              <input key={key} className="h-11 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder={placeholder} value={simulatorForm[key]} onChange={(event) => setSimulatorField(key, event.target.value)} />
            ))}
            <select className="h-11 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={simulatorForm.trafficSource} onChange={(event) => setSimulatorField("trafficSource", event.target.value)}>
              {["reels", "posts", "stories", "livestream", "storefront", "collection", "affiliate_link", "campaign_landing_page", "creator_feed"].map((source) => <option key={source} value={source}>{statusText(source)}</option>)}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["revenue", "Revenue"],
                ["expectedOrders", "Orders"],
                ["conversionRate", "Conversion %"],
                ["campaignCompletion", "Completion %"],
              ].map(([key, label]) => (
                <input key={key} className="h-11 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" type="number" min="0" step="0.01" aria-label={label} value={simulatorForm[key]} onChange={(event) => setSimulatorField(key, event.target.value)} />
              ))}
            </div>
            <ActionButton type="submit" icon={Calculator}>Run Simulation</ActionButton>
          </form>
          {simulation ? (
            <div className="mt-4 space-y-2 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
              <div className="flex justify-between gap-3"><span>Applied Rule</span><strong>{simulation.appliedRule?.ruleName || simulation.reason || "-"}</strong></div>
              <div className="flex justify-between gap-3"><span>Commission</span><strong>{simulation.commissionPercent || 0}%</strong></div>
              <div className="flex justify-between gap-3"><span>Bonus</span><strong>{simulation.bonusPercent || 0}%</strong></div>
              <div className="flex justify-between gap-3"><span>Final Earnings</span><strong>{formatCurrency(simulation.finalEarnings || 0)}</strong></div>
            </div>
          ) : null}
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Section title="Configured Rules" icon={Percent}>
          <ResponsiveTable headers={["Rule", "Type", "Method", "Value", "Priority", "Version", "Status", "Actions"]} rows={rules} renderRow={(rule) => {
            const id = idOf(rule);
            return (
              <tr key={id}>
                <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{text(rule.ruleName)}<div className="font-mono text-xs text-slate-500">{text(rule.ruleCode)}</div></td>
                <td className="px-3 py-3">{statusText(rule.ruleType)}</td>
                <td className="px-3 py-3">{statusText(rule.commissionMethod)}</td>
                <td className="px-3 py-3">{rule.commissionMethod === "fixed" ? formatCurrency(rule.fixedAmount || rule.commissionValue || 0) : `${Number(rule.commissionValue || rule.revenueSharePercent || 0)}%`}</td>
                <td className="px-3 py-3">{numberValue(rule.priority)}</td>
                <td className="px-3 py-3">v{numberValue(rule.version || 1)}</td>
                <td className="px-3 py-3"><StatusBadge value={rule.status} /></td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    <ActionButton tone="slate" onClick={() => startEditRule(rule)}>Edit</ActionButton>
                    <ActionButton tone="green" onClick={() => runAction(`approve-${id}`, () => approveCommissionEngineRule(id), "Rule approved.")}>Approve</ActionButton>
                    <ActionButton tone="amber" onClick={() => runAction(`deactivate-${id}`, () => deactivateCommissionEngineRule(id, { reason: "Deactivated from admin panel" }), "Rule deactivated.")}>Deactivate</ActionButton>
                  </div>
                </td>
              </tr>
            );
          }} />
        </Section>

        <Section title="Settlement" icon={WalletCards}>
          <form onSubmit={createSettlement} className="space-y-3">
            <select className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={settlementForm.cycle} onChange={(event) => setSettlementField("cycle", event.target.value)}>
              {["daily", "weekly", "bi_weekly", "monthly"].map((cycle) => <option key={cycle} value={cycle}>{statusText(cycle)}</option>)}
            </select>
            <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" type="date" value={settlementForm.periodStart} onChange={(event) => setSettlementField("periodStart", event.target.value)} />
            <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" type="date" value={settlementForm.periodEnd} onChange={(event) => setSettlementField("periodEnd", event.target.value)} />
            <ActionButton type="submit" icon={CheckCircle2}>Create Settlement</ActionButton>
          </form>
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Settlement ID" value={settlementForm.settlementId} onChange={(event) => setSettlementField("settlementId", event.target.value)} />
            <div className="flex flex-wrap gap-2">
              <ActionButton tone="green" disabled={!settlementForm.settlementId} onClick={() => runAction("approve-settlement", () => approveCommissionEngineSettlement(settlementForm.settlementId), "Settlement approved.")}>Approve</ActionButton>
              <ActionButton tone="slate" disabled={!settlementForm.settlementId} onClick={() => runAction("prepare-payout", () => prepareCommissionEnginePayoutBatch(settlementForm.settlementId), "Payout batch prepared.")}>Prepare Payout</ActionButton>
            </div>
          </div>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Traffic Source Performance" icon={BarChart3}>
          <ResponsiveTable headers={["Source", "Revenue", "Commission", "Orders"]} rows={dashboard.trafficSourcePerformance || []} renderRow={(row, index) => (
            <tr key={row._id || index}>
              <td className="px-3 py-3">{statusText(row._id || "unknown")}</td>
              <td className="px-3 py-3">{formatCurrency(row.revenue || 0)}</td>
              <td className="px-3 py-3">{formatCurrency(row.total || 0)}</td>
              <td className="px-3 py-3">{numberValue(row.orders)}</td>
            </tr>
          )} />
        </Section>
        <Section title="Audit Trail" icon={ShieldCheck}>
          <ResponsiveTable headers={["Action", "Entity", "User", "Reason", "Time"]} rows={auditLogs} renderRow={(row) => (
            <tr key={idOf(row)}>
              <td className="px-3 py-3">{statusText(row.action)}</td>
              <td className="px-3 py-3">{text(row.entityType)}</td>
              <td className="px-3 py-3">{text(row.userRole || row.userId)}</td>
              <td className="px-3 py-3">{text(row.reason)}</td>
              <td className="px-3 py-3">{dateValue(row.createdAt)}</td>
            </tr>
          )} />
        </Section>
      </div>
    </div>
  );
}

function CommissionsView({ items, pagination, setFilters, runAction, busyId }) {
  return (
    <Section title="Commission Management" icon={WalletCards}>
      <ResponsiveTable headers={["Order", "Vendor", "Influencer", "Campaign", "State", "Gross", "Platform", "Influencer", "Vendor Net", "Actions"]} rows={items} renderRow={(row) => {
        const id = idOf(row);
        return (
          <tr key={id}>
            <td className="px-3 py-3">{text(row.orderId?.orderNumber || row.orderNumber)}</td>
            <td className="px-3 py-3">{pickVendorName(row.vendorId || row.vendor)}</td>
            <td className="px-3 py-3">{pickUserName(row.influencerId || row.influencer)}</td>
            <td className="px-3 py-3">{text(row.campaignId?.title || row.campaign?.title)}</td>
            <td className="px-3 py-3"><StatusBadge value={row.state || row.status} /></td>
            <td className="px-3 py-3">{formatCurrency(row.grossAmount || row.orderAmount || 0)}</td>
            <td className="px-3 py-3">{formatCurrency(row.platformShare || 0)}</td>
            <td className="px-3 py-3">{formatCurrency(row.influencerShare || row.amount || 0)}</td>
            <td className="px-3 py-3">{formatCurrency(row.vendorNet || 0)}</td>
            <td className="px-3 py-3">
              <div className="flex flex-wrap gap-2">
                <ActionButton tone="amber" disabled={busyId === `hold-${id}`} onClick={() => runAction(`hold-${id}`, () => updateAdminInfluencerCommission(id, { state: "HOLD" }), "Commission held.")}>Hold</ActionButton>
                <ActionButton tone="green" disabled={busyId === `settle-${id}`} onClick={() => runAction(`settle-${id}`, () => updateAdminInfluencerCommission(id, { state: "SETTLED" }), "Commission settled.")}>Settle</ActionButton>
                <ActionButton tone="red" disabled={busyId === `reverse-${id}`} onClick={() => runAction(`reverse-${id}`, () => updateAdminInfluencerCommission(id, { state: "REVERSED" }), "Commission reversed.")}>Reverse</ActionButton>
              </div>
            </td>
          </tr>
        );
      }} />
      <Pagination pagination={pagination} setFilters={setFilters} />
    </Section>
  );
}

function SettlementsView({ items, pagination, setFilters }) {
  return (
    <Section title="Escrow & Settlements" icon={WalletCards}>
      <ResponsiveTable headers={["Vendor", "Influencer", "Campaign", "Order", "Escrow", "Hold Until", "Status", "Released"]} rows={items} renderRow={(row) => (
        <tr key={idOf(row)}>
          <td className="px-3 py-3">{pickVendorName(row.vendorId || row.vendor)}</td>
          <td className="px-3 py-3">{pickUserName(row.influencerId || row.influencer)}</td>
          <td className="px-3 py-3">{text(row.campaignId?.title || row.campaign?.title)}</td>
          <td className="px-3 py-3">{text(row.orderId?.orderNumber || row.orderNumber)}</td>
          <td className="px-3 py-3">{formatCurrency(row.escrowAmount || 0)}</td>
          <td className="px-3 py-3">{dateValue(row.holdUntil)}</td>
          <td className="px-3 py-3"><StatusBadge value={row.settlementStatus || row.state} /></td>
          <td className="px-3 py-3">{dateValue(row.releasedDate)}</td>
        </tr>
      )} />
      <Pagination pagination={pagination} setFilters={setFilters} />
    </Section>
  );
}

function PayoutsView({ items, pagination, setFilters }) {
  return (
    <Section title="Payout Management" icon={WalletCards}>
      <ResponsiveTable headers={["Influencer", "Available", "Pending", "Approved", "Withdrawn", "Method", "Verification"]} rows={items} renderRow={(row) => (
        <tr key={idOf(row)}>
          <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{pickUserName(row.influencerId || row.influencer)}</td>
          <td className="px-3 py-3">{formatCurrency(row.availableBalance || 0)}</td>
          <td className="px-3 py-3">{formatCurrency(row.pendingBalance || 0)}</td>
          <td className="px-3 py-3">{formatCurrency(row.approvedEarnings || 0)}</td>
          <td className="px-3 py-3">{formatCurrency(row.withdrawnBalance || 0)}</td>
          <td className="px-3 py-3">{text(row.payoutMethod || row.method)}</td>
          <td className="px-3 py-3"><StatusBadge value={row.accountVerificationStatus || row.verificationStatus} /></td>
        </tr>
      )} />
      <Pagination pagination={pagination} setFilters={setFilters} />
    </Section>
  );
}

function WithdrawalsView({ items, pagination, setFilters, runAction, busyId }) {
  return (
    <Section title="Withdrawal Requests" icon={WalletCards}>
      <ResponsiveTable headers={["Influencer", "Amount", "Method", "Requested", "Status", "Risk", "Payout Account", "Actions"]} rows={items} renderRow={(row) => {
        const id = idOf(row);
        return (
          <tr key={id}>
            <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{pickUserName(row.influencerId || row.influencer)}</td>
            <td className="px-3 py-3">{formatCurrency(row.amount || 0)}</td>
            <td className="px-3 py-3">{text(row.method || row.payoutMethod)}</td>
            <td className="px-3 py-3">{dateValue(row.createdAt || row.requestedAt)}</td>
            <td className="px-3 py-3"><StatusBadge value={row.status} /></td>
            <td className="px-3 py-3"><StatusBadge value={row.riskLevel || row.riskFlags?.[0] || "low"} /></td>
            <td className="px-3 py-3">{text(row.payoutAccountId?.label || row.payoutAccount)}</td>
            <td className="px-3 py-3">
              <div className="flex flex-wrap gap-2">
                <ActionButton tone="green" disabled={busyId === `approve-${id}`} onClick={() => runAction(`approve-${id}`, () => updateAdminInfluencerWithdrawal(id, { status: "APPROVED" }), "Withdrawal approved.")}>Approve</ActionButton>
                <ActionButton tone="amber" disabled={busyId === `process-${id}`} onClick={() => runAction(`process-${id}`, () => updateAdminInfluencerWithdrawal(id, { status: "PROCESSING" }), "Withdrawal processing.")}>Process</ActionButton>
                <ActionButton tone="red" disabled={busyId === `reject-${id}`} onClick={() => runAction(`reject-${id}`, () => updateAdminInfluencerWithdrawal(id, { status: "REJECTED" }), "Withdrawal rejected.")}>Reject</ActionButton>
              </div>
            </td>
          </tr>
        );
      }} />
      <Pagination pagination={pagination} setFilters={setFilters} />
    </Section>
  );
}

function PerformanceView({ title, items, kind }) {
  return (
    <Section title={title} icon={BarChart3}>
      <ResponsiveTable headers={[kind === "vendor" ? "Vendor" : "Creator", "Revenue", "Orders", "Clicks", "Conversions", "CTR", "ROI", "Commission", "Score"]} rows={items || []} renderRow={(row, index) => (
        <tr key={idOf(row) || index}>
          <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{kind === "vendor" ? pickVendorName(row.vendor || row) : pickUserName(row.influencer || row)}</td>
          <td className="px-3 py-3">{formatCurrency(row.revenue || row.campaignRevenue || 0)}</td>
          <td className="px-3 py-3">{numberValue(row.orders)}</td>
          <td className="px-3 py-3">{numberValue(row.clicks)}</td>
          <td className="px-3 py-3">{numberValue(row.conversions)}</td>
          <td className="px-3 py-3">{percentValue(row.ctr)}</td>
          <td className="px-3 py-3">{percentValue(row.roi)}</td>
          <td className="px-3 py-3">{formatCurrency(row.commission || row.commissionPaid || 0)}</td>
          <td className="px-3 py-3">{numberValue(row.score || row.rank || index + 1)}</td>
        </tr>
      )} />
    </Section>
  );
}

function AnalyticsView({ title, data }) {
  const metrics = data.metrics || {};
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Revenue" value={formatCurrency(metrics.campaignRevenue || metrics.revenue || 0)} />
        <Metric label="Spend" value={formatCurrency(metrics.campaignSpend || 0)} />
        <Metric label="ROI" value={percentValue(metrics.roi)} />
        <Metric label="Conversions" value={numberValue(metrics.conversions)} />
      </div>
      <Section title={title} icon={BarChart3}><SimpleBars rows={data.revenueTrend || data.trend || []} valueKey="revenue" /></Section>
      <PerformanceView title="Creator/Product Performance" items={data.creatorPerformance || data.productPerformance || []} />
    </div>
  );
}

function RevenueAnalyticsView({ data }) {
  const metrics = data.metrics || {};
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Gross Revenue" value={formatCurrency(metrics.grossRevenue || 0)} />
        <Metric label="Influencer Revenue" value={formatCurrency(metrics.influencerRevenue || 0)} />
        <Metric label="Vendor Net Revenue" value={formatCurrency(metrics.vendorNetRevenue || 0)} />
        <Metric label="Platform Commission" value={formatCurrency(metrics.platformCommission || 0)} />
        <Metric label="Escrow Balance" value={formatCurrency(metrics.escrowBalance || 0)} />
        <Metric label="Paid Commission" value={formatCurrency(metrics.paidCommission || 0)} />
        <Metric label="Pending Commission" value={formatCurrency(metrics.pendingCommission || 0)} />
        <Metric label="Reversed Commission" value={formatCurrency(metrics.reversedCommission || 0)} />
      </div>
      <Section title="Revenue Trend" icon={BarChart3}><SimpleBars rows={data.revenueTrend || []} valueKey="revenue" /></Section>
    </div>
  );
}

function FraudView({ items, pagination, setFilters, runAction, busyId }) {
  return (
    <Section title="Fraud & Compliance Alerts" icon={AlertTriangle}>
      <ResponsiveTable headers={["Alert", "Severity", "Influencer", "Vendor", "Campaign", "Order", "Evidence", "Status", "Actions"]} rows={items} renderRow={(row) => {
        const id = idOf(row);
        return (
          <tr key={id}>
            <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{text(row.alertType || row.type)}</td>
            <td className="px-3 py-3"><StatusBadge value={row.severity} /></td>
            <td className="px-3 py-3">{pickUserName(row.influencerId || row.influencer)}</td>
            <td className="px-3 py-3">{pickVendorName(row.vendorId || row.vendor)}</td>
            <td className="px-3 py-3">{text(row.campaignId?.title || row.campaign?.title)}</td>
            <td className="px-3 py-3">{text(row.orderId?.orderNumber || row.orderNumber)}</td>
            <td className="px-3 py-3">{text(row.evidence?.summary || row.evidence)}</td>
            <td className="px-3 py-3"><StatusBadge value={row.status} /></td>
            <td className="px-3 py-3">
              <div className="flex flex-wrap gap-2">
                <ActionButton tone="green" disabled={busyId === `safe-${id}`} onClick={() => runAction(`safe-${id}`, () => updateAdminFraudAlert(id, { status: "safe" }), "Alert marked safe.")}>Safe</ActionButton>
                <ActionButton tone="amber" disabled={busyId === `escalate-${id}`} onClick={() => runAction(`escalate-${id}`, () => updateAdminFraudAlert(id, { status: "escalated" }), "Alert escalated.")}>Escalate</ActionButton>
              </div>
            </td>
          </tr>
        );
      }} />
      <Pagination pagination={pagination} setFilters={setFilters} />
    </Section>
  );
}

function CommunicationView({ data }) {
  const rows = data.conversations || data.items || [];
  return (
    <Section title="Communication Center" icon={MessageSquare}>
      <ResponsiveTable headers={["Conversation", "Vendor", "Influencer", "Campaign", "Last Message", "Status"]} rows={rows} renderRow={(row, index) => (
        <tr key={idOf(row) || index}>
          <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{text(row.subject || row.title || idOf(row))}</td>
          <td className="px-3 py-3">{pickVendorName(row.vendor || row.vendorId)}</td>
          <td className="px-3 py-3">{pickUserName(row.influencer || row.influencerId)}</td>
          <td className="px-3 py-3">{text(row.campaign?.title || row.campaignId?.title)}</td>
          <td className="px-3 py-3">{dateValue(row.lastMessageAt || row.updatedAt)}</td>
          <td className="px-3 py-3"><StatusBadge value={row.status} /></td>
        </tr>
      )} />
    </Section>
  );
}

function ReportsView({ data, runAction, busyId }) {
  const reports = data.reports || [
    "Campaign Reports",
    "Influencer Reports",
    "Vendor Reports",
    "Revenue Reports",
    "Commission Reports",
    "Settlement Reports",
    "Withdrawal Reports",
    "Content Reports",
    "Conversion Reports",
    "Fraud Reports",
  ];
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <Section title="Reporting Center" icon={Download}>
        <div className="grid gap-3 md:grid-cols-2">
          {reports.map((report) => (
            <div key={report.name || report} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="font-semibold text-slate-950 dark:text-white">{report.name || report}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">CSV, Excel, and PDF export via the platform reporting service.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionButton tone="slate" icon={Download}>CSV</ActionButton>
                <ActionButton tone="slate" icon={Download}>Excel</ActionButton>
                <ActionButton tone="slate" icon={Download}>PDF</ActionButton>
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Schedule Report" icon={SlidersHorizontal}>
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">Create a reusable influencer commerce report schedule.</p>
          <ActionButton icon={CheckCircle2} disabled={busyId === "schedule-report"} onClick={() => runAction("schedule-report", () => saveAdminInfluencerReportSchedule({ reportType: "campaign", frequency: "weekly", format: "csv" }), "Weekly report schedule saved.")}>Weekly CSV</ActionButton>
        </div>
      </Section>
    </div>
  );
}

function SettingsView({ data, runAction, busyId }) {
  const settings = data.settings || data || {};
  const enabled = Boolean(settings.enabled ?? settings.influencerCommerceEnabled);
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <Section title="Influencer Commerce Settings" icon={Settings}>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["Default Commission Rate", percentValue(settings.defaultCommissionRate)],
            ["Maximum Commission Rate", percentValue(settings.maximumCommissionRate)],
            ["Minimum Withdrawal Amount", formatCurrency(settings.minimumWithdrawalAmount || 0)],
            ["Maximum Withdrawal Amount", formatCurrency(settings.maximumWithdrawalAmount || 0)],
            ["Commission Hold Days", numberValue(settings.commissionHoldDays)],
            ["Tracking Cookie Duration", `${numberValue(settings.trackingCookieDurationDays)} days`],
            ["Self-Attribution Blocking", settings.selfAttributionBlocking ? "Enabled" : "Disabled"],
            ["Auto-Settlement Rules", settings.autoSettlementEnabled ? "Enabled" : "Manual"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{value}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Platform Toggle" icon={ShieldCheck}>
        <div className="space-y-3">
          <StatusBadge value={enabled ? "enabled" : "disabled"} />
          <p className="text-sm text-slate-500 dark:text-slate-400">This updates the existing platform configuration used by admin, vendor, and influencer dashboards.</p>
          <ActionButton disabled={busyId === "toggle-settings"} onClick={() => runAction("toggle-settings", () => updateAdminInfluencerSettings({ enabled: !enabled }), "Influencer commerce settings updated.")}>
            {enabled ? "Disable" : "Enable"} Commerce
          </ActionButton>
        </div>
      </Section>
    </div>
  );
}
