import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  CheckCircle2,
  Download,
  FileCheck2,
  LineChart,
  Link as LinkIcon,
  Medal,
  Megaphone,
  MessageSquare,
  Package,
  Search,
  Send,
  ShieldCheck,
  Star,
  Users,
  XCircle,
} from "lucide-react";
import { usePlatformFeatures } from "../context/PlatformFeaturesContext";
import {
  createVendorInfluencerCampaign,
  deleteVendorInfluencerCampaign,
  discoverVendorInfluencers,
  getVendorAffiliateProducts,
  getVendorContentApprovals,
  getVendorCreatorLeaderboard,
  getVendorInfluencerAnalytics,
  getVendorInfluencerCampaigns,
  getVendorInfluencerCommerceDashboard,
  getVendorInfluencerPerformance,
  getVendorInfluencerRelationships,
  getVendorInfluencerReports,
  getVendorPromotionProducts,
  reviewVendorCampaignApplication,
  reviewVendorInfluencerContent,
  saveVendorInfluencer,
  updateVendorInfluencerCampaignStatus,
  updateVendorInfluencerRelationship,
} from "../services/influencerCommerceService";
import { formatCurrency } from "../utils/formatCurrency";
import { resolveApiAssetUrl } from "../utils/resolveUrl";

const TABS = [
  ["dashboard", "Dashboard", BarChart3],
  ["discover", "Discover Influencers", Search],
  ["relationships", "My Influencers", Users],
  ["campaigns", "Campaign Management", Megaphone],
  ["products", "Product Promotion", Package],
  ["affiliate", "Affiliate Products", LinkIcon],
  ["content", "Content Approvals", FileCheck2],
  ["performance", "Influencer Performance", LineChart],
  ["analytics", "Campaign Analytics", BarChart3],
  ["leaderboard", "Creator Leaderboard", Medal],
  ["reports", "Reports", Download],
];

const TAB_IDS = new Set(TABS.map(([id]) => id));
const TAB_PATHS = {
  dashboard: "/vendor/influencer-commerce",
  discover: "/vendor/influencer-commerce/discover",
  relationships: "/vendor/influencer-commerce/relationships",
  campaigns: "/vendor/influencer-commerce/campaigns",
  products: "/vendor/influencer-commerce/products",
  affiliate: "/vendor/influencer-commerce/affiliate",
  content: "/vendor/influencer-commerce/content",
  performance: "/vendor/influencer-commerce/performance",
  analytics: "/vendor/influencer-commerce/analytics",
  leaderboard: "/vendor/influencer-commerce/leaderboard",
  reports: "/vendor/influencer-commerce/reports",
};

const CAMPAIGN_TYPES = [
  ["affiliate", "Affiliate Campaign"],
  ["sponsored", "Sponsored Campaign"],
  ["ugc", "UGC Campaign"],
  ["video", "Video Campaign"],
  ["live_commerce", "Live Commerce Campaign"],
  ["brand_ambassador", "Brand Ambassador Program"],
];

const defaultFilters = {
  search: "",
  category: "",
  campaignId: "",
  productId: "",
  influencerId: "",
  startDate: "",
  endDate: "",
  sort: "trending",
};

function numberValue(value) {
  return Number(value || 0).toLocaleString();
}

function percentValue(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function statusText(value = "") {
  return String(value || "open").replace(/_/g, " ");
}

function getId(row) {
  return row?.id || row?._id;
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

function FieldLabel({ children }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {children}
    </span>
  );
}

function Filters({ filters, setFilters, campaigns = [], products = [], includeSearch = true }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-5">
      {includeSearch ? (
        <label className="block space-y-1.5 md:col-span-2">
          <FieldLabel>Search</FieldLabel>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search creators, campaigns, products"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              aria-label="Search influencer commerce"
            />
          </span>
        </label>
      ) : null}
      <label className="block space-y-1.5">
        <FieldLabel>Campaign</FieldLabel>
        <select value={filters.campaignId} onChange={(event) => setFilters((current) => ({ ...current, campaignId: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Campaign filter">
          <option value="">All campaigns</option>
          {campaigns.map((campaign) => <option key={getId(campaign)} value={getId(campaign)}>{campaign.title || "Campaign"}</option>)}
        </select>
      </label>
      <label className="block space-y-1.5">
        <FieldLabel>Product</FieldLabel>
        <select value={filters.productId} onChange={(event) => setFilters((current) => ({ ...current, productId: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Product filter">
          <option value="">All products</option>
          {products.map((row) => {
            const product = row.product || row;
            return <option key={getId(product)} value={getId(product)}>{product.name}</option>;
          })}
        </select>
      </label>
      <label className="block space-y-1.5">
        <FieldLabel>Start Date</FieldLabel>
        <input type="date" value={filters.startDate} onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Start date" />
      </label>
      <label className="block space-y-1.5">
        <FieldLabel>End Date</FieldLabel>
        <input type="date" value={filters.endDate} onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="End date" />
      </label>
    </div>
  );
}

function SimpleBars({ rows = [], valueKey = "revenue", labelKey = "date" }) {
  const max = Math.max(...rows.map((row) => Number(row[valueKey] || 0)), 1);
  return (
    <div className="flex h-52 items-end gap-2 overflow-x-auto rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
      {rows.map((row) => (
        <div key={row[labelKey]} className="flex min-w-8 flex-1 flex-col items-center gap-2">
          <div className="w-full rounded-t-lg bg-indigo-500" style={{ height: `${Math.max(6, (Number(row[valueKey] || 0) / max) * 170)}px` }} />
          <span className="max-w-16 truncate text-[10px] text-slate-500 dark:text-slate-400">{String(row[labelKey]).slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function CampaignForm({ influencers, products, onCreate, busy }) {
  const [form, setForm] = useState({
    influencerId: "",
    title: "",
    campaignType: "affiliate",
    productIds: [],
    commissionPercent: 10,
    fixedFee: 0,
    deadline: "",
    marketplace: { public: true },
  });

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    await onCreate({ ...form, deadline: form.deadline || null });
    setForm({ influencerId: "", title: "", campaignType: "affiliate", productIds: [], commissionPercent: 10, fixedFee: 0, deadline: "", marketplace: { public: true } });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      <label className="block space-y-1.5 xl:col-span-2">
        <FieldLabel>Campaign Title</FieldLabel>
        <input value={form.title} onChange={(event) => setField("title", event.target.value)} placeholder="Campaign title" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Campaign title" />
      </label>
      <label className="block space-y-1.5">
        <FieldLabel>Influencer</FieldLabel>
        <select value={form.influencerId} onChange={(event) => setField("influencerId", event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Invite influencer">
          <option value="">Public marketplace campaign</option>
          {influencers.map((row) => <option key={row.influencerId || row.id} value={row.influencerId || row.id}>{row.name || row.username}</option>)}
        </select>
      </label>
      <label className="block space-y-1.5">
        <FieldLabel>Campaign Type</FieldLabel>
        <select value={form.campaignType} onChange={(event) => setField("campaignType", event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Campaign type">
          {CAMPAIGN_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="block space-y-1.5 xl:col-span-2">
        <FieldLabel>Campaign Products</FieldLabel>
        <select multiple value={form.productIds} onChange={(event) => setField("productIds", Array.from(event.target.selectedOptions).map((option) => option.value))} className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Campaign products" required>
          {products.map((row) => {
            const product = row.product || row;
            return <option key={getId(product)} value={getId(product)}>{product.name}</option>;
          })}
        </select>
      </label>
      <label className="block space-y-1.5">
        <FieldLabel>Commission Percent</FieldLabel>
        <input type="number" min="0" max="50" value={form.commissionPercent} onChange={(event) => setField("commissionPercent", Number(event.target.value || 0))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Commission percent" />
      </label>
      <label className="block space-y-1.5">
        <FieldLabel>Fixed Fee</FieldLabel>
        <input type="number" min="0" value={form.fixedFee} onChange={(event) => setField("fixedFee", Number(event.target.value || 0))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Fixed fee" />
      </label>
      <label className="block space-y-1.5">
        <FieldLabel>Campaign Deadline</FieldLabel>
        <input type="date" value={form.deadline} onChange={(event) => setField("deadline", event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Campaign deadline" />
      </label>
      <label className="block space-y-1.5">
        <FieldLabel>Visibility</FieldLabel>
        <span className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={form.marketplace.public} onChange={(event) => setForm((current) => ({ ...current, marketplace: { ...current.marketplace, public: event.target.checked } }))} />
          Marketplace
        </span>
      </label>
      <button type="submit" disabled={busy} className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
        <Send className="h-4 w-4" aria-hidden="true" />
        Create
      </button>
    </form>
  );
}

export function VendorInfluencerPage() {
  const { influencerCommerceEnabled, loading: commerceLoading } = usePlatformFeatures();
  const location = useLocation();
  const navigate = useNavigate();
  const tab = useMemo(() => {
    const suffix = location.pathname.replace(/^\/vendor\/influencer-commerce\/?/, "");
    const next = suffix.split("/")[0] || "dashboard";
    return TAB_IDS.has(next) ? next : "dashboard";
  }, [location.pathname]);
  const [filters, setFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [data, setData] = useState({});

  const query = useMemo(() => {
    const clean = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value) clean[key] = value;
    });
    return clean;
  }, [filters]);

  const campaigns = data.campaigns?.items || data.dashboard?.campaigns || [];
  const products = data.products?.items || [];
  const relationships = data.relationships?.items || [];
  const discovery = data.discover?.items || [];

  const loadFoundation = useCallback(async () => {
    const [campaignResponse, productResponse, relationshipResponse] = await Promise.all([
      getVendorInfluencerCampaigns({ limit: 100 }),
      getVendorPromotionProducts({ limit: 100 }),
      getVendorInfluencerRelationships({ limit: 100 }),
    ]);
    setData((current) => ({
      ...current,
      campaigns: campaignResponse?.data || { items: [] },
      products: productResponse?.data || { items: [] },
      relationships: relationshipResponse?.data || { items: [] },
    }));
  }, []);

  const loadTab = useCallback(async () => {
    if (commerceLoading || !influencerCommerceEnabled) return;
    setLoading(true);
    setError("");
    try {
      const loaders = {
        dashboard: () => getVendorInfluencerCommerceDashboard(query),
        discover: () => discoverVendorInfluencers(query),
        relationships: () => getVendorInfluencerRelationships(query),
        campaigns: () => getVendorInfluencerCampaigns(query),
        products: () => getVendorPromotionProducts(query),
        affiliate: () => getVendorAffiliateProducts(query),
        content: () => getVendorContentApprovals({ ...query, queue: "pending" }),
        performance: () => getVendorInfluencerPerformance(query),
        analytics: () => getVendorInfluencerAnalytics(query),
        leaderboard: () => getVendorCreatorLeaderboard(query),
        reports: () => getVendorInfluencerReports(query),
      };
      const response = await loaders[tab]();
      setData((current) => ({ ...current, [tab]: response?.data || {} }));
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to load influencer commerce data.");
    } finally {
      setLoading(false);
    }
  }, [commerceLoading, influencerCommerceEnabled, query, tab]);

  useEffect(() => {
    if (!commerceLoading && influencerCommerceEnabled) {
      loadFoundation().catch(() => {});
    }
  }, [commerceLoading, influencerCommerceEnabled, loadFoundation]);

  useEffect(() => {
    const timer = window.setTimeout(loadTab, filters.search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [filters.search, loadTab]);

  if (!commerceLoading && !influencerCommerceEnabled) {
    return <Navigate to="/vendor/dashboard" replace />;
  }

  async function runAction(id, action, successText) {
    setBusyId(id);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(successText);
      await Promise.all([loadTab(), loadFoundation()]);
    } catch (err) {
      setError(err?.response?.data?.message || "Action failed.");
    } finally {
      setBusyId("");
    }
  }

  async function createCampaign(payload) {
    await runAction("create-campaign", () => createVendorInfluencerCampaign(payload), "Campaign synchronized with the influencer ecosystem.");
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Existing influencer commerce stack
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">Influencer Commerce</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              Campaign collaboration, affiliate promotion, content approvals, attribution, commissions, payouts, analytics, and reports powered by the existing campaign, content, wallet, notification, and commission systems.
            </p>
          </div>
          <button type="button" onClick={() => navigate(TAB_PATHS.campaigns)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950">
            <Megaphone className="h-4 w-4" aria-hidden="true" />
            New Campaign
          </button>
        </div>
      </section>

      <Filters filters={filters} setFilters={setFilters} campaigns={campaigns} products={products} includeSearch={!["dashboard", "analytics", "reports"].includes(tab)} />

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100">{error}</div> : null}

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">Loading influencer commerce...</div> : null}

      {tab === "dashboard" ? <DashboardView dashboard={data.dashboard} /> : null}
      {tab === "discover" ? <DiscoverView rows={discovery} busyId={busyId} onSave={(row) => runAction(row.id, () => saveVendorInfluencer(row.id, !row.saved), row.saved ? "Influencer removed from saved list." : "Influencer saved.")} onInvite={(row) => { navigate(TAB_PATHS.campaigns); setFilters((current) => ({ ...current, influencerId: row.id })); }} /> : null}
      {tab === "relationships" ? <RelationshipsView rows={relationships} busyId={busyId} onStatus={(row, status) => runAction(row.influencerId, () => updateVendorInfluencerRelationship(row.influencerId, { status }), "Relationship updated.")} /> : null}
      {tab === "campaigns" ? <CampaignsView campaigns={campaigns} products={products} influencers={[...relationships, ...discovery]} busyId={busyId} onCreate={createCampaign} onReview={(campaign, application, decision) => runAction(`${campaign._id}-${application.influencerId}`, () => reviewVendorCampaignApplication(campaign._id, application.influencerId, { decision }), "Campaign application reviewed.")} onStatus={(campaign, action) => runAction(campaign._id, () => updateVendorInfluencerCampaignStatus(campaign._id, { action }), "Campaign status updated.")} onDelete={(campaign) => runAction(`delete-${campaign._id}`, () => deleteVendorInfluencerCampaign(campaign._id), "Campaign deleted.")} /> : null}
      {tab === "products" ? <ProductsView rows={products} title="Product Promotion" /> : null}
      {tab === "affiliate" ? <ProductsView rows={data.affiliate?.items || []} title="Affiliate Products" /> : null}
      {tab === "content" ? <ContentView rows={data.content?.items || []} busyId={busyId} onReview={(row, decision) => runAction(row.id, () => reviewVendorInfluencerContent(row.id, { decision, note: decision === "changes" ? "Please update this content and resubmit." : "" }), "Content review synchronized.")} /> : null}
      {tab === "performance" ? <PerformanceView rows={data.performance?.items || []} /> : null}
      {tab === "analytics" ? <AnalyticsView analytics={data.analytics} /> : null}
      {tab === "leaderboard" ? <LeaderboardView rows={data.leaderboard?.items || []} onInvite={(row) => { navigate(TAB_PATHS.campaigns); setFilters((current) => ({ ...current, influencerId: row.influencerId })); }} /> : null}
      {tab === "reports" ? <ReportsView reports={data.reports} /> : null}
    </div>
  );
}

function DashboardView({ dashboard = {} }) {
  const widgets = dashboard.widgets || {};
  const charts = dashboard.charts || {};
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Total Influencers" value={numberValue(widgets.totalInfluencers)} />
        <Metric label="Active Influencers" value={numberValue(widgets.activeInfluencers)} />
        <Metric label="Campaign Revenue" value={formatCurrency(widgets.campaignRevenue || 0)} />
        <Metric label="Campaign Spend" value={formatCurrency(widgets.campaignSpend || 0)} />
        <Metric label="Commission Paid" value={formatCurrency(widgets.commissionPaid || 0)} />
        <Metric label="Pending Commission" value={formatCurrency(widgets.pendingCommissions || 0)} />
        <Metric label="Conversions" value={numberValue(widgets.campaignConversions)} />
        <Metric label="ROI" value={percentValue(widgets.roi)} />
        <Metric label="Content Queue" value={numberValue(widgets.pendingContentApprovals)} />
        <Metric label="Applications" value={numberValue(widgets.pendingApplications)} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Campaign Revenue Trend" icon={BarChart3}><SimpleBars rows={charts.campaignRevenueTrend || []} valueKey="revenue" /></Section>
        <Section title="Commission Trend" icon={LineChart}><SimpleBars rows={charts.commissionTrend || []} valueKey="commission" /></Section>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <MiniTable title="Top Influencers" icon={Users} rows={dashboard.topInfluencers || []} columns={["name", "revenue", "orders"]} moneyColumns={["revenue"]} />
        <MiniTable title="Top Products" icon={Package} rows={dashboard.topProducts || []} columns={["name", "revenue", "orders"]} moneyColumns={["revenue"]} />
      </div>
    </div>
  );
}

function MiniTable({ title, icon, rows, columns, moneyColumns = [] }) {
  return (
    <Section title={title} icon={icon}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr>{columns.map((column) => <th key={column} className="px-3 py-2">{statusText(column)}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id || row.name} className="border-t border-slate-100 dark:border-slate-800">
                {columns.map((column) => <td key={column} className="px-3 py-3 text-slate-700 dark:text-slate-200">{moneyColumns.includes(column) ? formatCurrency(row[column] || 0) : row[column]}</td>)}
              </tr>
            ))}
            {!rows.length ? <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={columns.length}>No data yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function DiscoverView({ rows, busyId, onSave, onInvite }) {
  return (
    <Section title="Influencer Discovery Marketplace" icon={Search}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <article key={row.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                {row.profilePicture ? <img src={resolveApiAssetUrl(row.profilePicture)} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold text-slate-950 dark:text-white">{row.name}</h3>
                <p className="truncate text-sm text-slate-500">@{row.username}</p>
              </div>
              {row.verified ? <ShieldCheck className="h-5 w-5 text-emerald-500" aria-label="Verified" /> : null}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <MetricTile label="Followers" value={numberValue(row.followers)} />
              <MetricTile label="Engage" value={percentValue(row.engagementRate)} />
              <MetricTile label="Convert" value={percentValue(row.conversionRate)} />
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{row.category || "General"} - {(row.languages || []).join(", ") || "Any language"}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => onInvite(row)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"><Send className="h-3.5 w-3.5" />Invite</button>
              <button type="button" disabled={busyId === row.id} onClick={() => onSave(row)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"><Star className="h-3.5 w-3.5" />{row.saved ? "Saved" : "Save"}</button>
              <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"><MessageSquare className="h-3.5 w-3.5" />Message</button>
            </div>
          </article>
        ))}
        {!rows.length ? <EmptyState message="No influencers match the current filters." /> : null}
      </div>
    </Section>
  );
}

function MetricTile({ label, value }) {
  return <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950"><span className="block text-slate-500">{label}</span><b className="text-slate-950 dark:text-white">{value}</b></div>;
}

function RelationshipsView({ rows, busyId, onStatus }) {
  return (
    <Section title="Influencer Relationship Management" icon={Users}>
      <ResponsiveTable
        headers={["Influencer", "Status", "Active Campaigns", "Revenue", "Commission", "Conversion", "Last Activity", "Actions"]}
        rows={rows}
        renderRow={(row) => (
          <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
            <td className="px-3 py-3 font-semibold text-slate-950 dark:text-white">{row.name}<div className="text-xs font-normal text-slate-500">@{row.username}</div></td>
            <td className="px-3 py-3"><StatusBadge value={row.status} /></td>
            <td className="px-3 py-3">{row.activeCampaigns}</td>
            <td className="px-3 py-3">{formatCurrency(row.revenueGenerated || 0)}</td>
            <td className="px-3 py-3">{formatCurrency(row.commissionPaid || 0)}</td>
            <td className="px-3 py-3">{percentValue(row.conversionRate)}</td>
            <td className="px-3 py-3">{row.lastActivity ? new Date(row.lastActivity).toLocaleDateString() : "-"}</td>
            <td className="px-3 py-3">
              <div className="flex gap-2">
                <button disabled={busyId === row.influencerId} onClick={() => onStatus(row, "active")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700">Activate</button>
                <button disabled={busyId === row.influencerId} onClick={() => onStatus(row, "paused")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700">Pause</button>
              </div>
            </td>
          </tr>
        )}
      />
    </Section>
  );
}

function CampaignsView({ campaigns, products, influencers, busyId, onCreate, onReview, onStatus, onDelete }) {
  function confirmDelete(campaign) {
    const title = campaign.title || "this campaign";
    if (window.confirm(`Delete "${title}"? This is only allowed before applications, content, or commissions exist.`)) {
      onDelete(campaign);
    }
  }

  return (
    <div className="grid gap-5">
      <Section title="Create Campaign" icon={Megaphone}>
        <CampaignForm influencers={influencers} products={products} onCreate={onCreate} busy={busyId === "create-campaign"} />
      </Section>
      <Section title="Campaign Management" icon={Megaphone}>
        <ResponsiveTable
          headers={["Campaign", "Budget", "Revenue", "Applications", "Approved Creators", "Status", "Actions"]}
          rows={campaigns}
          renderRow={(campaign) => (
            <tr key={campaign._id} className="border-t border-slate-100 align-top dark:border-slate-800">
              <td className="px-3 py-3 font-semibold text-slate-950 dark:text-white">{campaign.title || "Campaign"}<div className="text-xs font-normal capitalize text-slate-500">{statusText(campaign.campaignType)}</div></td>
              <td className="px-3 py-3">{formatCurrency(campaign.budget || campaign.fixedFee || 0)}</td>
              <td className="px-3 py-3">{formatCurrency(campaign.revenue || campaign.analytics?.revenue || 0)}</td>
              <td className="px-3 py-3">{campaign.applicationsCount || campaign.applications?.length || 0}</td>
              <td className="px-3 py-3">{campaign.approvedCreators || 0}</td>
              <td className="px-3 py-3"><StatusBadge value={campaign.state} /></td>
              <td className="px-3 py-3">
                <div className="flex flex-wrap gap-2">
                  <button disabled={busyId === campaign._id} onClick={() => onStatus(campaign, "activate")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700">Activate</button>
                  <button disabled={busyId === campaign._id} onClick={() => onStatus(campaign, "pause")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700">Pause</button>
                  <button disabled={busyId === campaign._id} onClick={() => onStatus(campaign, "close")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700">Close</button>
                  <button disabled={busyId === `delete-${campaign._id}`} onClick={() => confirmDelete(campaign)} className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/30">Delete</button>
                </div>
                {(campaign.applications || []).length ? (
                  <div className="mt-3 space-y-2">
                    {(campaign.applications || []).map((application) => {
                      const applicationInfluencerId = String(application.influencerId?._id || application.influencerId);
                      const applicationBusy = busyId === `${campaign._id}-${applicationInfluencerId}`;
                      const isApproved = application.status === "approved";
                      const isRejected = application.status === "rejected";
                      return (
                        <div key={applicationInfluencerId} className="flex flex-wrap items-center gap-2 text-xs">
                          <StatusBadge value={application.status} />
                          <button disabled={applicationBusy || isApproved} onClick={() => onReview(campaign, { ...application, influencerId: applicationInfluencerId }, "approve")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 className="h-3 w-3" />Approve</button>
                          <button disabled={applicationBusy || isRejected} onClick={() => onReview(campaign, { ...application, influencerId: applicationInfluencerId }, "reject")} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2 py-1 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><XCircle className="h-3 w-3" />Reject</button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </td>
            </tr>
          )}
        />
      </Section>
    </div>
  );
}

function ProductsView({ rows, title }) {
  return (
    <Section title={title} icon={Package}>
      <ResponsiveTable
        headers={["Product", "Promoted", "Clicks", "Orders", "Revenue", "Commission", "CTR", "Conversion"]}
        rows={rows}
        renderRow={(row) => (
          <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
            <td className="px-3 py-3 font-semibold text-slate-950 dark:text-white">{row.name}<div className="text-xs font-normal text-slate-500">{row.category}</div></td>
            <td className="px-3 py-3">{row.promoted ? "Yes" : "No"}</td>
            <td className="px-3 py-3">{numberValue(row.clicks)}</td>
            <td className="px-3 py-3">{numberValue(row.orders)}</td>
            <td className="px-3 py-3">{formatCurrency(row.revenue || 0)}</td>
            <td className="px-3 py-3">{formatCurrency(row.commission || 0)}</td>
            <td className="px-3 py-3">{percentValue(row.ctr)}</td>
            <td className="px-3 py-3">{percentValue(row.conversionRate)}</td>
          </tr>
        )}
      />
    </Section>
  );
}

function ContentView({ rows, busyId, onReview }) {
  return (
    <Section title="Content Approvals" icon={FileCheck2}>
      <ResponsiveTable
        headers={["Creator", "Campaign", "Type", "Submitted", "Status", "Actions"]}
        rows={rows}
        renderRow={(row) => (
          <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
            <td className="px-3 py-3 font-semibold text-slate-950 dark:text-white">{row.creatorName}</td>
            <td className="px-3 py-3">{row.campaign?.title || "-"}</td>
            <td className="px-3 py-3 capitalize">{statusText(row.contentType)}</td>
            <td className="px-3 py-3">{row.submittedDate ? new Date(row.submittedDate).toLocaleDateString() : "-"}</td>
            <td className="px-3 py-3"><StatusBadge value={row.status} /></td>
            <td className="px-3 py-3">
              <div className="flex flex-wrap gap-2">
                <button disabled={busyId === row.id} onClick={() => onReview(row, "approve")} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">Approve</button>
                <button disabled={busyId === row.id} onClick={() => onReview(row, "changes")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700">Changes</button>
                <button disabled={busyId === row.id} onClick={() => onReview(row, "reject")} className="rounded-lg bg-rose-600 px-2 py-1 text-xs font-semibold text-white">Reject</button>
              </div>
            </td>
          </tr>
        )}
      />
    </Section>
  );
}

function PerformanceView({ rows }) {
  return (
    <Section title="Performance Intelligence" icon={LineChart}>
      <ResponsiveTable
        headers={["Creator", "Revenue", "Orders", "Clicks", "Conversions", "CTR", "ROI", "Engagement", "AOV"]}
        rows={rows}
        renderRow={(row) => (
          <tr key={row.influencerId} className="border-t border-slate-100 dark:border-slate-800">
            <td className="px-3 py-3 font-semibold text-slate-950 dark:text-white">{row.name}<div className="text-xs font-normal text-slate-500">@{row.username}</div></td>
            <td className="px-3 py-3">{formatCurrency(row.revenueGenerated || 0)}</td>
            <td className="px-3 py-3">{numberValue(row.ordersGenerated)}</td>
            <td className="px-3 py-3">{numberValue(row.clicks)}</td>
            <td className="px-3 py-3">{numberValue(row.conversions)}</td>
            <td className="px-3 py-3">{percentValue(row.ctr)}</td>
            <td className="px-3 py-3">{percentValue(row.roi)}</td>
            <td className="px-3 py-3">{numberValue(row.engagement)}</td>
            <td className="px-3 py-3">{formatCurrency(row.averageOrderValue || 0)}</td>
          </tr>
        )}
      />
    </Section>
  );
}

function AnalyticsView({ analytics = {} }) {
  const kpis = analytics.kpis || {};
  const charts = analytics.charts || {};
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <Metric label="Revenue" value={formatCurrency(kpis.campaignRevenue || 0)} />
        <Metric label="Spend" value={formatCurrency(kpis.campaignSpend || 0)} />
        <Metric label="ROI" value={percentValue(kpis.roi)} />
        <Metric label="Commission Paid" value={formatCurrency(kpis.commissionPaid || 0)} />
        <Metric label="Conversions" value={numberValue(kpis.conversions)} />
        <Metric label="Orders" value={numberValue(kpis.orders)} />
        <Metric label="Clicks" value={numberValue(kpis.clicks)} />
      </div>
      <Section title="Revenue Trend" icon={BarChart3}><SimpleBars rows={charts.revenueTrend || []} valueKey="revenue" /></Section>
      <MiniTable title="Campaign Comparison" icon={Megaphone} rows={charts.campaignComparison || []} columns={["title", "revenue", "orders", "clicks"]} moneyColumns={["revenue"]} />
    </div>
  );
}

function LeaderboardView({ rows, onInvite }) {
  return (
    <Section title="Creator Leaderboard" icon={Medal}>
      <ResponsiveTable
        headers={["Rank", "Creator", "Revenue", "Conversions", "Engagement", "Score", "Actions"]}
        rows={rows}
        renderRow={(row) => (
          <tr key={row.influencerId} className="border-t border-slate-100 dark:border-slate-800">
            <td className="px-3 py-3 font-semibold">#{row.rank}</td>
            <td className="px-3 py-3 font-semibold text-slate-950 dark:text-white">{row.creator}</td>
            <td className="px-3 py-3">{formatCurrency(row.revenueGenerated || 0)}</td>
            <td className="px-3 py-3">{numberValue(row.conversions)}</td>
            <td className="px-3 py-3">{numberValue(row.engagement)}</td>
            <td className="px-3 py-3">{numberValue(row.score)}</td>
            <td className="px-3 py-3"><button onClick={() => onInvite(row)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">Invite</button></td>
          </tr>
        )}
      />
    </Section>
  );
}

function ReportsView({ reports = {} }) {
  return (
    <div className="grid gap-5">
      <Section title="Reporting Center" icon={Download}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(reports.reports || []).map((report) => (
            <article key={report.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="font-semibold text-slate-950 dark:text-white">{report.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{numberValue(report.rows)} rows available</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(report.exportFormats || []).map((format) => <button key={format} type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase dark:border-slate-700">{format}</button>)}
              </div>
            </article>
          ))}
        </div>
      </Section>
      <Section title="Scheduling" icon={FileCheck2}>
        <div className="grid gap-3 md:grid-cols-3">
          {(reports.schedules || []).map((schedule) => <label key={schedule.frequency} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 text-sm font-semibold capitalize dark:border-slate-800"><span>{schedule.frequency}</span><input type="checkbox" defaultChecked={schedule.enabled} /></label>)}
        </div>
      </Section>
    </div>
  );
}

function ResponsiveTable({ headers, rows, renderRow }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[900px] w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <tr>{headers.map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr>
        </thead>
        <tbody className="text-slate-700 dark:text-slate-200">
          {rows.map(renderRow)}
          {!rows.length ? <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={headers.length}>No records found.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ message }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">{message}</div>;
}
