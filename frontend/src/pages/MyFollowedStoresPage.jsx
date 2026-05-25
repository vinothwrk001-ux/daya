import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Store, Trash2 } from "lucide-react";
import { getMyFollowedStores, unfollowVendorStore } from "../services/vendorStorefrontService";
import { resolveApiAssetUrl } from "../utils/resolveUrl";

export function MyFollowedStoresPage() {
  const [state, setState] = useState({ loading: true, error: "", stores: [] });

  async function load() {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await getMyFollowedStores({ limit: 30 });
      setState({ loading: false, error: "", stores: response.data?.stores || [] });
    } catch (err) {
      setState({ loading: false, error: err?.response?.data?.message || "Failed to load followed stores.", stores: [] });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function unfollow(slug) {
    await unfollowVendorStore(slug);
    setState((current) => ({ ...current, stores: current.stores.filter((item) => item.vendor.storeSlug !== slug) }));
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">My Followed Stores</h1>
        <p className="mt-1 text-sm text-slate-500">Product alerts, offers, restocks, and collection updates from stores you follow.</p>
      </div>
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.error}</div> : null}
      {state.loading ? <div className="rounded-2xl bg-white p-8 text-sm text-slate-500 dark:bg-slate-900">Loading stores...</div> : null}
      {!state.loading && !state.stores.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">No followed stores yet.</div>
      ) : null}
      <div className="grid gap-4">
        {state.stores.map((item) => {
          const vendor = item.vendor;
          const logo = resolveApiAssetUrl(vendor.logoUrl);
          return (
            <article key={vendor._id} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                  {logo ? <img src={logo} alt={`${vendor.vendorName} logo`} className="h-full w-full object-cover" /> : <Store className="h-6 w-6 text-slate-400" />}
                </div>
                <div>
                  <div className="font-bold text-slate-950 dark:text-white">{vendor.vendorName}</div>
                  <div className="text-xs text-slate-500">{vendor.followersCount} followers</div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <MiniStrip title="Latest Products" products={item.latestProducts} />
                <MiniStrip title="Latest Offers" products={item.latestOffers} />
              </div>
              <div className="flex gap-2 lg:flex-col">
                <Link to={`/vendor/${vendor.storeSlug}`} className="rounded-xl bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700">Visit Store</Link>
                <button type="button" onClick={() => unfollow(vendor.storeSlug)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">
                  <Trash2 className="h-4 w-4" /> Unfollow
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function MiniStrip({ title, products = [] }) {
  return (
    <div>
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{title}</div>
      <div className="flex gap-2 overflow-x-auto">
        {products.length ? products.map((product) => (
          <Link key={product._id} to={`/product/${product._id}`} className="w-24 shrink-0">
            <div className="aspect-square overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
              {product.images?.[0]?.url ? <img src={resolveApiAssetUrl(product.images[0].url)} alt={product.name} className="h-full w-full object-cover" /> : null}
            </div>
            <div className="mt-1 line-clamp-1 text-xs font-medium text-slate-700 dark:text-slate-200">{product.name}</div>
          </Link>
        )) : <div className="text-xs text-slate-500">No updates yet</div>}
      </div>
    </div>
  );
}
