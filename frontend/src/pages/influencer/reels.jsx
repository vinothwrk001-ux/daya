import { useCallback, useEffect, useState } from "react";
import { getInfluencerReelsPage } from "../../services/influencerCommerceService";
import { ReelCard, ReelCardSkeleton } from "../../components/influencer/ReelCard";

export default function InfluencerReelsPage() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stateFilter, setStateFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const fetchPage = useCallback(
    async (nextPage, append) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const res = await getInfluencerReelsPage({
          page: nextPage,
          limit: 10,
          ...(stateFilter ? { state: stateFilter } : {}),
        });
        const payload = res?.data;
        const rows = payload?.items || [];
        setTotalPages(payload?.totalPages || 1);
        if (append) setItems((prev) => [...prev, ...rows]);
        else setItems(rows);
        setPage(nextPage);
      } catch (err) {
        setError(err?.response?.data?.message || "Could not load reels.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [stateFilter]
  );

  useEffect(() => {
    setItems([]);
    fetchPage(1, false);
  }, [stateFilter, fetchPage]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Your reels</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Lazy-loaded grid with moderation status and performance counters.</p>
        </div>
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="pending_review">Pending review</option>
          <option value="approved">Approved</option>
          <option value="published">Published</option>
          <option value="rejected">Rejected</option>
          <option value="uploaded">Uploaded</option>
        </select>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <ReelCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((reel) => (
              <ReelCard key={reel._id} reel={reel} />
            ))}
          </div>
          {page < totalPages ? (
            <div className="flex justify-center py-6">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => fetchPage(page + 1, true)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                {loadingMore ? "Loading…" : "Load more reels"}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-14 text-center dark:border-slate-700">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No reels yet</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Upload from the Upload reel tab once a campaign is active.</p>
        </div>
      )}
    </div>
  );
}
