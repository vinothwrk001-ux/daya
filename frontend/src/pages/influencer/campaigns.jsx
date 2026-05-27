import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BarChart3,
  Bookmark,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileUp,
  Megaphone,
  Search,
  Send,
} from "lucide-react";
import {
  applyCampaignMarketplace,
  generateAffiliateProductLinks,
  getCampaignMarketplaceAnalytics,
  listCampaignMarketplace,
  saveCampaignMarketplace,
  submitCampaignDeliverable,
} from "../../services/influencerCommerceService";
import { formatCurrency } from "../../utils/formatCurrency";

const TABS = [
  { id: "available", label: "Available Campaigns" },
  { id: "recommended", label: "Recommended Campaigns" },
  { id: "applied", label: "Applied Campaigns" },
  { id: "active", label: "Active Campaigns" },
  { id: "completed", label: "Completed Campaigns" },
  { id: "analytics", label: "Campaign Analytics" },
];

const CAMPAIGN_TYPES = [
  ["", "All types"],
  ["affiliate", "Affiliate"],
  ["sponsored", "Sponsored"],
  ["product_review", "Product Review"],
  ["ugc", "UGC"],
  ["video", "Video"],
  ["live_commerce", "Live Commerce"],
  ["brand_ambassador", "Brand Ambassador"],
];

function statusLabel(value = "") {
  return String(value || "open").replace(/_/g, " ");
}

function campaignProductIds(campaign) {
  return (campaign.products || campaign.productIds || [])
    .map((product) => product.id || product._id || product)
    .filter(Boolean)
    .map(String);
}

function CampaignCard({ campaign, onApply, onSave, onSubmitDeliverable, onGenerateLink, busyId }) {
  const busy = busyId === campaign.id;
  const applicationStatus = campaign.applicationStatus || "";
  const isApplied = ["submitted", "pending_review", "shortlisted", "approved", "active", "completed"].includes(applicationStatus);
  const isActive = ["approved", "active", "completed"].includes(applicationStatus);
  const isWaiting = ["submitted", "pending_review", "shortlisted"].includes(applicationStatus);
  const deadline = campaign.applicationDeadline || campaign.deadline;
  const productIds = campaignProductIds(campaign);
  const contentHref = `/influencer/content?campaignId=${campaign.id}${productIds.length ? `&productIds=${encodeURIComponent(productIds.join(","))}` : ""}`;

  return (
    <article className="flex min-h-[360px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="h-28 bg-slate-100 dark:bg-slate-800">
        {campaign.banner ? (
          <img src={campaign.banner} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            <Megaphone className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">{campaign.brandName}</p>
            <h3 className="mt-1 line-clamp-2 text-lg font-semibold text-slate-950 dark:text-white">{campaign.title}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{campaign.category || "General"} · {statusLabel(campaign.campaignType)}</p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {statusLabel(campaign.applicationStatus || campaign.state)}
          </span>
        </div>

        <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
          {campaign.description || "Brand partnership opportunity with tracked products, commission attribution, and deliverable workflow."}
        </p>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">Budget</p>
            <p className="mt-1 font-semibold text-slate-950 dark:text-white">{formatCurrency(campaign.budget || 0)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">Commission</p>
            <p className="mt-1 font-semibold text-slate-950 dark:text-white">{campaign.commissionRate || campaign.commissionPercent || 0}%</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">Products</p>
            <p className="mt-1 font-semibold text-slate-950 dark:text-white">{campaign.products?.length || 0}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">Deadline</p>
            <p className="mt-1 font-semibold text-slate-950 dark:text-white">{deadline ? new Date(deadline).toLocaleDateString() : "Open"}</p>
          </div>
        </div>

        {campaign.recommendationScore ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100">
            {campaign.recommendationScore}% match · {campaign.successProbability}% success probability
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2">
          {!isApplied ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onApply(campaign)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Apply
            </button>
          ) : null}
          {isActive ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onSubmitDeliverable(campaign)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950"
            >
              <FileUp className="h-4 w-4" />
              Submit
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave(campaign)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Bookmark className="h-4 w-4" />
            {campaign.saved ? "Saved" : "Save"}
          </button>
          {isActive ? (
            <Link
              to={contentHref}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <FileUp className="h-4 w-4" />
              Create Content
            </Link>
          ) : null}
          <button
            type="button"
            disabled={!isActive || busy || !productIds.length}
            onClick={() => onGenerateLink(campaign)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ExternalLink className="h-4 w-4" />
            Links
          </button>
        </div>
        {isWaiting ? (
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
            Waiting for vendor approval.
          </p>
        ) : null}
        {applicationStatus === "approved" ? (
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Approved by vendor.
          </p>
        ) : null}
        {applicationStatus === "rejected" ? (
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
            Rejected by vendor.
          </p>
        ) : null}
      </div>
    </article>
  );
}

function AnalyticsPanel({ analytics, loading }) {
  const totals = analytics?.totals || {};
  const rows = analytics?.rows || [];
  const metrics = [
    ["Campaign Revenue", formatCurrency(totals.revenue || 0)],
    ["Commission Earned", formatCurrency(totals.commission || 0)],
    ["Campaign Orders", totals.orders || 0],
    ["Conversion Rate", `${totals.conversionRate || 0}%`],
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{value}</p>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h3 className="font-semibold text-slate-950 dark:text-white">Campaign performance</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Revenue attribution from existing campaign and commission records.</p>
          </div>
          <BarChart3 className="h-5 w-5 text-slate-400" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Campaign</th>
                <th className="px-4 py-3 text-left">Brand</th>
                <th className="px-4 py-3 text-right">Clicks</th>
                <th className="px-4 py-3 text-right">Orders</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3 text-right">Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={6}>Loading analytics...</td></tr>
              ) : rows.length ? rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-medium text-slate-950 dark:text-white">{row.title}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.brandName}</td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{row.clicks}</td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{row.orders}</td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatCurrency(row.revenue || 0)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-950 dark:text-white">{formatCurrency(row.commission || 0)}</td>
                </tr>
              )) : (
                <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={6}>No campaign attribution yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function InfluencerCampaignsPage() {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "available";
  const [campaigns, setCampaigns] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({ search: "", campaignType: "", sort: "newest" });

  const tab = useMemo(() => TABS.find((item) => item.id === activeTab) ? activeTab : "available", [activeTab]);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (tab === "analytics") {
        const res = await getCampaignMarketplaceAnalytics();
        setAnalytics(res?.data || null);
        return;
      }
      const res = await listCampaignMarketplace({ tab, ...filters, limit: 24 });
      setCampaigns(res?.data?.items || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load campaign marketplace.");
    } finally {
      setLoading(false);
    }
  }, [filters, tab]);

  useEffect(() => {
    const timer = window.setTimeout(loadCampaigns, filters.search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadCampaigns, filters.search]);

  async function handleApply(campaign) {
    setBusyId(campaign.id);
    setError("");
    setMessage("");
    try {
      await applyCampaignMarketplace(campaign.id, {
        profileSummary: "Interested in this campaign and ready to submit required deliverables.",
        expectedEarnings: campaign.budget || 0,
      });
      setMessage("Application submitted. Waiting for vendor approval.");
      await loadCampaigns();
    } catch (err) {
      setError(err?.response?.data?.message || "Application failed.");
    } finally {
      setBusyId("");
    }
  }

  async function handleSave(campaign) {
    setBusyId(campaign.id);
    setMessage("");
    try {
      await saveCampaignMarketplace(campaign.id, !campaign.saved);
      setMessage(campaign.saved ? "Campaign removed from saved list." : "Campaign saved.");
      await loadCampaigns();
    } catch (err) {
      setError(err?.response?.data?.message || "Save failed.");
    } finally {
      setBusyId("");
    }
  }

  async function handleSubmitDeliverable(campaign) {
    setBusyId(campaign.id);
    setMessage("");
    try {
      await submitCampaignDeliverable(campaign.id, {
        title: `${campaign.title} deliverable`,
        type: "video",
        notes: "Deliverable submitted from Campaign Marketplace.",
      });
      setMessage("Deliverable submitted.");
      await loadCampaigns();
    } catch (err) {
      setError(err?.response?.data?.message || "Deliverable submission failed.");
    } finally {
      setBusyId("");
    }
  }

  async function handleGenerateLink(campaign) {
    const productIds = campaignProductIds(campaign);
    if (!productIds.length) return;
    setBusyId(campaign.id);
    setError("");
    setMessage("");
    try {
      const response = await generateAffiliateProductLinks({
        productIds,
        campaignId: campaign.id,
        utmSource: "influencer",
        utmMedium: "campaign",
        utmCampaign: campaign.title || campaign.id,
      });
      const firstLink = response?.data?.links?.[0]?.affiliateUrl;
      if (firstLink && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(firstLink);
        setMessage("Affiliate link generated and copied.");
      } else {
        setMessage("Affiliate link generated.");
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Affiliate link generation failed.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
              <Megaphone className="h-3.5 w-3.5" />
              Campaign Marketplace
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">Discover, apply, execute, and analyze brand campaigns</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              Built on the existing campaign, product, content, wallet, and commission infrastructure.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/influencer/content" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              <FileUp className="h-4 w-4" />
              Submit Content
            </Link>
            <Link to="/influencer/earnings" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950">
              <CheckCircle2 className="h-4 w-4" />
              View Earnings
            </Link>
          </div>
        </div>
      </section>

      {tab !== "analytics" ? (
        <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1fr_220px_180px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search campaigns, brands, categories..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-indigo-950"
            />
          </label>
          <select
            value={filters.campaignType}
            onChange={(event) => setFilters((current) => ({ ...current, campaignType: event.target.value }))}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            {CAMPAIGN_TYPES.map(([value, label]) => <option key={label} value={value}>{label}</option>)}
          </select>
          <select
            value={filters.sort}
            onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="newest">Newest</option>
            <option value="recommended">Recommended</option>
            <option value="highest_budget">Highest Budget</option>
            <option value="highest_commission">Highest Commission</option>
            <option value="ending_soon">Ending Soon</option>
          </select>
        </section>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
          {message}
        </div>
      ) : null}

      {tab === "analytics" ? (
        <AnalyticsPanel analytics={analytics} loading={loading} />
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-[360px] animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800" />
          ))}
        </div>
      ) : campaigns.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onApply={handleApply}
              onSave={handleSave}
              onSubmitDeliverable={handleSubmitDeliverable}
              onGenerateLink={handleGenerateLink}
              busyId={busyId}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
          <ClipboardList className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">No campaigns in this view</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Try another tab or adjust the marketplace filters.</p>
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CalendarClock className="h-5 w-5 text-indigo-500" />
          <h3 className="mt-3 font-semibold text-slate-950 dark:text-white">Workflow</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Applications, deliverables, approvals, and status history stay on existing campaign records.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ExternalLink className="h-5 w-5 text-indigo-500" />
          <h3 className="mt-3 font-semibold text-slate-950 dark:text-white">Promotion</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Products, links, content, and storefront placements reuse the platform commerce modules.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <BarChart3 className="h-5 w-5 text-indigo-500" />
          <h3 className="mt-3 font-semibold text-slate-950 dark:text-white">Attribution</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Revenue and commission totals come from existing campaign analytics and commission records.</p>
        </div>
      </section>
    </div>
  );
}
