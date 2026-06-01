import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Archive,
  BarChart3,
  Boxes,
  CalendarClock,
  Check,
  Eye,
  Image,
  LayoutGrid,
  Megaphone,
  PackagePlus,
  Plus,
  Search,
  Settings2,
  Star,
  Trash2,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  assignInfluencerCollectionProducts,
  getInfluencerCollectionAnalytics,
  listInfluencerCollectionProducts,
  listInfluencerCollections,
  saveInfluencerCollection,
  updateInfluencerCollectionStatus,
} from "../../services/influencerCommerceService";
import { formatCurrency } from "../../utils/formatCurrency";

const TYPE_OPTIONS = [
  ["custom", "Custom"],
  ["featured", "Featured"],
  ["seasonal", "Seasonal"],
  ["campaign", "Campaign"],
  ["affiliate", "Affiliate"],
  ["trending_products", "Trending"],
  ["bundle", "Bundle"],
  ["brand", "Brand"],
];

const TABS = [
  ["create", "Create Collection", Plus],
  ["featured", "Featured Collections", Star],
  ["seasonal", "Seasonal Collections", CalendarClock],
  ["assignment", "Product Assignment", PackagePlus],
  ["analytics", "Collection Analytics", BarChart3],
  ["visibility", "Collection Visibility", Eye],
];

function EmptyState({ title }) {
  return (
    <div className="flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
      {title}
    </div>
  );
}

function Panel({ title, icon: Icon = Boxes, action, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {createElement(Icon, { className: "h-4 w-4 text-indigo-500" })}
          <h2 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function CollectionCard({ collection, selected, onSelect, onStatus }) {
  const analytics = collection.analyticsSummary || {};
  return (
    <button
      type="button"
      onClick={() => onSelect(collection)}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        selected ? "border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950/30" : "border-slate-200 bg-white hover:border-indigo-200 dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
          {collection.media?.coverImage ? <img src={collection.media.coverImage} alt="" className="h-full w-full object-cover" /> : <Image className="h-5 w-5 text-slate-400" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{collection.title}</p>
            {collection.featured ? <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">{collection.type} - {collection.productsCount || 0} products - {collection.status}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950"><span className="block text-slate-500">Views</span><b className="text-slate-950 dark:text-white">{analytics.views || 0}</b></div>
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950"><span className="block text-slate-500">Clicks</span><b className="text-slate-950 dark:text-white">{analytics.clicks || 0}</b></div>
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950"><span className="block text-slate-500">Revenue</span><b className="text-slate-950 dark:text-white">{formatCurrency(analytics.revenue || 0)}</b></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{collection.visibility?.audience || "public"}</span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onStatus(collection._id, { featured: !collection.featured });
          }}
          className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
        >
          {collection.featured ? "Unfeature" : "Feature"}
        </button>
      </div>
    </button>
  );
}

const initialForm = {
  title: "",
  slug: "",
  description: "",
  type: "custom",
  status: "draft",
  tags: "",
  coverImage: "",
  bannerImage: "",
  layout: "grid",
  featured: false,
  season: "",
  metaTitle: "",
  metaDescription: "",
  audience: "public",
  locations: ["storefront_homepage"],
  startDate: "",
  endDate: "",
};

function buildPayload(form, productIds = []) {
  return {
    title: form.title,
    slug: form.slug,
    description: form.description,
    type: form.type,
    status: form.status,
    tags: form.tags.split(",").map((item) => item.trim()).filter(Boolean),
    productIds,
    featured: form.featured,
    coverImage: form.coverImage,
    bannerImage: form.bannerImage,
    layout: form.layout,
    seo: {
      metaTitle: form.metaTitle,
      metaDescription: form.metaDescription,
      keywords: form.tags.split(",").map((item) => item.trim()).filter(Boolean),
      openGraphImage: form.coverImage,
    },
    visibility: {
      audience: form.audience,
      locations: form.locations,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    },
    seasonal: {
      season: form.season,
      autoPublish: Boolean(form.startDate),
      autoExpire: Boolean(form.endDate),
    },
  };
}

export default function InfluencerCollectionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") || "create");
  const [collections, setCollections] = useState([]);
  const [selected, setSelected] = useState(null);
  const [products, setProducts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [filters, setFilters] = useState({ search: "", status: "", type: "", page: 1, limit: 12 });
  const [productFilters, setProductFilters] = useState({ search: "", category: "", page: 1, limit: 12 });
  const [form, setForm] = useState(initialForm);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadCollections = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listInfluencerCollections(filters);
      const items = response?.data?.items || [];
      setCollections(items);
      if (!selected && items.length) {
        setSelected(items[0]);
        setSelectedProducts((items[0].productIds || []).map((product) => String(product._id || product)));
      }
    } finally {
      setLoading(false);
    }
  }, [filters, selected]);

  const loadProducts = useCallback(async () => {
    const response = await listInfluencerCollectionProducts({ ...productFilters, collectionId: selected?._id || "" });
    setProducts(response?.data?.items || []);
  }, [productFilters, selected?._id]);

  const loadAnalytics = useCallback(async () => {
    const response = await getInfluencerCollectionAnalytics(selected?._id ? { collectionId: selected._id } : {});
    setAnalytics(response?.data || null);
  }, [selected?._id]);

  useEffect(() => { loadCollections(); }, [loadCollections]);
  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);
  useEffect(() => {
    setTab(searchParams.get("tab") || "create");
  }, [searchParams]);

  useEffect(() => {
    if (!selected) return;
    setForm({
      ...initialForm,
      title: selected.title || "",
      slug: selected.slug || "",
      description: selected.description || "",
      type: selected.type || "custom",
      status: selected.status || "draft",
      tags: (selected.tags || []).join(", "),
      coverImage: selected.media?.coverImage || "",
      bannerImage: selected.media?.bannerImage || "",
      layout: selected.display?.layout || "grid",
      featured: Boolean(selected.featured),
      season: selected.seasonal?.season || "",
      metaTitle: selected.seo?.metaTitle || "",
      metaDescription: selected.seo?.metaDescription || "",
      audience: selected.visibility?.audience || "public",
      locations: selected.visibility?.locations || ["storefront_homepage"],
      startDate: selected.visibility?.startDate ? selected.visibility.startDate.slice(0, 10) : "",
      endDate: selected.visibility?.endDate ? selected.visibility.endDate.slice(0, 10) : "",
    });
    setSelectedProducts((selected.productIds || []).map((product) => String(product._id || product)));
  }, [selected]);

  async function handleSave(status = form.status) {
    setSaving(true);
    setMessage("");
    try {
      const payload = buildPayload({ ...form, status }, selectedProducts);
      const response = await saveInfluencerCollection(payload, selected?._id || "");
      setSelected(response?.data || null);
      setMessage("Collection saved.");
      await loadCollections();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Collection could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(id, payload) {
    await updateInfluencerCollectionStatus(id, payload);
    await loadCollections();
  }

  async function syncProducts(mode = "replace") {
    if (!selected?._id) return;
    const response = await assignInfluencerCollectionProducts(selected._id, { mode, productIds: selectedProducts });
    setSelected(response?.data || selected);
    await loadCollections();
  }

  const visibleCollections = useMemo(() => {
    if (tab === "featured") return collections.filter((item) => item.featured || item.type === "featured");
    if (tab === "seasonal") return collections.filter((item) => item.type === "seasonal");
    return collections;
  }, [collections, tab]);

  const totals = analytics?.totals || {};

  function selectTab(id) {
    setTab(id);
    setSearchParams({ tab: id });
  }

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
      {message ? <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">{message}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
        <Panel
          title={tab === "featured" ? "Featured Collections" : tab === "seasonal" ? "Seasonal Collections" : "Collections"}
          icon={LayoutGrid}
          action={
            <button type="button" onClick={() => { setSelected(null); setForm(initialForm); setSelectedProducts([]); selectTab("create"); }} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">
              <Plus className="h-4 w-4" />
              New
            </button>
          }
        >
          <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
              <Search className="h-4 w-4 text-slate-400" />
              <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search collections" className="min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-white" />
            </div>
            <select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
              <option value="">All types</option>
              {TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            {loading ? <EmptyState title="Loading collections..." /> : visibleCollections.length ? visibleCollections.map((collection) => (
              <CollectionCard key={collection._id} collection={collection} selected={selected?._id === collection._id} onSelect={setSelected} onStatus={handleStatus} />
            )) : <EmptyState title="No collections found" />}
          </div>
        </Panel>

        <div className="space-y-5">
          {tab === "analytics" ? (
            <Panel title="Collection Analytics" icon={BarChart3}>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ["Views", totals.views || 0],
                  ["Clicks", totals.clicks || 0],
                  ["Orders", totals.orders || 0],
                  ["Commission", formatCurrency(totals.commission || 0)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 h-72 rounded-2xl border border-slate-100 p-3 dark:border-slate-800">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics?.trend || []}>
                    <defs><linearGradient id="collectionViews" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4f46e5" stopOpacity={0.3} /><stop offset="100%" stopColor="#4f46e5" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <Tooltip />
                    <Area type="monotone" dataKey="views" stroke="#4f46e5" fill="url(#collectionViews)" />
                    <Area type="monotone" dataKey="clicks" stroke="#06b6d4" fillOpacity={0} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          ) : null}

          {tab !== "analytics" ? (
            <Panel title={selected ? "Collection Detail" : "Create Collection"} icon={Settings2}>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Collection Name<input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Slug<input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Type<select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white">{TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Status<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="draft">Draft</option><option value="active">Published</option><option value="scheduled">Scheduled</option><option value="archived">Archived</option></select></label>
                <label className="lg:col-span-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Description<textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cover Image URL<input value={form.coverImage} onChange={(event) => setForm((current) => ({ ...current, coverImage: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Banner Image URL<input value={form.bannerImage} onChange={(event) => setForm((current) => ({ ...current, bannerImage: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Layout<select value={form.layout} onChange={(event) => setForm((current) => ({ ...current, layout: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="grid">Grid</option><option value="list">List</option><option value="carousel">Carousel</option><option value="masonry">Masonry</option></select></label>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tags<input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="gift, summer, tech" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">SEO Title<input value={form.metaTitle} onChange={(event) => setForm((current) => ({ ...current, metaTitle: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">SEO Description<input value={form.metaDescription} onChange={(event) => setForm((current) => ({ ...current, metaDescription: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                {tab === "seasonal" ? <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Season<input value={form.season} onChange={(event) => setForm((current) => ({ ...current, season: event.target.value }))} placeholder="Black Friday" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label> : null}
                {tab === "visibility" ? (
                  <>
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Audience<select value={form.audience} onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="public">Public</option><option value="private">Private</option><option value="followers_only">Followers Only</option><option value="subscribers_only">Subscribers Only</option><option value="campaign_members_only">Campaign Members Only</option><option value="scheduled">Scheduled</option></select></label>
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Start Date<input type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">End Date<input type="date" value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                  </>
                ) : null}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button disabled={saving} onClick={() => handleSave("draft")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-700 dark:text-white"><Check className="h-4 w-4" />Save Draft</button>
                <button disabled={saving} onClick={() => handleSave("active")} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"><Megaphone className="h-4 w-4" />Publish</button>
                {selected ? <button onClick={() => handleStatus(selected._id, { status: "archived" })} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-white"><Archive className="h-4 w-4" />Archive</button> : null}
                {selected ? <button onClick={() => { setSelected(null); setForm((current) => ({ ...current, title: `${current.title} Copy`, slug: "" })); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-white">Duplicate</button> : null}
                {selected ? <button onClick={() => handleStatus(selected._id, { status: "archived" })} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 dark:border-rose-900"><Trash2 className="h-4 w-4" />Delete</button> : null}
              </div>
            </Panel>
          ) : null}

          {tab === "assignment" ? (
            <Panel title="Product Assignment" icon={PackagePlus} action={<button onClick={() => syncProducts("replace")} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">Sync Products</button>}>
              <div className="mb-4 grid gap-2 md:grid-cols-2">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input value={productFilters.search} onChange={(event) => setProductFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search products" className="min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-white" />
                </div>
                <input value={productFilters.category} onChange={(event) => setProductFilters((current) => ({ ...current, category: event.target.value }))} placeholder="Category" className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {products.map((product) => {
                  const checked = selectedProducts.includes(product.id);
                  return (
                    <button key={product.id} type="button" onClick={() => setSelectedProducts((current) => checked ? current.filter((id) => id !== product.id) : [...current, product.id])} className={`flex items-center gap-3 rounded-2xl border p-3 text-left ${checked ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30" : "border-slate-200 dark:border-slate-800"}`}>
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">{product.image ? <img src={product.image} alt="" className="h-full w-full object-cover" /> : <Boxes className="h-5 w-5 text-slate-400" />}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{product.name}</p>
                        <p className="text-xs text-slate-500">{product.category} - {formatCurrency(product.price)}</p>
                      </div>
                      {checked ? <Check className="h-5 w-5 text-indigo-600" /> : null}
                    </button>
                  );
                })}
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
