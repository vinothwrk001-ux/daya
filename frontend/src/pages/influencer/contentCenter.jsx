import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BarChart3,
  CalendarClock,
  Clapperboard,
  Eye,
  FileVideo,
  Radio,
  Search,
  Upload,
  Video,
} from "lucide-react";
import {
  createInfluencerLiveSession,
  getInfluencerContentAnalytics,
  getInfluencerMediaLibrary,
  listInfluencerContent,
  updateInfluencerContent,
  uploadReel,
} from "../../services/influencerCommerceService";
import { formatCurrency } from "../../utils/formatCurrency";
import { resolveApiAssetUrl } from "../../utils/resolveUrl";

const TABS = [
  ["upload", "Upload Videos", Upload],
  ["products", "Product Videos", Video],
  ["reels", "Shorts/Reels", Clapperboard],
  ["live", "Live Commerce", Radio],
  ["media", "Media Library", FileVideo],
  ["scheduled", "Scheduled Content", CalendarClock],
  ["analytics", "Content Analytics", BarChart3],
  ["reports", "Performance Reports", Eye],
];

function Card({ title, icon: Icon = Video, action, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ContentCard({ item, onAction }) {
  const metrics = item.metrics || {};
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="h-44 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
        {item.thumbnailUrl || item.videoUrl ? <video src={resolveApiAssetUrl(item.videoUrl)} poster={resolveApiAssetUrl(item.thumbnailUrl)} className="h-full w-full object-cover" muted /> : null}
      </div>
      <h3 className="mt-3 line-clamp-2 text-sm font-semibold text-slate-950 dark:text-white">{item.title || item.caption || "Untitled content"}</h3>
      <p className="mt-1 text-xs text-slate-500">{item.contentType} - {item.visibility || item.state}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950"><span className="block text-slate-500">Views</span><b className="dark:text-white">{metrics.views || 0}</b></div>
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950"><span className="block text-slate-500">Clicks</span><b className="dark:text-white">{metrics.clicks || 0}</b></div>
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950"><span className="block text-slate-500">Revenue</span><b className="dark:text-white">{formatCurrency(metrics.revenue || 0)}</b></div>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={() => onAction(item, "publish")} className="flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">Publish</button>
        <button onClick={() => onAction(item, "archive")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:text-white">Archive</button>
      </div>
    </article>
  );
}

const initialForm = {
  title: "",
  description: "",
  caption: "",
  videoUrl: "",
  thumbnailUrl: "",
  contentType: "product_video",
  category: "",
  tags: "",
  language: "en",
  visibility: "draft",
  scheduledAt: "",
  productIds: "",
  campaignId: "",
};

export default function InfluencerContentCenterPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") || "upload");
  const [items, setItems] = useState([]);
  const [media, setMedia] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [filters, setFilters] = useState({ search: "", page: 1, limit: 12 });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const query = useMemo(() => {
    const next = { ...filters };
    if (tab === "products") next.contentType = "product_video";
    if (tab === "reels") next.contentType = "reel";
    if (tab === "scheduled") next.scheduled = "true";
    return next;
  }, [filters, tab]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "analytics" || tab === "reports") {
        const response = await getInfluencerContentAnalytics(query);
        setAnalytics(response?.data || null);
      } else if (tab === "media") {
        const response = await getInfluencerMediaLibrary(query);
        setMedia(response?.data?.items || []);
      } else if (tab !== "upload" && tab !== "live") {
        const response = await listInfluencerContent(query);
        setItems(response?.data?.items || []);
      } else if (tab === "live") {
        const response = await listInfluencerContent({ ...query, contentType: "live" });
        setItems(response?.data?.items || []);
      }
    } finally {
      setLoading(false);
    }
  }, [query, tab]);

  useEffect(() => { load(); }, [load]);

  async function submitContent() {
    setNotice("");
    const payload = {
      ...form,
      productIds: form.productIds.split(",").map((item) => item.trim()).filter(Boolean),
      tags: form.tags.split(",").map((item) => item.trim()).filter(Boolean),
      scheduledAt: form.scheduledAt || undefined,
    };
    try {
      if (form.contentType === "live") await createInfluencerLiveSession(payload);
      else await uploadReel(payload);
      setNotice("Content saved.");
      setForm(initialForm);
      await load();
    } catch (error) {
      setNotice(error?.response?.data?.message || "Content could not be saved.");
    }
  }

  async function handleAction(item, action) {
    await updateInfluencerContent(item._id, { action });
    await load();
  }

  const totals = analytics?.totals || {};

  function selectTab(nextTab) {
    setTab(nextTab);
    setSearchParams(nextTab === "upload" ? {} : { tab: nextTab });
  }

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
      <Card title="Videos & Content" icon={Video}>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map(([id, label, Icon]) => (
            <button key={id} onClick={() => selectTab(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${tab === id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </Card>

      {notice ? <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900 dark:text-white">{notice}</div> : null}

      {tab === "upload" || tab === "live" ? (
        <Card title={tab === "live" ? "Create Live Session" : "Upload Videos"} icon={tab === "live" ? Radio : Upload}>
          <div className="grid gap-4 md:grid-cols-2">
            {["title", "videoUrl", "thumbnailUrl", "category", "language", "campaignId"].map((key) => (
              <label key={key} className="text-sm font-semibold dark:text-white">{key}<input value={form[key]} onChange={(e) => setForm((c) => ({ ...c, [key]: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
            ))}
            <label className="text-sm font-semibold dark:text-white">Content Type<select value={tab === "live" ? "live" : form.contentType} onChange={(e) => setForm((c) => ({ ...c, contentType: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="product_video">Product Video</option><option value="review">Review</option><option value="tutorial">Tutorial</option><option value="unboxing">Unboxing</option><option value="lifestyle">Lifestyle</option><option value="campaign">Campaign Content</option><option value="affiliate">Affiliate Content</option><option value="brand_collaboration">Brand Collaboration</option><option value="reel">Reel</option><option value="short">Short</option><option value="live">Live</option></select></label>
            <label className="text-sm font-semibold dark:text-white">Publishing<select value={form.visibility} onChange={(e) => setForm((c) => ({ ...c, visibility: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="draft">Draft</option><option value="published">Publish Now</option><option value="scheduled">Schedule</option><option value="private">Private</option><option value="unlisted">Unlisted</option></select></label>
            <label className="text-sm font-semibold dark:text-white">Schedule Date<input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm((c) => ({ ...c, scheduledAt: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
            <label className="text-sm font-semibold dark:text-white">Product IDs<input value={form.productIds} onChange={(e) => setForm((c) => ({ ...c, productIds: e.target.value }))} placeholder="comma separated" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
            <label className="text-sm font-semibold dark:text-white">Tags<input value={form.tags} onChange={(e) => setForm((c) => ({ ...c, tags: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
            <label className="md:col-span-2 text-sm font-semibold dark:text-white">Description<textarea value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
          </div>
          <button onClick={submitContent} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">{tab === "live" ? "Save Live Session" : "Upload / Save Content"}</button>
        </Card>
      ) : tab === "analytics" || tab === "reports" ? (
        <Card title={tab === "reports" ? "Performance Reports" : "Content Analytics"} icon={BarChart3}>
          <div className="grid gap-3 md:grid-cols-6">
            {[
              ["Views", totals.views || 0],
              ["Watch Time", `${Math.round((totals.watchTimeSeconds || 0) / 60)}m`],
              ["Revenue", formatCurrency(totals.revenue || 0)],
              ["Commission", formatCurrency(totals.commission || 0)],
              ["Orders", totals.orders || 0],
              ["Engagement", `${totals.engagementRate || 0}%`],
            ].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold dark:text-white">{value}</p></div>)}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {(analytics?.topVideos || []).map((item) => <ContentCard key={item._id} item={item} onAction={handleAction} />)}
          </div>
        </Card>
      ) : tab === "media" ? (
        <Card title="Media Library" icon={FileVideo}>
          <div className="grid gap-3 md:grid-cols-4">
            {media.map((asset) => <div key={asset.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800"><div className="h-32 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">{asset.preview ? <video src={resolveApiAssetUrl(asset.url)} poster={resolveApiAssetUrl(asset.preview)} className="h-full w-full object-cover" muted /> : null}</div><p className="mt-2 truncate text-sm font-semibold dark:text-white">{asset.name}</p><p className="text-xs text-slate-500">{asset.type}</p></div>)}
          </div>
        </Card>
      ) : (
        <>
          <Card title="Filters" icon={Search}>
            <input value={filters.search} onChange={(e) => setFilters((c) => ({ ...c, search: e.target.value }))} placeholder="Search videos, products, tags" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          </Card>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {loading ? <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 dark:text-white">Loading content...</div> : items.map((item) => <ContentCard key={item._id} item={item} onAction={handleAction} />)}
          </section>
        </>
      )}
    </div>
  );
}
