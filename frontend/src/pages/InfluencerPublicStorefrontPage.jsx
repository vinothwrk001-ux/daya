import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BadgeCheck } from "lucide-react";
import { getInfluencerStorefront } from "../services/influencerCommerceService";
import { resolveApiAssetUrl } from "../utils/resolveUrl";

export function InfluencerPublicStorefrontPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getInfluencerStorefront({ slug })
      .then((response) => setData(response?.data))
      .catch((err) => setError(err?.response?.data?.message || "Storefront not found."));
  }, [slug]);

  if (error) return <main className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950"><div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 font-bold dark:border-slate-800 dark:bg-slate-900">{error}</div></main>;
  if (!data) return <main className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950"><div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">Loading creator storefront...</div></main>;

  const { storefront, profile, badge, collections } = data;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="h-64 bg-slate-200 dark:bg-slate-800">{storefront.banner ? <img src={resolveApiAssetUrl(storefront.banner)} alt="" className="h-full w-full object-cover" /> : null}</div>
          <div className="p-6">
            <div className="-mt-20 flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="h-32 w-32 overflow-hidden rounded-3xl border-4 border-white bg-slate-100 shadow-sm dark:border-slate-900 dark:bg-slate-800">
                {storefront.profileImage ? <img src={resolveApiAssetUrl(storefront.profileImage)} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div>
                <h1 className="text-3xl font-black">{storefront.name}</h1>
                {badge ? <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-black text-blue-700 dark:bg-blue-950 dark:text-blue-200"><BadgeCheck className="h-4 w-4" /> {badge.label}</div> : null}
              </div>
            </div>
            <p className="mt-5 max-w-3xl text-slate-600 dark:text-slate-300">{storefront.description || profile.shortBio}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {(storefront.categories || []).map((category) => <span key={category} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold dark:bg-slate-800">{category}</span>)}
            </div>
          </div>
        </div>
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {(collections || []).map((collection) => (
            <article key={collection._id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">Collection</div>
              <h2 className="mt-2 text-xl font-black">{collection.title}</h2>
              <p className="mt-2 text-sm text-slate-500">{collection.productIds?.length || 0} products</p>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
