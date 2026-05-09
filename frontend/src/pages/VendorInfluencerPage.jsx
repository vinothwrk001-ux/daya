import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { CampaignPanel } from "../components/campaign/CampaignPanel";
import { usePlatformFeatures } from "../context/PlatformFeaturesContext";
import { createCampaign, getVendorCampaigns, listInfluencers } from "../services/influencerCommerceService";
import * as vendorDashboardService from "../services/vendorDashboardService";

export function VendorInfluencerPage() {
  const { influencerCommerceEnabled, loading: commerceLoading } = usePlatformFeatures();

  const [campaigns, setCampaigns] = useState([]);
  const [influencers, setInfluencers] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [form, setForm] = useState({ influencerId: "", productIds: [], commissionPercent: 10, fixedFee: 0, deadline: "" });

  async function load() {
    const [campaignResponse, influencerResponse, productResponse] = await Promise.all([
      getVendorCampaigns(),
      listInfluencers(),
      vendorDashboardService.getVendorProducts(),
    ]);
    setCampaigns(campaignResponse?.data || []);
    setInfluencers(influencerResponse?.data || []);
    setProducts(productResponse?.data?.products || productResponse?.data || []);
  }

  useEffect(() => {
    if (!commerceLoading && !influencerCommerceEnabled) return;
    load().catch(() => {});
  }, [commerceLoading, influencerCommerceEnabled]);

  const categoryOptions = useMemo(
    () => Array.from(new Set(influencers.flatMap((influencer) => influencer.categories || []))).sort(),
    [influencers]
  );

  const visibleInfluencers = useMemo(
    () =>
      selectedCategory
        ? influencers.filter((influencer) => (influencer.categories || []).includes(selectedCategory))
        : influencers,
    [influencers, selectedCategory]
  );

  if (!commerceLoading && !influencerCommerceEnabled) {
    return <Navigate to="/vendor/dashboard" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await createCampaign(form);
    setForm({ influencerId: "", productIds: [], commissionPercent: 10, fixedFee: 0, deadline: "" });
    await load();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
      <form onSubmit={handleSubmit} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold text-slate-950 dark:text-white">Create campaign</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Commission and fee terms are frozen at activation, so this is the contract record that settlement relies on.</p>
        <div className="mt-4 grid gap-4">
          <select className="rounded-xl border px-3 py-2 text-sm" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
            <option value="">All influencer categories</option>
            {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select className="rounded-xl border px-3 py-2" value={form.influencerId} onChange={(e) => setForm((current) => ({ ...current, influencerId: e.target.value }))} required>
            <option value="">Select influencer</option>
            {visibleInfluencers.map((influencer) => <option key={influencer._id} value={influencer._id}>{influencer.userId?.name} · {influencer.followers || 0} followers</option>)}
          </select>
          <select multiple className="min-h-40 rounded-xl border px-3 py-2" value={form.productIds} onChange={(e) => setForm((current) => ({ ...current, productIds: Array.from(e.target.selectedOptions).map((option) => option.value) }))}>
            {products.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}
          </select>
          <input className="rounded-xl border px-3 py-2" type="number" min="0" max="50" value={form.commissionPercent} onChange={(e) => setForm((current) => ({ ...current, commissionPercent: Number(e.target.value || 0) }))} placeholder="Commission %" />
          <input className="rounded-xl border px-3 py-2" type="number" min="0" value={form.fixedFee} onChange={(e) => setForm((current) => ({ ...current, fixedFee: Number(e.target.value || 0) }))} placeholder="Fixed fee" />
          <input className="rounded-xl border px-3 py-2" type="date" value={form.deadline} onChange={(e) => setForm((current) => ({ ...current, deadline: e.target.value }))} />
          <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-950" type="submit">Send campaign</button>
        </div>
      </form>

      <div className="grid gap-5">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Browse influencers</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Use category fit and observed performance before sending campaign proposals.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {visibleInfluencers.slice(0, 6).map((influencer) => (
              <article key={influencer._id} className="rounded-[1.5rem] border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950 dark:text-white">{influencer.userId?.name}</div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{influencer.followers || 0} followers</div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase dark:bg-slate-800">{influencer.state}</span>
                </div>
                <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">{(influencer.categories || []).join(", ") || "No categories selected"}</div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-950">
                    <div className="text-slate-400">Views</div>
                    <div className="mt-1 font-semibold text-slate-950 dark:text-white">{influencer.stats?.views || 0}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-950">
                    <div className="text-slate-400">Clicks</div>
                    <div className="mt-1 font-semibold text-slate-950 dark:text-white">{influencer.stats?.clicks || 0}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-950">
                    <div className="text-slate-400">Sales</div>
                    <div className="mt-1 font-semibold text-slate-950 dark:text-white">{influencer.stats?.sales || 0}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <CampaignPanel title="Campaign management" subtitle="Track proposed, active, and completed influencer campaigns from one workspace." campaigns={campaigns} />
      </div>
    </div>
  );
}
