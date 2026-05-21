import { useEffect, useMemo, useState } from "react";
import { Flag, Image as ImageIcon, ThumbsDown, ThumbsUp, Video } from "lucide-react";
import { useAuthStore } from "../context/authStore";
import { resolveApiAssetUrl } from "../utils/resolveUrl";
import * as reviewService from "../services/reviewService";

const sortOptions = [
  ["most_recent", "Most Recent"],
  ["most_helpful", "Most Helpful"],
  ["highest_rating", "Highest Rating"],
  ["lowest_rating", "Lowest Rating"],
  ["oldest", "Oldest"],
];

function Stars({ value = 0, large = false }) {
  const rounded = Math.round(Number(value) || 0);
  return (
    <span className={large ? "text-2xl tracking-normal text-amber-500" : "text-sm tracking-normal text-amber-500"} aria-label={`${value} out of 5 stars`}>
      {"★".repeat(rounded)}
      <span className="text-slate-300 dark:text-slate-700">{"★".repeat(Math.max(0, 5 - rounded))}</span>
    </span>
  );
}

function EmptyReviewState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
      No published reviews yet.
    </div>
  );
}

export function ProductReviewsSection({ productId }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState({ sortBy: "most_recent" });
  const [form, setForm] = useState({ rating: 5, title: "", review: "", wouldRecommend: "" });
  const [media, setMedia] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const summary = data?.summary || {};
  const reviews = data?.reviews || [];
  const distribution = summary.ratingDistribution || {};

  const params = useMemo(
    () => Object.fromEntries(Object.entries(filter).filter(([, value]) => value !== "" && value !== false)),
    [filter]
  );

  async function load() {
    if (!productId) return;
    setLoading(true);
    try {
      const response = await reviewService.getProductReviews(productId, params);
      setData(response.data);
      setError("");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [productId, params]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await reviewService.submitReview({ ...form, productId }, media);
      setForm({ rating: 5, title: "", review: "", wouldRecommend: "" });
      setMedia([]);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to submit review.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVote(reviewId, voteType) {
    try {
      await reviewService.voteReview(reviewId, voteType);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to save vote.");
    }
  }

  async function handleReport(reviewId) {
    const reason = window.prompt("Report reason: spam, fake_review, abusive_content, wrong_information, harassment, other");
    if (!reason) return;
    try {
      await reviewService.reportReview(reviewId, { reason });
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to report review.");
    }
  }

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Customer Reviews</h2>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Stars value={summary.averageRating || 0} large />
            <span className="text-2xl font-bold text-slate-950 dark:text-white">{Number(summary.averageRating || 0).toFixed(1)}</span>
            <span className="pb-1 text-sm text-slate-500">Based on {summary.totalRatings || 0} ratings</span>
          </div>
        </div>
        <div className="grid gap-2 text-sm sm:min-w-[280px]">
          {[5, 4, 3, 2, 1].map((rating) => (
            <div key={rating} className="grid grid-cols-[2rem_minmax(0,1fr)_3rem] items-center gap-2">
              <span className="font-medium text-slate-700 dark:text-slate-200">{rating}★</span>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${distribution[rating]?.percent || 0}%` }} />
              </div>
              <span className="text-right text-xs text-slate-500">{distribution[rating]?.percent || 0}%</span>
            </div>
          ))}
        </div>
      </div>

      {summary.media?.length ? (
        <div className="mt-6 flex gap-3 overflow-x-auto pb-1">
          {summary.media.map((item, index) => (
            <a key={`${item.url}-${index}`} href={resolveApiAssetUrl(item.url)} target="_blank" rel="noreferrer" className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800">
              {item.mimeType?.startsWith("video") ? (
                <div className="flex h-full items-center justify-center text-slate-500"><Video size={22} /></div>
              ) : (
                <img src={resolveApiAssetUrl(item.url)} alt="Review media" className="h-full w-full object-cover" loading="lazy" />
              )}
            </a>
          ))}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {[["", "All Reviews"], [5, "5 Star"], [4, "4 Star"], [3, "3 Star"], [2, "2 Star"], [1, "1 Star"]].map(([value, label]) => (
          <button key={label} type="button" onClick={() => setFilter((next) => ({ ...next, rating: value }))} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${String(filter.rating || "") === String(value) ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
            {label}
          </button>
        ))}
        <button type="button" onClick={() => setFilter((next) => ({ ...next, verifiedPurchase: next.verifiedPurchase ? "" : "true" }))} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Verified Purchase</button>
        <button type="button" onClick={() => setFilter((next) => ({ ...next, withPhotos: next.withPhotos ? "" : "true" }))} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"><ImageIcon size={14} /> Photos</button>
        <button type="button" onClick={() => setFilter((next) => ({ ...next, withVideos: next.withVideos ? "" : "true" }))} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Video size={14} /> Videos</button>
        <select value={filter.sortBy} onChange={(event) => setFilter((next) => ({ ...next, sortBy: event.target.value }))} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
          {sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {isAuthenticated && user?.role === "user" ? (
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold text-slate-900 dark:text-white">Overall Rating</label>
            <select value={form.rating} onChange={(event) => setForm((next) => ({ ...next, rating: Number(event.target.value) }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
              {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} Star</option>)}
            </select>
          </div>
          <input value={form.title} onChange={(event) => setForm((next) => ({ ...next, title: event.target.value }))} maxLength={160} placeholder="Review title" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <textarea value={form.review} onChange={(event) => setForm((next) => ({ ...next, review: event.target.value }))} maxLength={2000} rows={4} placeholder="Review description" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <div className="flex flex-wrap items-center gap-3">
            <select value={form.wouldRecommend} onChange={(event) => setForm((next) => ({ ...next, wouldRecommend: event.target.value }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
              <option value="">Would recommend?</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
            <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" multiple onChange={(event) => setMedia(Array.from(event.target.files || []).slice(0, 11))} className="text-sm text-slate-600 dark:text-slate-300" />
            <button type="submit" disabled={submitting} className="rounded-xl bg-[color:var(--commerce-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-6 grid gap-4">
        {loading ? <div className="text-sm text-slate-500">Loading reviews...</div> : reviews.length ? reviews.map((review) => (
          <article key={review._id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Stars value={review.rating} />
                <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{review.title || "Customer review"}</div>
                <div className="mt-1 text-xs text-slate-500">By {review.customerId?.name || "Customer"} {review.verifiedPurchase ? "· Verified Purchase" : ""}</div>
              </div>
              <button type="button" onClick={() => handleReport(review._id)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-rose-600"><Flag size={14} /> Report</button>
            </div>
            {review.review ? <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">{review.review}</p> : null}
            {[...(review.images || []), ...(review.videos || [])].length ? (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {[...(review.images || []), ...(review.videos || [])].map((item, index) => (
                  <a key={`${item.url}-${index}`} href={resolveApiAssetUrl(item.url)} target="_blank" rel="noreferrer" className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                    {item.mimeType?.startsWith("video") ? <div className="flex h-full items-center justify-center"><Video size={18} /></div> : <img src={resolveApiAssetUrl(item.url)} alt="Review media" className="h-full w-full object-cover" loading="lazy" />}
                  </a>
                ))}
              </div>
            ) : null}
            {review.vendorReply ? (
              <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                <span className="font-semibold">Vendor Reply:</span> {review.vendorReply}
              </div>
            ) : null}
            <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
              <span>Was this review helpful?</span>
              <button type="button" onClick={() => handleVote(review._id, "helpful")} className="inline-flex items-center gap-1 hover:text-emerald-600"><ThumbsUp size={14} /> {review.helpfulCount || 0}</button>
              <button type="button" onClick={() => handleVote(review._id, "not_helpful")} className="inline-flex items-center gap-1 hover:text-rose-600"><ThumbsDown size={14} /> {review.notHelpfulCount || 0}</button>
            </div>
          </article>
        )) : <EmptyReviewState />}
      </div>
    </section>
  );
}
