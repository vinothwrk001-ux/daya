import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clickTracking, getReelFeed } from "../../services/influencerCommerceService";
import { formatCurrency } from "../../utils/formatCurrency";
import { resolveApiAssetUrl } from "../../utils/resolveUrl";
import { saveTrackingContext } from "../../utils/influencerTracking";

export function ReelFeed() {
  const navigate = useNavigate();
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await getReelFeed({ limit: 8 });
        if (!cancelled) setReels(response?.data || []);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || "Failed to load reel feed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleBuyNow(reel, product) {
    try {
      const response = await clickTracking({
        reelId: reel._id,
        productId: product._id,
        anonymousId: typeof window !== "undefined" ? window.localStorage.getItem("anonInfluencerId") || "" : "",
      });
      const data = response?.data || {};
      if (typeof window !== "undefined" && data.anonymousId) {
        window.localStorage.setItem("anonInfluencerId", data.anonymousId);
      }
      saveTrackingContext({
        trackingToken: data.trackingToken,
        anonymousId: data.anonymousId,
        reelId: reel._id,
        productId: product._id,
      });
      navigate(`/product/${product._id}?reel=${reel._id}`);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to attribute reel click.");
    }
  }

  if (loading) {
    return <div className="rounded-[2rem] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Loading reel feed...</div>;
  }

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-500">Reel commerce</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">Shop the feed</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Short-form video discovery with direct product attribution.</p>
        </div>
      </div>
      {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {reels.map((reel) => {
          const product = reel?.campaignId?.productIds?.[0];
          return (
            <article key={reel._id} className="group overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-950 text-white shadow-sm">
              <div className="relative">
                <video src={resolveApiAssetUrl(reel.videoUrl)} className="h-80 w-full object-cover transition duration-500 group-hover:scale-[1.02]" muted autoPlay loop playsInline />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent p-4">
                  <div className="text-sm font-semibold">{reel?.influencerId?.userId?.name || "Influencer"}</div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-300">{reel.caption || "Watch, discover, and shop in one flow."}</p>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2 text-xs text-slate-300">
                  <span>{reel.metrics?.views || 0} views</span>
                  <span>{reel.metrics?.clicks || 0} clicks</span>
                  <span>{reel.metrics?.orders || 0} orders</span>
                </div>
                {product ? (
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-sm font-semibold">{product.name}</div>
                    <div className="mt-1 text-xs text-slate-300">{formatCurrency(product.discountPrice || product.price || 0)}</div>
                    <button
                      type="button"
                      onClick={() => handleBuyNow(reel, product)}
                      className="mt-3 w-full rounded-xl bg-amber-300 px-3 py-2 text-sm font-semibold text-slate-950"
                    >
                      Buy now
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
