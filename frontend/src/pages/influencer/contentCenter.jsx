import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BarChart3,
  FileVideo,
  Radio,
  Search,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import {
  createInfluencerLiveSession,
  deleteInfluencerContent,
  getInfluencerContentAnalytics,
  getInfluencerMediaLibrary,
  listInfluencerContent,
  updateInfluencerContent,
  uploadInfluencerContentMedia,
  uploadReel,
} from "../../services/influencerCommerceService";
import { formatCurrency } from "../../utils/formatCurrency";
import { resolveApiAssetUrl } from "../../utils/resolveUrl";

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

function ContentCard({ item, onAction, busy = false }) {
  const metrics = item.metrics || {};
  const status = item.visibility || item.state || "draft";
  const videoSrc = resolveApiAssetUrl(item.videoUrl);
  const posterSrc = resolveApiAssetUrl(item.thumbnailUrl);
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="h-44 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
        {item.videoUrl ? (
          <video
            key={videoSrc}
            poster={posterSrc}
            className="h-full w-full object-cover"
            controls
            playsInline
            preload="auto"
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        ) : null}
      </div>
      <h3 className="mt-3 line-clamp-2 text-sm font-semibold text-slate-950 dark:text-white">{item.title || item.caption || "Untitled content"}</h3>
      <p className="mt-1 text-xs text-slate-500">{item.contentType} - {status}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950"><span className="block text-slate-500">Views</span><b className="dark:text-white">{metrics.views || 0}</b></div>
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950"><span className="block text-slate-500">Clicks</span><b className="dark:text-white">{metrics.clicks || 0}</b></div>
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950"><span className="block text-slate-500">Revenue</span><b className="dark:text-white">{formatCurrency(metrics.revenue || 0)}</b></div>
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || status === "published"} onClick={() => onAction(item, "publish")} className="flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">Publish</button>
        <button disabled={busy || status === "archived"} onClick={() => onAction(item, "archive")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-white">Archive</button>
        <button disabled={busy} onClick={() => onAction(item, "delete")} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-300" aria-label="Delete content">
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
    </article>
  );
}

function MediaAssetCard({ asset, onDelete, busy = false }) {
  const mediaUrl = resolveApiAssetUrl(asset.url);
  const previewUrl = resolveApiAssetUrl(asset.preview);
  return (
    <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
      <div className="h-32 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
        {asset.url ? (
          <video key={mediaUrl} poster={previewUrl} className="h-full w-full object-cover" controls playsInline preload="auto">
            <source src={mediaUrl} type="video/mp4" />
          </video>
        ) : null}
      </div>
      <p className="mt-2 truncate text-sm font-semibold dark:text-white">{asset.name}</p>
      <p className="text-xs text-slate-500">{asset.type}</p>
      <button disabled={busy} onClick={() => onDelete(asset)} className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-300">
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </button>
    </div>
  );
}

function EmptyState({ label = "No content found." }) {
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
      {label}
    </div>
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
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") || "upload");
  const [items, setItems] = useState([]);
  const [media, setMedia] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [filters, setFilters] = useState({ search: "", page: 1, limit: 12 });
  const [loading, setLoading] = useState(true);
  const [uploadingField, setUploadingField] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

  const query = useMemo(() => {
    const next = { ...filters };
    if (tab === "products") next.contentType = "product_video";
    if (tab === "reels") next.contentTypes = "reel,short";
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
      } else if (tab === "upload") {
        const response = await listInfluencerContent(query);
        setItems(response?.data?.items || []);
      } else if (tab !== "live") {
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

  useEffect(() => {
    setTab(searchParams.get("tab") || "upload");
  }, [searchParams]);

  useEffect(() => {
    const campaignId = searchParams.get("campaignId") || "";
    const productIds = searchParams.get("productIds") || "";
    if (!campaignId && !productIds) return;
    setForm((current) => ({
      ...current,
      campaignId: campaignId || current.campaignId,
      productIds: productIds || current.productIds,
      contentType: current.contentType === "live" ? "product_video" : current.contentType,
    }));
  }, [searchParams]);

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
      if (tab === "live" || form.contentType === "live") await createInfluencerLiveSession({ ...payload, contentType: "live" });
      else await uploadReel(payload);
      setNotice("Content saved.");
      setForm((current) => ({
        ...initialForm,
        campaignId: searchParams.get("campaignId") || current.campaignId,
        productIds: searchParams.get("productIds") || current.productIds,
      }));
      await load();
    } catch (error) {
      setNotice(error?.response?.data?.message || "Content could not be saved.");
    }
  }

  async function uploadMediaFile(field, file) {
    if (!file) return;
    setUploadingField(field);
    setNotice("");
    try {
      const formData = new FormData();
      formData.append(field === "thumbnailUrl" ? "thumbnail" : "video", file);
      const response = await uploadInfluencerContentMedia(formData);
      const url = response?.data?.[field];
      if (url) {
        setForm((current) => ({ ...current, [field]: url }));
        setNotice(field === "thumbnailUrl" ? "Thumbnail uploaded." : "Video uploaded.");
      } else {
        setNotice("Upload completed, but no media URL was returned.");
      }
    } catch (error) {
      setNotice(error?.response?.data?.message || "Media upload failed.");
    } finally {
      setUploadingField("");
    }
  }

  async function handleAction(item, action) {
    const id = item._id || item.id;
    if (!id) return;
    if (action === "delete" && !window.confirm("Delete this video or live session?")) return;
    setBusyId(String(id));
    setNotice("");
    try {
      if (action === "delete") {
        await deleteInfluencerContent(id);
        setNotice("Content deleted.");
      } else {
        await updateInfluencerContent(id, { action });
        setNotice(action === "publish" ? "Content published." : "Content archived.");
      }
      await load();
    } catch (error) {
      setNotice(error?.response?.data?.message || "Action failed.");
    } finally {
      setBusyId("");
    }
  }

  const totals = analytics?.totals || {};

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
      {notice ? <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900 dark:text-white">{notice}</div> : null}

      {tab === "upload" || tab === "live" ? (
        <Card title={tab === "live" ? "Create Live Session" : "Upload Videos"} icon={tab === "live" ? Radio : Upload}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold dark:text-white">title<input value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
            <label className="text-sm font-semibold dark:text-white">
              videoUrl
              <div className="mt-1 flex gap-2">
                <input value={form.videoUrl} onChange={(e) => setForm((c) => ({ ...c, videoUrl: e.target.value }))} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
                  {uploadingField === "videoUrl" ? "Uploading" : "Upload"}
                  <input type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only" disabled={uploadingField === "videoUrl"} onChange={(event) => { uploadMediaFile("videoUrl", event.target.files?.[0]); event.target.value = ""; }} />
                </label>
              </div>
            </label>
            <label className="text-sm font-semibold dark:text-white">
              thumbnailUrl
              <div className="mt-1 flex gap-2">
                <input value={form.thumbnailUrl} onChange={(e) => setForm((c) => ({ ...c, thumbnailUrl: e.target.value }))} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
                  {uploadingField === "thumbnailUrl" ? "Uploading" : "Upload"}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={uploadingField === "thumbnailUrl"} onChange={(event) => { uploadMediaFile("thumbnailUrl", event.target.files?.[0]); event.target.value = ""; }} />
                </label>
              </div>
            </label>
            {["category", "language", "campaignId"].map((key) => (
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
          {tab === "upload" ? (
            <div className="mt-6">
              <div className="mb-3 flex items-center gap-2">
                <Video className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Uploaded Videos</h3>
              </div>
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {loading ? <EmptyState label="Loading uploaded videos..." /> : items.length ? items.map((item) => <ContentCard key={item._id} item={item} onAction={handleAction} busy={busyId === String(item._id)} />) : <EmptyState label="No uploaded videos yet." />}
              </section>
            </div>
          ) : null}
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
            {(analytics?.topVideos || []).length ? (analytics?.topVideos || []).map((item) => <ContentCard key={item._id} item={item} onAction={handleAction} busy={busyId === String(item._id)} />) : <EmptyState label="No performance data yet." />}
          </div>
        </Card>
      ) : tab === "media" ? (
        <Card title="Media Library" icon={FileVideo}>
          <div className="grid gap-3 md:grid-cols-4">
            {media.length ? media.map((asset) => <MediaAssetCard key={asset.id} asset={asset} onDelete={(row) => handleAction(row, "delete")} busy={busyId === String(asset.id)} />) : <EmptyState label="No media assets found." />}
          </div>
        </Card>
      ) : (
        <>
          <Card title="Filters" icon={Search}>
            <input value={filters.search} onChange={(e) => setFilters((c) => ({ ...c, search: e.target.value }))} placeholder="Search videos, products, tags" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          </Card>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {loading ? <EmptyState label="Loading content..." /> : items.length ? items.map((item) => <ContentCard key={item._id} item={item} onAction={handleAction} busy={busyId === String(item._id)} />) : <EmptyState label={tab === "scheduled" ? "No scheduled content found." : "No content found."} />}
          </section>
        </>
      )}
    </div>
  );
}
