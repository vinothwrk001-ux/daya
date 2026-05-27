import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BarChart3,
  Copy,
  ExternalLink,
  Heart,
  Link as LinkIcon,
  Package,
  Plus,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  generateAffiliateProductLinks,
  getAffiliateProductAnalytics,
  listAffiliateProducts,
  listRecommendedAffiliateProducts,
  listSavedAffiliateProducts,
  saveAffiliateProduct,
} from "../../services/influencerCommerceService";
import { formatCurrency } from "../../utils/formatCurrency";
import { resolveApiAssetUrl } from "../../utils/resolveUrl";

const TABS = [
  ["browse", "Browse Products", Package],
  ["recommended", "Recommended Products", Sparkles],
  ["trending", "Trending Products", TrendingUp],
  ["highest_commission", "Highest Commission", Zap],
  ["new", "New Arrivals", Plus],
  ["saved", "Saved Products", Heart],
  ["links", "Generate Affiliate Link", LinkIcon],
  ["analytics", "Product Analytics", BarChart3],
];

function Card({ title, icon: Icon = Package, action, children }) {
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

function ProductCard({ product, onSave, onLink, onSelect }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="h-44 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
        {product.image ? <img src={resolveApiAssetUrl(product.image)} alt="" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="mt-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold text-slate-950 dark:text-white">{product.name}</h3>
          <button onClick={() => onSave(product)} className={`rounded-lg p-1.5 ${product.saved ? "text-rose-500" : "text-slate-400 hover:text-rose-500"}`} aria-label="Save product">
            <Heart className={`h-4 w-4 ${product.saved ? "fill-current" : ""}`} />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">{product.vendor || product.brand || "Vendor"} - {product.category}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950"><span className="block text-slate-500">Price</span><b className="text-slate-950 dark:text-white">{formatCurrency(product.salePrice)}</b></div>
          <div className="rounded-xl bg-emerald-50 p-2 dark:bg-emerald-950/30"><span className="block text-emerald-700 dark:text-emerald-300">Commission</span><b className="text-emerald-700 dark:text-emerald-300">{formatCurrency(product.commissionAmount)}</b></div>
          <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950"><span className="block text-slate-500">Rate</span><b className="text-slate-950 dark:text-white">{product.commissionRate}%</b></div>
          <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950"><span className="block text-slate-500">Rating</span><b className="text-slate-950 dark:text-white">{product.rating || 0}</b></div>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={() => onLink(product)} className="flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">Generate Link</button>
          <button onClick={() => onSelect(product)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-white"><ExternalLink className="h-4 w-4" /></button>
        </div>
      </div>
    </article>
  );
}

export default function InfluencerAffiliateProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") || "browse");
  const [filters, setFilters] = useState({ search: "", category: "", availability: "all", sort: "best_selling", page: 1, limit: 12 });
  const [products, setProducts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [selected, setSelected] = useState(null);
  const [links, setLinks] = useState([]);
  const [utm, setUtm] = useState({ utmSource: "influencer", utmMedium: "social", utmCampaign: "", utmContent: "", utmTerm: "" });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const query = useMemo(() => ({ ...filters, mode: tab }), [filters, tab]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "analytics") {
        const response = await getAffiliateProductAnalytics({});
        setAnalytics(response?.data || null);
      } else if (tab === "saved") {
        const response = await listSavedAffiliateProducts(query);
        setProducts(response?.data?.items || []);
      } else if (tab === "recommended") {
        const response = await listRecommendedAffiliateProducts(query);
        setProducts(response?.data?.items || []);
      } else if (tab !== "links") {
        const response = await listAffiliateProducts(query);
        setProducts(response?.data?.items || []);
      }
    } finally {
      setLoading(false);
    }
  }, [query, tab]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setTab(searchParams.get("tab") || "browse");
  }, [searchParams]);

  async function toggleSave(product) {
    await saveAffiliateProduct(product.id, !product.saved);
    setProducts((rows) => rows.map((row) => row.id === product.id ? { ...row, saved: !product.saved } : row));
  }

  async function generate(product = selected) {
    if (!product) return;
    const response = await generateAffiliateProductLinks({ productIds: [product.id], ...utm });
    setLinks(response?.data?.links || []);
    setSelected(product);
    selectTab("links");
    setMessage("Affiliate link generated.");
  }

  const totals = analytics?.totals || {};

  function selectTab(nextTab) {
    setTab(nextTab);
    setSearchParams(nextTab === "browse" ? {} : { tab: nextTab });
  }

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
      {message ? <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">{message}</div> : null}

      {tab !== "links" && tab !== "analytics" ? (
        <Card title="Filters" icon={Search}>
          <div className="grid gap-3 md:grid-cols-4">
            <input value={filters.search} onChange={(e) => setFilters((c) => ({ ...c, search: e.target.value, page: 1 }))} placeholder="Search product, SKU, category" className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            <input value={filters.category} onChange={(e) => setFilters((c) => ({ ...c, category: e.target.value, page: 1 }))} placeholder="Category" className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            <select value={filters.availability} onChange={(e) => setFilters((c) => ({ ...c, availability: e.target.value, page: 1 }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="all">All availability</option><option value="in_stock">In stock</option></select>
            <select value={filters.sort} onChange={(e) => setFilters((c) => ({ ...c, sort: e.target.value, page: 1 }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="best_selling">Best selling</option><option value="trending">Trending</option><option value="highest_rated">Highest rated</option><option value="highest_commission">Highest commission</option><option value="newest">Newest</option><option value="most_viewed">Most viewed</option></select>
          </div>
        </Card>
      ) : null}

      {tab === "analytics" ? (
        <Card title="Product Analytics" icon={BarChart3}>
          <div className="grid gap-3 md:grid-cols-5">
            {[
              ["Clicks", totals.clicks || 0],
              ["Orders", totals.orders || 0],
              ["Revenue", formatCurrency(totals.revenue || 0)],
              ["Commission", formatCurrency(totals.commission || 0)],
              ["EPC", formatCurrency(totals.epc || 0)],
            ].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">{value}</p></div>)}
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[720px] w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr>{["Product", "Category", "Orders", "Revenue", "Commission", "Conversion", "EPC"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>{(analytics?.productPerformance || []).map((row) => <tr key={row.productId} className="border-t border-slate-100 dark:border-slate-800"><td className="px-3 py-3 font-semibold dark:text-white">{row.name}</td><td className="px-3 py-3">{row.category}</td><td className="px-3 py-3">{row.orders}</td><td className="px-3 py-3">{formatCurrency(row.revenue)}</td><td className="px-3 py-3">{formatCurrency(row.commission)}</td><td className="px-3 py-3">{row.conversionRate}%</td><td className="px-3 py-3">{formatCurrency(row.epc)}</td></tr>)}</tbody>
            </table>
          </div>
        </Card>
      ) : tab === "links" ? (
        <Card title="Generate Affiliate Link" icon={LinkIcon}>
          <div className="grid gap-4 md:grid-cols-2">
            {["utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm"].map((key) => <label key={key} className="text-sm font-semibold dark:text-white">{key}<input value={utm[key]} onChange={(e) => setUtm((c) => ({ ...c, [key]: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>)}
          </div>
          {selected ? <button onClick={() => generate(selected)} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Generate for {selected.name}</button> : <p className="mt-4 text-sm text-slate-500">Choose a product from another tab to generate a link.</p>}
          <div className="mt-4 space-y-3">
            {links.map((link) => <div key={link.productId} className="rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-950 dark:text-white"><div className="break-all">{link.affiliateUrl}</div><button onClick={() => navigator.clipboard?.writeText(link.affiliateUrl)} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-slate-700"><Copy className="h-3.5 w-3.5" />Copy</button></div>)}
          </div>
        </Card>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading ? <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 dark:text-white">Loading products...</div> : products.map((product) => <ProductCard key={product.id} product={product} onSave={toggleSave} onLink={generate} onSelect={setSelected} />)}
          {!loading && !products.length ? <div className="col-span-full rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-800">No products found.</div> : null}
        </section>
      )}
    </div>
  );
}
