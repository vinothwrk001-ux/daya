import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  Calculator,
  CheckCircle2,
  Download,
  Eye,
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
  listAdminAffiliateLinks,
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
  listCommissionEngineSettlements,
  listAdminProductPromotions,
  approveCommissionEngineRule,
  approveCommissionEngineSettlement,
  createCommissionEngineRule,
  createCommissionEngineSettlement,
  moderateAdminInfluencerContent,
  deactivateCommissionEngineRule,
  prepareCommissionEnginePayoutBatch,
  recommendAdminInfluencerVendorMatch,
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
import { getCategories } from "../services/categoryService";
import { formatCurrency } from "../utils/formatCurrency";
import { resolveApiAssetUrl } from "../utils/resolveUrl";

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

const defaultConditionForm = {
  field: "eligibleRevenue",
  operator: "gte",
  value: 0,
  valueTo: "",
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
  if (typeof row === "string" || typeof row === "number") return String(row);
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

function shortText(value, max = 42) {
  const next = text(value);
  if (next === "-") return next;
  return next.length > max ? `${next.slice(0, max - 3)}...` : next;
}

function statusText(value = "") {
  return String(value || "pending").replace(/_/g, " ");
}

function pickUserName(value) {
  return value?.name || value?.displayName || value?.userId?.name || value?.profile?.name || value?.username || value?.userId?.email || "Creator";
}

function pickVendorName(value) {
  return value?.name || value?.shopName || value?.companyName || value?.vendor?.shopName || value?.vendorId?.shopName || "Vendor";
}

function Section({ title, icon: Icon, action, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {createElement(Icon, { className: "h-4 w-4 text-indigo-500", "aria-hidden": "true" })}
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

function campaignActionState(row = {}) {
  const state = String(row.state || row.status || "").toLowerCase();
  return {
    cancelled: state === "cancelled",
    completed: state === "completed",
    published: Boolean(row.marketplace?.public),
  };
}

function applicationActionState(row = {}) {
  const status = String(row.status || "").toLowerCase();
  return {
    approved: status === "approved",
    rejected: status === "rejected",
  };
}

function FieldShell({ label, children, className = "" }) {
  return (
    <label className={`grid min-w-0 gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${className}`}>
      <span className="block min-w-0 truncate">{label}</span>
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
      {Icon ? createElement(Icon, { className: "h-4 w-4", "aria-hidden": "true" }) : null}
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
      const dashboardQuery = {
        ...query,
        from: query.startDate,
        to: query.endDate,
      };
      const listQuery = {
        limit: 100,
        search: query.search,
        status: query.status,
      };
      const [dashboard, rules, auditLogs, settlements, campaigns, influencers, vendors, products, categories, affiliateLinks] = await Promise.all([
        getCommissionEngineDashboard(dashboardQuery),
        listCommissionEngineRules(listQuery),
        listCommissionEngineAuditLogs({ limit: 10, search: query.search }),
        listCommissionEngineSettlements({ limit: 25, status: query.status, startDate: query.startDate, endDate: query.endDate }),
        listAdminInfluencerCommerceCampaigns({ limit: 100 }).catch(() => ({ data: { items: [] } })),
        listAdminInfluencerCommerceInfluencers({ limit: 100 }).catch(() => ({ data: { items: [] } })),
        listAdminInfluencerCommerceVendors({ limit: 100 }).catch(() => ({ data: { items: [] } })),
        listAdminAffiliateProducts({ limit: 100 }).catch(() => ({ data: { items: [] } })),
        getCategories().catch(() => ({ data: [] })),
        listAdminAffiliateLinks({ limit: 100 }).catch(() => ({ data: { items: [] } })),
      ]);
      return {
        data: {
          dashboard: unwrap(dashboard),
          rules: unwrap(rules)?.rules || [],
          rulePagination: unwrap(rules)?.pagination,
          auditLogs: unwrap(auditLogs)?.logs || [],
          settlements: unwrap(settlements)?.items || [],
          settlementPagination: unwrap(settlements)?.pagination,
          campaigns: unwrap(campaigns)?.items || [],
          influencers: unwrap(influencers)?.items || [],
          vendors: unwrap(vendors)?.items || [],
          products: unwrap(products)?.items || [],
          categories: unwrap(categories)?.items || unwrap(categories)?.categories || unwrap(categories) || [],
          affiliateLinks: unwrap(affiliateLinks)?.items || [],
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
  if (moduleId === "matching") return <MatchingView data={data} runAction={runAction} busyId={busyId} />;
  if (moduleId === "affiliate-products") return <AffiliateProductsView items={items} pagination={pagination} setFilters={setFilters} title="Affiliate Products" />;
  if (moduleId === "promotions") return <ProductPromotionsView items={items} pagination={pagination} setFilters={setFilters} />;
  if (moduleId === "tracking") return <TrackingView items={items} pagination={pagination} setFilters={setFilters} />;
  if (moduleId === "content") return <ContentView items={items} pagination={pagination} setFilters={setFilters} runAction={runAction} busyId={busyId} />;
  if (moduleId === "commission-engine") return <CommissionEngineView data={data} runAction={runAction} busyId={busyId} />;
  if (moduleId === "commissions") return <CommissionsView items={items} pagination={pagination} setFilters={setFilters} runAction={runAction} busyId={busyId} />;
  if (moduleId === "settlements") return <SettlementsView items={items} pagination={pagination} setFilters={setFilters} />;
  if (moduleId === "payouts") return <PayoutsView items={items} pagination={pagination} setFilters={setFilters} />;
  if (moduleId === "withdrawals") return <WithdrawalsView items={items} pagination={pagination} setFilters={setFilters} runAction={runAction} busyId={busyId} />;
  if (moduleId === "creator-performance") return <PerformanceView title="Creator Performance" items={data.leaderboard || items} pagination={pagination} setFilters={setFilters} kind="creator" />;
  if (moduleId === "vendor-performance") return <PerformanceView title="Vendor Performance" items={data.leaderboard || items} pagination={pagination} setFilters={setFilters} kind="vendor" />;
  if (moduleId === "campaign-analytics") return <AnalyticsView title="Campaign Analytics" data={data} />;
  if (moduleId === "revenue-analytics") return <RevenueAnalyticsView data={data} />;
  if (moduleId === "fraud") return <FraudView items={items} pagination={pagination} setFilters={setFilters} runAction={runAction} busyId={busyId} />;
  if (moduleId === "communication") return <CommunicationView data={data} />;
  if (moduleId === "reports") return <ReportsView data={data} runAction={runAction} busyId={busyId} />;
  if (moduleId === "settings") return <SettingsView data={data} runAction={runAction} busyId={busyId} />;
  return null;
}

function DashboardView({ data }) {
  const metrics = data.metrics || data.kpis || {};
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
      <div className="grid gap-4 xl:grid-cols-4">
        <MiniList title="Recent Campaigns" rows={widgets.recentCampaigns} label={(row) => row.title} value={(row) => <StatusBadge value={row.status || row.state} />} />
        <MiniList title="Top Influencers" rows={widgets.topInfluencers} label={pickUserName} value={(row) => formatCurrency(row.revenue || row.totalRevenue || 0)} />
        <MiniList title="Top Vendors" rows={widgets.topVendors} label={pickVendorName} value={(row) => formatCurrency(row.revenue || row.campaignRevenue || 0)} />
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
        const actions = campaignActionState(row);
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
                <ActionButton
                  tone={actions.cancelled ? "slate" : "amber"}
                  disabled={busyId === `cancel-${id}`}
                  onClick={() => runAction(
                    `cancel-${id}`,
                    () => updateAdminInfluencerCommerceCampaign(id, { action: actions.cancelled ? "activate" : "pause" }),
                    actions.cancelled ? "Campaign reactivated." : "Campaign cancelled."
                  )}
                >
                  {actions.cancelled ? "Cancelled" : "Cancel"}
                </ActionButton>
                <ActionButton
                  tone="slate"
                  disabled={busyId === `publish-${id}`}
                  onClick={() => runAction(
                    `publish-${id}`,
                    () => updateAdminInfluencerCommerceCampaign(id, { action: actions.published ? "unfeature" : "feature" }),
                    actions.published ? "Campaign unpublished." : "Campaign published."
                  )}
                >
                  {actions.published ? "Published" : "Publish"}
                </ActionButton>
                <ActionButton
                  tone={actions.completed ? "slate" : "red"}
                  disabled={busyId === `complete-${id}`}
                  onClick={() => runAction(
                    `complete-${id}`,
                    () => updateAdminInfluencerCommerceCampaign(id, { action: actions.completed ? "activate" : "close" }),
                    actions.completed ? "Campaign reactivated." : "Campaign completed."
                  )}
                >
                  {actions.completed ? "Completed" : "Complete"}
                </ActionButton>
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
        const actions = applicationActionState(row);
        return (
          <tr key={id}>
            <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{text(row.influencerName || pickUserName(row.influencer || row.influencerId))}</td>
            <td className="px-3 py-3 text-slate-500">{text(row.vendorName || pickVendorName(row.vendor || row.vendorId))}</td>
            <td className="px-3 py-3">{text(row.campaignId?.title || row.campaign?.title || row.campaignTitle)}</td>
            <td className="px-3 py-3"><StatusBadge value={row.status} /></td>
            <td className="px-3 py-3">{formatCurrency(row.expectedEarnings || 0)}</td>
            <td className="px-3 py-3">{dateValue(row.createdAt || row.submittedAt)}</td>
            <td className="px-3 py-3">{dateValue(row.reviewedAt)}</td>
            <td className="px-3 py-3">
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  icon={CheckCircle2}
                  tone={actions.approved ? "slate" : "green"}
                  disabled={busyId === `approve-${id}`}
                  onClick={() => runAction(
                    `approve-${id}`,
                    () => reviewAdminCampaignApplication(campaignId, influencerId, { decision: actions.approved ? "reopen" : "approve" }),
                    actions.approved ? "Application reopened." : "Application approved."
                  )}
                >
                  {actions.approved ? "Approved" : "Approve"}
                </ActionButton>
                <ActionButton
                  icon={XCircle}
                  tone={actions.rejected ? "slate" : "red"}
                  disabled={busyId === `reject-${id}`}
                  onClick={() => runAction(
                    `reject-${id}`,
                    () => reviewAdminCampaignApplication(campaignId, influencerId, { decision: actions.rejected ? "reopen" : "reject" }),
                    actions.rejected ? "Application reopened." : "Application rejected."
                  )}
                >
                  {actions.rejected ? "Rejected" : "Reject"}
                </ActionButton>
              </div>
            </td>
          </tr>
        );
      }} />
      <Pagination pagination={pagination} setFilters={setFilters} />
    </Section>
  );
}

function MatchingView({ data, runAction, busyId }) {
  const rows = data.recommendedInfluencersForVendor || data.recommendedVendorsForInfluencer || data.recommendedCampaignsForInfluencer || [];
  return (
    <Section title="Recommendation-Powered Matching" icon={Search}>
      <ResponsiveTable headers={["Recommended Match", "Category Fit", "Engagement", "Conversion", "Revenue", "Fraud Risk", "Location", "Language", "Action"]} rows={rows} renderRow={(row, index) => {
        const vendorId = idOf(row.vendorId || row.vendor);
        const influencerId = idOf(row.influencerId || row.influencer || row);
        const id = idOf(row) || `${vendorId}-${influencerId}` || index;
        const recommended = Boolean(row.recommended);
        return (
          <tr key={id}>
            <td className="px-3 py-3">
              <div className="font-medium text-slate-900 dark:text-white">{text(row.influencerName || pickUserName(row.influencer || row))}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{text(row.vendorName || pickVendorName(row.vendor || row.vendorId))}</div>
            </td>
            <td className="px-3 py-3">{percentValue(row.categoryFit || row.score)}</td>
            <td className="px-3 py-3">{percentValue(row.engagementRate)}</td>
            <td className="px-3 py-3">{percentValue(row.conversionRate)}</td>
            <td className="px-3 py-3">{formatCurrency(row.revenue || row.pastRevenue || 0)}</td>
            <td className="px-3 py-3"><StatusBadge value={row.fraudRisk || "low"} /></td>
            <td className="px-3 py-3">{text(row.location || row.country)}</td>
            <td className="px-3 py-3">{text(row.language || row.languages?.join(", "))}</td>
            <td className="px-3 py-3">
              <ActionButton
                tone={recommended ? "slate" : "green"}
                disabled={!vendorId || !influencerId || busyId === `recommend-${id}`}
                onClick={() => runAction(
                  `recommend-${id}`,
                  () => recommendAdminInfluencerVendorMatch({ vendorId, influencerId, recommended: !recommended }),
                  recommended ? "Recommendation removed." : "Recommendation sent."
                )}
              >
                {recommended ? "Recommended" : "Recommend"}
              </ActionButton>
            </td>
          </tr>
        );
      }} />
    </Section>
  );
}

function AffiliateProductsView({ items, pagination, setFilters, title }) {
  return (
    <Section title={title} icon={Package}>
      <ResponsiveTable headers={["Product", "Vendor", "Influencers", "Clicks", "Orders", "Revenue", "Commission", "Conversion", "Status"]} rows={items} renderRow={(row) => (
        <tr key={idOf(row.product || row)}>
          <td className="px-3 py-3 font-medium text-slate-900 dark:text-white" title={text(row.product?.name || row.name)}>{shortText(row.product?.name || row.name, 48)}</td>
          <td className="px-3 py-3 text-slate-500">{text(row.vendorName || row.vendorLabel || (typeof row.vendor === "string" ? row.vendor : pickVendorName(row.vendor || row.vendorId)))}</td>
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

function ProductPromotionsView({ items, pagination, setFilters }) {
  return (
    <Section title="Product Promotions" icon={Package}>
      <ResponsiveTable headers={["Product", "Campaign", "Vendor", "Creators", "Clicks", "Orders", "Revenue", "Commission", "Conversion", "Status"]} rows={items} renderRow={(row) => (
        <tr key={row.id || `${idOf(row.campaignId || row.campaign)}-${idOf(row.productId || row.product)}`}>
          <td className="px-3 py-3">
            <div className="font-medium text-slate-900 dark:text-white" title={text(row.productName || row.product?.name || row.name)}>
              {shortText(row.productName || row.product?.name || row.name, 42)}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{text(row.category || row.product?.category)}</div>
          </td>
          <td className="px-3 py-3" title={text(row.campaignTitle || row.campaign?.title)}>{shortText(row.campaignTitle || row.campaign?.title, 28)}</td>
          <td className="px-3 py-3 text-slate-500">{text(row.vendorName || pickVendorName(row.vendor || row.vendorId))}</td>
          <td className="px-3 py-3">{numberValue(row.influencersPromoting || row.creators || row.promoters)}</td>
          <td className="px-3 py-3">{numberValue(row.clicks)}</td>
          <td className="px-3 py-3">{numberValue(row.orders)}</td>
          <td className="px-3 py-3">{formatCurrency(row.revenue || 0)}</td>
          <td className="px-3 py-3">{formatCurrency(row.commission || 0)}</td>
          <td className="px-3 py-3">{percentValue(row.conversionRate)}</td>
          <td className="px-3 py-3"><StatusBadge value={row.campaignState || row.status || row.product?.status} /></td>
        </tr>
      )} />
      <Pagination pagination={pagination} setFilters={setFilters} />
    </Section>
  );
}

function TrackingView({ items, pagination, setFilters }) {
  return (
    <Section title="Affiliate Tracking Monitor" icon={LinkIcon}>
      <ResponsiveTable headers={["Click ID", "Influencer", "Vendor", "Product", "Campaign", "Clicked On", "Order", "Conversion", "Link Expires", "Fraud Risk"]} rows={items} renderRow={(row) => (
        <tr key={idOf(row)}>
          <td className="px-3 py-3 font-mono text-xs" title={text(row.sessionId || row.trackingTokenId || idOf(row))}>{shortText(row.sessionId || row.trackingTokenId || idOf(row), 14)}</td>
          <td className="px-3 py-3">{text(row.influencerName || pickUserName(row.influencerId || row.influencer))}</td>
          <td className="px-3 py-3">{text(row.vendorName || pickVendorName(row.vendorId || row.vendor))}</td>
          <td className="px-3 py-3" title={text(row.productName || row.productId?.name || row.product?.name)}>{shortText(row.productName || row.productId?.name || row.product?.name, 34)}</td>
          <td className="px-3 py-3">{text(row.campaignTitle || row.campaignId?.title || row.campaign?.title)}</td>
          <td className="px-3 py-3">{dateValue(row.createdAt || row.clickTimestamp)}</td>
          <td className="px-3 py-3">{text(row.orderNumber || row.order?.orderNumber || row.orderId?.orderNumber)}</td>
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
  const [reviewItem, setReviewItem] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const selectedId = idOf(reviewItem);

  function openReview(row) {
    setReviewItem(row);
    setReviewNote(row.moderation?.notes || row.moderationNotes || "");
  }

  function submitReview(decision) {
    const note = reviewNote.trim();
    const payload = {
      decision,
      note,
      requestedChanges: decision === "changes" ? note : "",
    };
    const message = decision === "approve" ? "Content approved." : decision === "changes" ? "Changes requested." : "Content rejected.";
    runAction(`content-${decision}-${selectedId}`, () => moderateAdminInfluencerContent(selectedId, payload), message);
    setReviewItem(null);
    setReviewNote("");
  }

  return (
    <Section title="Content Moderation Queue" icon={FileCheck2}>
      <ResponsiveTable headers={["Creator", "Vendor", "Campaign", "Type", "Content", "Submitted", "Status", "Notes", "Actions"]} rows={items} renderRow={(row) => {
        const id = idOf(row);
        return (
          <tr key={id}>
            <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{text(row.creatorName || pickUserName(row.influencerId || row.creator))}</td>
            <td className="px-3 py-3">{text(row.vendorName || pickVendorName(row.vendorId || row.vendor))}</td>
            <td className="px-3 py-3">{text(row.campaignTitle || row.campaignId?.title || row.campaign?.title)}</td>
            <td className="px-3 py-3">{text(row.type || row.contentType || "video")}</td>
            <td className="px-3 py-3" title={text(row.reviewTitle || row.title || row.caption)}>{shortText(row.reviewTitle || row.title || row.caption, 36)}</td>
            <td className="px-3 py-3">{dateValue(row.createdAt || row.submittedAt)}</td>
            <td className="px-3 py-3"><StatusBadge value={row.state || row.status} /></td>
            <td className="px-3 py-3">{text(row.moderation?.notes || row.moderationNotes)}</td>
            <td className="px-3 py-3">
              <div className="flex flex-wrap gap-2">
                <ActionButton icon={Eye} tone="slate" onClick={() => openReview(row)}>View</ActionButton>
              </div>
            </td>
          </tr>
        );
      }} />
      <Pagination pagination={pagination} setFilters={setFilters} />
      {reviewItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-950 dark:text-white">{text(reviewItem.reviewTitle || reviewItem.title || "Content review")}</h3>
                <p className="mt-1 text-sm text-slate-500">{text(reviewItem.creatorName || pickUserName(reviewItem.influencerId))} / {text(reviewItem.vendorName || pickVendorName(reviewItem.vendorId))}</p>
              </div>
              <ActionButton tone="slate" onClick={() => setReviewItem(null)}>Close</ActionButton>
            </div>
            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 dark:border-slate-800">
                  {reviewItem.videoUrl ? (
                    <video className="max-h-[520px] w-full bg-black" controls poster={resolveApiAssetUrl(reviewItem.thumbnailUrl)} src={resolveApiAssetUrl(reviewItem.videoUrl)} />
                  ) : reviewItem.thumbnailUrl ? (
                    <img className="max-h-[520px] w-full object-contain" src={resolveApiAssetUrl(reviewItem.thumbnailUrl)} alt={text(reviewItem.reviewTitle || "Content preview")} />
                  ) : (
                    <div className="grid h-72 place-items-center text-sm text-slate-400">No preview available.</div>
                  )}
                </div>
                <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-200">{text(reviewItem.reviewText || reviewItem.caption || reviewItem.description, "No caption provided.")}</p>
              </div>
              <div className="space-y-4">
                <div className="grid gap-2 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <div className="flex justify-between gap-3"><span className="text-slate-500">Campaign</span><span className="text-right font-medium">{text(reviewItem.campaignTitle || reviewItem.campaignId?.title)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">Type</span><span className="font-medium">{text(reviewItem.contentType || reviewItem.type)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">Products</span><span className="text-right font-medium">{text((reviewItem.productNames || reviewItem.products?.map((product) => product.name) || []).join(", "))}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">Submitted</span><span className="font-medium">{dateValue(reviewItem.createdAt || reviewItem.submittedAt)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">Status</span><StatusBadge value={reviewItem.state || reviewItem.status} /></div>
                </div>
                <FieldShell label="Review note">
                  <textarea
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    rows={5}
                    placeholder="Write the exact change request or rejection reason."
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm normal-case outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </FieldShell>
                <div className="flex flex-wrap gap-2">
                  <ActionButton tone="green" disabled={busyId === `content-approve-${selectedId}`} onClick={() => submitReview("approve")}>Approve</ActionButton>
                  <ActionButton tone="amber" disabled={!reviewNote.trim() || busyId === `content-changes-${selectedId}`} onClick={() => submitReview("changes")}>Request Changes</ActionButton>
                  <ActionButton tone="red" disabled={!reviewNote.trim() || busyId === `content-reject-${selectedId}`} onClick={() => submitReview("reject")}>Reject</ActionButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Section>
  );
}

function CommissionEngineView({ data, runAction, busyId }) {
  const dashboard = data.dashboard || {};
  const rules = data.rules || [];
  const auditLogs = data.auditLogs || [];
  const settlements = data.settlements || [];
  const campaigns = data.campaigns || [];
  const influencers = data.influencers || [];
  const vendors = data.vendors || [];
  const products = data.products || [];
  const categories = data.categories || [];
  const affiliateLinks = data.affiliateLinks || [];
  const [ruleForm, setRuleForm] = useState(defaultRuleForm);
  const [bonusForm, setBonusForm] = useState(defaultBonusForm);
  const [bonuses, setBonuses] = useState([]);
  const [conditionForm, setConditionForm] = useState(defaultConditionForm);
  const [conditions, setConditions] = useState([]);
  const [editingRuleId, setEditingRuleId] = useState("");
  const [simulatorForm, setSimulatorForm] = useState(defaultSimulatorForm);
  const [simulation, setSimulation] = useState(null);
  const [simulationBusy, setSimulationBusy] = useState(false);
  const [simulationError, setSimulationError] = useState("");
  const [settlementForm, setSettlementForm] = useState(defaultSettlementForm);
  const visibleTargetFields = ruleTargetFields[ruleForm.ruleType] || [];
  const visibleMethodFields = new Set(methodValueFields[ruleForm.commissionMethod] || ["commissionValue"]);
  const showTrafficSource = ruleForm.ruleType === "traffic_source";
  const showBonusBuilder = ruleForm.ruleType === "performance" || ruleForm.commissionMethod === "performance_bonus";
  const showCustomFormula = ruleForm.ruleType === "custom_formula" || visibleMethodFields.has("customFormula");
  const trafficSources = ["reels", "posts", "stories", "livestream", "storefront", "collection", "affiliate_link", "campaign_landing_page", "creator_feed"];
  const campaignOptions = campaigns.map((row) => ({ value: idOf(row), label: row.title || row.campaignTitle || row.name || idOf(row) })).filter((option) => option.value);
  const influencerOptions = influencers.map((row) => ({ value: idOf(row), label: row.name || row.influencerName || pickUserName(row.userId || row.user || row) })).filter((option) => option.value);
  const vendorOptions = vendors.map((row) => ({ value: idOf(row), label: row.vendorName || pickVendorName(row.vendor || row) })).filter((option) => option.value);
  const productOptions = products.map((row) => {
    const product = row.product || row.productId || row;
    const label = product.name || row.productName || row.name || idOf(product) || idOf(row);
    return { value: idOf(product) || idOf(row), label: shortText(label, 36) };
  }).filter((option) => option.value);
  const namedCategoryOptions = [...new Set([
    ...products.map((row) => row.category || row.product?.category || row.productId?.category),
    ...campaigns.map((row) => row.category),
  ].filter(Boolean))].map((category) => ({ value: category, label: category }));
  const categoryOptions = categories
    .map((category) => ({
      value: idOf(category),
      label: category.name || category.title || category.label || category.key || idOf(category),
    }))
    .filter((option) => option.value);
  const affiliateOptions = affiliateLinks
    .map((row) => ({
      value: idOf(row),
      label: shortText(row.label || row.affiliateCode || idOf(row), 52),
    }))
    .filter((option) => option.value);
  const simulatorCategoryOptions = categoryOptions.length ? categoryOptions : namedCategoryOptions;
  const ruleTargetOptions = {
    categoryId: categoryOptions,
    productId: productOptions,
    campaignId: campaignOptions,
    influencerId: influencerOptions,
    affiliateId: affiliateOptions,
  };

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
    setConditions([]);
    setBonusForm(defaultBonusForm);
    setConditionForm(defaultConditionForm);
    setEditingRuleId("");
  }

  function startEditRule(rule) {
    const cleanConditions = (Array.isArray(rule.conditions) ? rule.conditions : []).map((condition) => ({
      field: condition.field || "eligibleRevenue",
      operator: condition.operator || "eq",
      value: condition.value ?? "",
      ...(condition.valueTo != null ? { valueTo: condition.valueTo } : {}),
    }));
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
      categoryId: idOf(rule.categoryId) || "",
      productId: idOf(rule.productId) || "",
      campaignId: idOf(rule.campaignId) || "",
      influencerId: idOf(rule.influencerId) || "",
      affiliateId: idOf(rule.affiliateId) || "",
      trafficSource: rule.trafficSource || "affiliate_link",
      customFormula: rule.customFormula || "",
    });
    setBonuses(Array.isArray(rule.bonuses) ? rule.bonuses : []);
    setConditions(cleanConditions);
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
    ["categoryId", "productId", "campaignId", "influencerId", "affiliateId", "trafficSource"].forEach((key) => {
      payload[key] = null;
    });
    if (visibleMethodFields.has("commissionValue")) payload.commissionValue = Number(ruleForm.commissionValue || 0);
    if (visibleMethodFields.has("fixedAmount")) payload.fixedAmount = Number(ruleForm.fixedAmount || 0);
    if (visibleMethodFields.has("revenueSharePercent")) payload.revenueSharePercent = Number(ruleForm.revenueSharePercent || 0);
    payload.customFormula = showCustomFormula ? ruleForm.customFormula : "";
    payload.bonuses = showBonusBuilder ? bonuses : [];
    payload.conditions = conditions.map((condition) => ({
      field: condition.field,
      operator: condition.operator,
      value: condition.value,
      ...(condition.valueTo != null && condition.valueTo !== "" ? { valueTo: condition.valueTo } : {}),
    }));
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
      () => (editingRuleId ? updateCommissionEngineRule(editingRuleId, payload) : createCommissionEngineRule(payload)).then((response) => {
        resetRuleForm();
        return response;
      }),
      editingRuleId ? "Commission rule updated." : "Commission rule created."
    );
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
    setBonusForm(defaultBonusForm);
  }

  function addCondition() {
    setConditions((current) => [
      ...current,
      {
        field: conditionForm.field,
        operator: conditionForm.operator,
        value: conditionForm.operator === "between" ? Number(conditionForm.value || 0) : conditionForm.value,
        ...(conditionForm.operator === "between" ? { valueTo: Number(conditionForm.valueTo || 0) } : {}),
      },
    ]);
    setConditionForm(defaultConditionForm);
  }

  async function runSimulation(event) {
    event.preventDefault();
    setSimulationBusy(true);
    setSimulationError("");
    try {
      const payload = {
        trafficSource: simulatorForm.trafficSource || "affiliate_link",
        revenue: Number(simulatorForm.revenue || 0),
        expectedOrders: Number(simulatorForm.expectedOrders || 0),
        conversionRate: Number(simulatorForm.conversionRate || 0),
        campaignCompletion: Number(simulatorForm.campaignCompletion || 0),
        reelEngagement: Number(simulatorForm.reelEngagement || 0),
        reelEngagementTarget: Number(simulatorForm.reelEngagementTarget || 0),
      };
      ["influencerId", "campaignId", "productId", "categoryId", "vendorId"].forEach((key) => {
        if (simulatorForm[key]) payload[key] = simulatorForm[key];
      });
      const response = await simulateCommissionEngine(payload);
      setSimulation(unwrap(response));
    } catch (err) {
      setSimulation(null);
      setSimulationError(err?.response?.data?.message || err?.message || "Simulation failed.");
    } finally {
      setSimulationBusy(false);
    }
  }

  function createSettlement(event) {
    event.preventDefault();
    runAction(
      "create-settlement",
      () => createCommissionEngineSettlement({
        cycle: settlementForm.cycle,
        periodStart: settlementForm.periodStart,
        periodEnd: settlementForm.periodEnd,
      }).then((response) => {
        const settlement = unwrap(response);
        const settlementId = idOf(settlement);
        if (settlementId) setSettlementField("settlementId", settlementId);
        return response;
      }),
      "Settlement batch created."
    );
  }

  function renderSelectField(label, key, options, placeholder) {
    return (
      <FieldShell label={label}>
        <select className="h-11 rounded-xl border border-slate-200 px-3 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={simulatorForm[key]} onChange={(event) => setSimulatorField(key, event.target.value)}>
          <option value="">{placeholder}</option>
          {options.map((option) => <option key={`${key}-${option.value}`} value={option.value}>{option.label}</option>)}
        </select>
      </FieldShell>
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
  const settlementOptions = settlements.map((settlement) => ({
    value: idOf(settlement),
    label: `${dateValue(settlement.periodStart)} - ${dateValue(settlement.periodEnd)} / ${statusText(settlement.status)} / ${formatCurrency(settlement.totalAmount || 0)}`,
  })).filter((option) => option.value);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {metrics.map(([label, value]) => (
          <Metric key={label} label={label} value={formatCurrency(value || 0)} />
        ))}
      </div>

      <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(760px,1fr)_minmax(420px,520px)]">
        <Section title="Rules Engine" icon={Percent}>
          <form onSubmit={saveRule} className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                  {trafficSources.map((source) => <option key={source} value={source}>{statusText(source)}</option>)}
                </select>
              </FieldShell>
            ) : null}
            {visibleTargetFields.map(([key, placeholder]) => (
              <FieldShell key={key} label={placeholder}>
                {ruleTargetOptions[key]?.length ? (
                  <select className="h-11 rounded-xl border border-slate-200 px-3 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={ruleForm[key]} onChange={(event) => setRuleField(key, event.target.value)} required>
                    <option value="">Select {placeholder.replace(/\s*ID$/i, "").toLowerCase()}</option>
                    {ruleTargetOptions[key].map((option) => <option key={`rule-${key}-${option.value}`} value={option.value}>{option.label}</option>)}
                  </select>
                ) : (
                  <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder={placeholder} value={ruleForm[key]} onChange={(event) => setRuleField(key, event.target.value)} />
                )}
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
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800 sm:col-span-2 xl:col-span-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Performance Bonus</p>
              <div className="grid gap-2 md:grid-cols-6">
                <FieldShell label="Metric">
                  <select className="h-10 rounded-lg border border-slate-200 px-2 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={bonusForm.metric} onChange={(event) => setBonusForm((current) => ({ ...current, metric: event.target.value }))}>
                    {["orders", "conversionRate", "campaignCompletion", "reelEngagement"].map((metric) => <option key={metric} value={metric}>{metric}</option>)}
                  </select>
                </FieldShell>
                <FieldShell label="Bonus Type">
                  <select className="h-10 rounded-lg border border-slate-200 px-2 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={bonusForm.type} onChange={(event) => setBonusForm((current) => ({ ...current, type: event.target.value }))}>
                    {["percent", "fixed"].map((type) => <option key={type} value={type}>{statusText(type)}</option>)}
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
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800 sm:col-span-2 xl:col-span-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Rule Conditions</p>
              <div className="grid gap-2 md:grid-cols-5">
                <FieldShell label="Field">
                  <select className="h-10 rounded-lg border border-slate-200 px-2 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={conditionForm.field} onChange={(event) => setConditionForm((current) => ({ ...current, field: event.target.value }))}>
                    {["eligibleRevenue", "orders", "conversionRate", "campaignCompletion", "reelEngagement", "trafficSource"].map((field) => <option key={field} value={field}>{field}</option>)}
                  </select>
                </FieldShell>
                <FieldShell label="Operator">
                  <select className="h-10 rounded-lg border border-slate-200 px-2 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={conditionForm.operator} onChange={(event) => setConditionForm((current) => ({ ...current, operator: event.target.value }))}>
                    {["gt", "gte", "lt", "lte", "eq", "ne", "between"].map((operator) => <option key={operator} value={operator}>{operator}</option>)}
                  </select>
                </FieldShell>
                <FieldShell label="Value">
                  <input className="h-10 rounded-lg border border-slate-200 px-2 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={conditionForm.value} onChange={(event) => setConditionForm((current) => ({ ...current, value: event.target.value }))} />
                </FieldShell>
                <FieldShell label="Value To">
                  <input className="h-10 rounded-lg border border-slate-200 px-2 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" disabled={conditionForm.operator !== "between"} value={conditionForm.valueTo} onChange={(event) => setConditionForm((current) => ({ ...current, valueTo: event.target.value }))} />
                </FieldShell>
                <ActionButton tone="slate" onClick={addCondition}>Add Condition</ActionButton>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {conditions.map((condition, index) => (
                  <button key={`${condition.field}-${index}`} type="button" onClick={() => setConditions((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {condition.field} {condition.operator} {String(condition.value)}{condition.valueTo ? `-${condition.valueTo}` : ""}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-3">
              <ActionButton type="submit" icon={CheckCircle2}>{editingRuleId ? "Update Rule" : "Create Rule"}</ActionButton>
              <ActionButton tone="slate" onClick={resetRuleForm}>Clear</ActionButton>
            </div>
          </form>
        </Section>

        <Section title="Simulator" icon={Calculator}>
          <form onSubmit={runSimulation} className="grid gap-3">
            {renderSelectField("Influencer", "influencerId", influencerOptions, "Select influencer")}
            {renderSelectField("Campaign", "campaignId", campaignOptions, "Select campaign")}
            {renderSelectField("Product", "productId", productOptions, "Select product")}
            {renderSelectField("Category", "categoryId", simulatorCategoryOptions, "Select category")}
            {renderSelectField("Vendor", "vendorId", vendorOptions, "Select vendor")}
            <FieldShell label="Traffic Source">
              <select className="h-11 rounded-xl border border-slate-200 px-3 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={simulatorForm.trafficSource} onChange={(event) => setSimulatorField("trafficSource", event.target.value)}>
                {trafficSources.map((source) => <option key={source} value={source}>{statusText(source)}</option>)}
              </select>
            </FieldShell>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["revenue", "Revenue"],
                ["expectedOrders", "Orders"],
                ["conversionRate", "Conversion %"],
                ["campaignCompletion", "Completion %"],
              ].map(([key, label]) => (
                <FieldShell key={key} label={label}>
                  <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" type="number" min="0" step="0.01" value={simulatorForm[key]} onChange={(event) => setSimulatorField(key, event.target.value)} />
                </FieldShell>
              ))}
            </div>
            {simulationError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                {simulationError}
              </div>
            ) : null}
            <ActionButton type="submit" icon={Calculator} disabled={simulationBusy}>{simulationBusy ? "Running..." : "Run Simulation"}</ActionButton>
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

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
        <Section title="Configured Rules" icon={Percent}>
          <ResponsiveTable headers={["Rule", "Type", "Method", "Value", "Priority", "Version", "Status", "Actions"]} rows={rules} renderRow={(rule) => {
            const id = idOf(rule);
            const isActive = rule.status === "active";
            const isInactive = rule.status === "inactive";
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
                    <ActionButton
                      tone={isActive ? "slate" : "green"}
                      disabled={isActive || busyId === `approve-rule-${id}`}
                      onClick={() => runAction(`approve-rule-${id}`, () => approveCommissionEngineRule(id), isInactive ? "Rule activated." : "Rule approved.")}
                    >
                      {isActive ? "Approved" : isInactive ? "Activate" : "Approve"}
                    </ActionButton>
                    <ActionButton
                      tone={isInactive ? "slate" : "amber"}
                      disabled={isInactive || busyId === `deactivate-rule-${id}`}
                      onClick={() => runAction(`deactivate-rule-${id}`, () => deactivateCommissionEngineRule(id, { reason: "Deactivated from admin panel" }), "Rule deactivated.")}
                    >
                      {isInactive ? "Deactivated" : "Deactivate"}
                    </ActionButton>
                  </div>
                </td>
              </tr>
            );
          }} />
        </Section>

        <Section title="Settlement" icon={WalletCards}>
          <form onSubmit={createSettlement} className="space-y-3">
            <FieldShell label="Cycle">
              <select className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={settlementForm.cycle} onChange={(event) => setSettlementField("cycle", event.target.value)}>
                {["daily", "weekly", "bi_weekly", "monthly"].map((cycle) => <option key={cycle} value={cycle}>{statusText(cycle)}</option>)}
              </select>
            </FieldShell>
            <FieldShell label="Period Start">
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" type="date" value={settlementForm.periodStart} onChange={(event) => setSettlementField("periodStart", event.target.value)} />
            </FieldShell>
            <FieldShell label="Period End">
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" type="date" value={settlementForm.periodEnd} onChange={(event) => setSettlementField("periodEnd", event.target.value)} />
            </FieldShell>
            <ActionButton type="submit" icon={CheckCircle2} disabled={busyId === "create-settlement"}>Create Settlement</ActionButton>
          </form>
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <FieldShell label="Settlement ID">
              {settlementOptions.length ? (
                <select className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={settlementForm.settlementId} onChange={(event) => setSettlementField("settlementId", event.target.value)}>
                  <option value="">Select settlement</option>
                  {settlementOptions.map((option) => <option key={`settlement-${option.value}`} value={option.value}>{option.label}</option>)}
                </select>
              ) : (
                <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm normal-case tracking-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Paste settlement ID" value={settlementForm.settlementId} onChange={(event) => setSettlementField("settlementId", event.target.value)} />
              )}
            </FieldShell>
            <div className="flex flex-wrap gap-2">
              <ActionButton tone="green" disabled={!settlementForm.settlementId || busyId === "approve-settlement"} onClick={() => runAction("approve-settlement", () => approveCommissionEngineSettlement(settlementForm.settlementId), "Settlement approved.")}>Approve</ActionButton>
              <ActionButton tone="slate" disabled={!settlementForm.settlementId || busyId === "prepare-payout"} onClick={() => runAction("prepare-payout", () => prepareCommissionEnginePayoutBatch(settlementForm.settlementId), "Payout batch prepared.")}>Prepare Payout</ActionButton>
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
              <td className="px-3 py-3" title={text(row.action)}>{shortText(statusText(row.action), 34)}</td>
              <td className="px-3 py-3" title={text(row.entityType)}>{shortText(row.entityType, 28)}</td>
              <td className="px-3 py-3">{text(row.userRole || row.userId)}</td>
              <td className="px-3 py-3" title={text(row.reason)}>{shortText(row.reason, 32)}</td>
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
      <ResponsiveTable headers={["Order", "Vendor", "Influencer", "Campaign", "State", "Hold Until", "Gross", "Platform", "Influencer", "Vendor Net", "Actions"]} rows={items} renderRow={(row) => {
        const id = idOf(row);
        const state = String(row.state || row.status || "HOLD").toUpperCase();
        const isHeld = state === "HOLD";
        const isSettled = state === "SETTLED";
        const isCancelled = state === "CANCELLED";
        const isReversed = state === "REVERSED";
        const canHold = isCancelled;
        const canSettle = isHeld;
        const canReverse = isHeld || isSettled || isCancelled;
        return (
          <tr key={id}>
            <td className="px-3 py-3">{text(row.orderId?.orderNumber || row.orderNumber)}</td>
            <td className="px-3 py-3">{pickVendorName(row.vendorId || row.vendor)}</td>
            <td className="px-3 py-3">{pickUserName(row.influencerId || row.influencer)}</td>
            <td className="px-3 py-3">{text(row.campaignId?.title || row.campaign?.title)}</td>
            <td className="px-3 py-3"><StatusBadge value={state} /></td>
            <td className="px-3 py-3">{dateValue(row.holdUntil)}</td>
            <td className="px-3 py-3">{formatCurrency(row.gross || row.grossAmount || row.orderAmount || 0)}</td>
            <td className="px-3 py-3">{formatCurrency(row.platformFee || row.platformShare || 0)}</td>
            <td className="px-3 py-3">{formatCurrency(row.influencerShare || row.amount || 0)}</td>
            <td className="px-3 py-3">{formatCurrency(row.vendorNet || 0)}</td>
            <td className="px-3 py-3">
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  tone={canHold ? "amber" : "slate"}
                  disabled={!canHold || busyId === `hold-${id}`}
                  onClick={() => runAction(`hold-${id}`, () => updateAdminInfluencerCommission(id, { action: "hold", note: "Moved back to hold by platform admin" }), "Commission moved to hold.")}
                >
                  {isHeld ? "Held" : "Hold"}
                </ActionButton>
                <ActionButton
                  tone={canSettle ? "green" : "slate"}
                  disabled={!canSettle || busyId === `settle-${id}`}
                  onClick={() => runAction(`settle-${id}`, () => updateAdminInfluencerCommission(id, { action: "settle", note: "Settled by platform admin" }), "Commission settled.")}
                >
                  {isSettled ? "Settled" : "Settle"}
                </ActionButton>
                <ActionButton
                  tone={canReverse && !isReversed ? "red" : "slate"}
                  disabled={!canReverse || isReversed || busyId === `reverse-${id}`}
                  onClick={() => runAction(`reverse-${id}`, () => updateAdminInfluencerCommission(id, { action: "reverse", note: "Reversed by platform admin" }), "Commission reversed.")}
                >
                  {isReversed ? "Reversed" : "Reverse"}
                </ActionButton>
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

function PerformanceView({ title, items, pagination, setFilters, kind }) {
  return (
    <Section title={title} icon={BarChart3}>
      <ResponsiveTable headers={[kind === "vendor" ? "Vendor" : "Creator", "Status", "Category", "Revenue", "Orders", "Clicks", "Conversions", "CTR", "ROI", "Commission", "Score"]} rows={items || []} renderRow={(row, index) => {
        const name = kind === "vendor" ? pickVendorName(row.vendor || row) : row.name || pickUserName(row.influencer || row);
        return (
          <tr key={idOf(row) || row.influencerId || row.vendorId || index}>
            <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">
              {name}
              {row.followers ? <div className="text-xs font-normal text-slate-500">{numberValue(row.followers)} followers</div> : null}
            </td>
            <td className="px-3 py-3"><StatusBadge value={row.state || row.status || "active"} /></td>
            <td className="px-3 py-3">{text(row.category || row.primaryCategory)}</td>
            <td className="px-3 py-3">{formatCurrency(row.revenue || row.revenueGenerated || row.campaignRevenue || 0)}</td>
            <td className="px-3 py-3">{numberValue(row.orders || row.ordersGenerated)}</td>
            <td className="px-3 py-3">{numberValue(row.clicks)}</td>
            <td className="px-3 py-3">{numberValue(row.conversions)}</td>
            <td className="px-3 py-3">{percentValue(row.ctr)}</td>
            <td className="px-3 py-3">{percentValue(row.roi)}</td>
            <td className="px-3 py-3">{formatCurrency(row.commission || row.commissionEarned || row.commissionPaid || 0)}</td>
            <td className="px-3 py-3">{numberValue(row.score || row.rank || index + 1)}</td>
          </tr>
        );
      }} />
      {pagination && setFilters ? <Pagination pagination={pagination} setFilters={setFilters} /> : null}
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
