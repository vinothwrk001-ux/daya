import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { VendorStoreHeader } from "../components/vendor-storefront/VendorStoreHeader";
import { getVendorStoreFollowers, getVendorStorefront } from "../services/vendorStorefrontService";

export function VendorStoreFollowersPage() {
  const { vendorSlug } = useParams();
  const [state, setState] = useState({ loading: true, error: "", data: null });

  useEffect(() => {
    let alive = true;
    Promise.all([getVendorStorefront(vendorSlug), getVendorStoreFollowers(vendorSlug)])
      .then(([store, followers]) => {
        if (alive) setState({ loading: false, error: "", data: { ...store.data, ...followers.data } });
      })
      .catch((err) => {
        if (alive) setState({ loading: false, error: err?.response?.data?.message || "Failed to load followers.", data: null });
      });
    return () => {
      alive = false;
    };
  }, [vendorSlug]);

  if (state.loading) return <div className="rounded-2xl bg-white p-8 text-sm text-slate-500 dark:bg-slate-900">Loading followers...</div>;
  if (state.error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{state.error}</div>;

  return (
    <div className="grid gap-6">
      <VendorStoreHeader vendor={state.data.vendor} isFollowing={state.data.isFollowing} onFollowChange={(next) => setState((current) => ({ ...current, data: { ...current.data, ...next } }))} />
      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-950 dark:text-white">Store Followers</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {state.data.followers.map((item, index) => (
            <div key={`${item.customer?._id || index}-${item.followedAt}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                {item.customer?.avatarUrl ? <img src={item.customer.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" /> : item.customer?.name?.slice(0, 1) || "U"}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-950 dark:text-white">{item.customer?.name || "Marketplace customer"}</div>
                <div className="text-xs text-slate-500">Following since {new Date(item.followedAt).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
