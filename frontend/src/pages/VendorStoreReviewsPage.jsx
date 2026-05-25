import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Star } from "lucide-react";
import { VendorStoreHeader } from "../components/vendor-storefront/VendorStoreHeader";
import { getVendorStoreReviews } from "../services/vendorStorefrontService";

export function VendorStoreReviewsPage() {
  const { vendorSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState({ loading: true, error: "", data: null });

  useEffect(() => {
    let alive = true;
    setState((current) => ({ ...current, loading: true, error: "" }));
    getVendorStoreReviews(vendorSlug, Object.fromEntries(searchParams.entries()))
      .then((response) => {
        if (alive) setState({ loading: false, error: "", data: response.data });
      })
      .catch((err) => {
        if (alive) setState({ loading: false, error: err?.response?.data?.message || "Failed to load reviews.", data: null });
      });
    return () => {
      alive = false;
    };
  }, [vendorSlug, searchParams]);

  if (state.loading && !state.data) return <div className="rounded-2xl bg-white p-8 text-sm text-slate-500 dark:bg-slate-900">Loading reviews...</div>;
  if (state.error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{state.error}</div>;

  const data = state.data;

  return (
    <div className="grid gap-6">
      <VendorStoreHeader vendor={data.vendor} isFollowing={data.isFollowing} onFollowChange={(next) => setState((current) => ({ ...current, data: { ...current.data, ...next } }))} />
      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside>
          <div className="text-4xl font-bold text-slate-950 dark:text-white">{Number(data.averageRating || 0).toFixed(1)}</div>
          <div className="mt-1 flex text-amber-400">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-4 w-4 ${i < Math.round(data.averageRating || 0) ? "fill-current" : ""}`} />)}</div>
          <div className="mt-2 text-sm text-slate-500">{data.totalReviews} verified reviews</div>
          <div className="mt-4 grid gap-2">
            {[5, 4, 3, 2, 1].map((rating) => (
              <div key={rating} className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-8">{rating} star</span>
                <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, ((data.ratingDistribution?.[rating] || 0) / Math.max(data.totalReviews, 1)) * 100)}%` }} />
                </div>
                <span className="w-8 text-right">{data.ratingDistribution?.[rating] || 0}</span>
              </div>
            ))}
          </div>
        </aside>
        <main className="grid gap-3">
          <select value={searchParams.get("sortBy") || "helpful"} onChange={(e) => setSearchParams({ sortBy: e.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 sm:w-56">
            <option value="helpful">Most Helpful</option>
            <option value="newest">Newest</option>
            <option value="highest">Highest Rating</option>
            <option value="lowest">Lowest Rating</option>
          </select>
          {data.reviews.map((review) => (
            <article key={review._id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950 dark:text-white">{review.title || "Customer review"}</div>
                  <div className="mt-1 text-xs text-slate-500">{review.customerId?.name || "Marketplace customer"} {review.verifiedPurchase ? "• Verified purchase" : ""}</div>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700"><Star className="h-3 w-3 fill-current" /> {review.rating}</div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{review.review}</p>
              {[...(review.images || []), ...(review.videos || [])].length ? (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {[...(review.images || []), ...(review.videos || [])].map((media) => <img key={media.url} src={media.url} alt="" className="h-16 w-16 rounded-lg object-cover" />)}
                </div>
              ) : null}
              {review.vendorReply ? <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">Store reply: {review.vendorReply}</div> : null}
            </article>
          ))}
        </main>
      </section>
    </div>
  );
}
