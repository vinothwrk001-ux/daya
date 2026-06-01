import { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, Flag, Image as ImageIcon, Star, ThumbsDown, ThumbsUp, UserCircle, Video } from "lucide-react";
import { useAuthStore } from "../context/authStore";
import { resolveApiAssetUrl } from "../utils/resolveUrl";
import { formatCurrency } from "../utils/formatCurrency";
import * as reviewService from "../services/reviewService";

const sortOptions = [
  ["most_recent", "Most Recent"],
  ["most_helpful", "Most Helpful"],
  ["highest_rating", "Highest Rating"],
  ["lowest_rating", "Lowest Rating"],
  ["oldest", "Oldest"],
];

function RatingStars({ value = 0, large = false, onChange }) {
  const numericValue = Number(value) || 0;
  const iconSize = large ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <span className="inline-flex items-center gap-0.5" role={onChange ? "radiogroup" : "img"} aria-label={`${numericValue} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = numericValue >= star;
        const half = numericValue >= star - 0.5 && numericValue < star;
        return (
          <button
            key={star}
            type="button"
            disabled={!onChange}
            onClick={() => onChange?.(star)}
            className={`${onChange ? "cursor-pointer transition hover:scale-110" : "cursor-default"} ${filled || half ? "text-amber-500" : "text-slate-300 dark:text-slate-700"}`}
            title={`${star} star${star > 1 ? "s" : ""}`}
          >
            <span className="relative inline-block">
              <Star className={`${iconSize} ${filled && !half ? "fill-current" : ""}`} strokeWidth={2.4} />
              {half ? <span className="absolute inset-0 w-1/2 overflow-hidden text-amber-500"><Star className={`${iconSize} fill-current`} strokeWidth={2.4} /></span> : null}
            </span>
          </button>
        );
      })}
    </span>
  );
}

function EmptyReviewState() {
  return (
    <div className="flex min-h-[250px] min-w-[300px] items-center justify-center rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
      No published reviews yet.
    </div>
  );
}

function getProductImage(product) {
  const image = product?.images?.[0] || product?.image || product?.thumbnail;
  return typeof image === "string" ? image : image?.url || image?.secureUrl || "";
}

function getProductPrice(product) {
  return product?.salePrice ?? product?.pricing?.salePrice ?? product?.price ?? product?.pricing?.price ?? null;
}

function formatReviewDate(value) {
  if (!value) return "Recently";
  try {
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(value));
  } catch {
    return "Recently";
  }
}

function ReviewProductTile({ product }) {
  if (!product) return null;
  const imageUrl = getProductImage(product);
  const price = getProductPrice(product);
  return (
    <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-200 text-slate-400 dark:bg-slate-800">
        {imageUrl ? <img src={resolveApiAssetUrl(imageUrl)} alt={product.name || "Reviewed product"} className="h-full w-full object-cover" loading="lazy" /> : <ImageIcon className="h-5 w-5" />}
      </div>
      <div className="min-w-0">
        <div className="line-clamp-1 text-xs font-semibold text-slate-700 dark:text-slate-200">{product.name || "Reviewed product"}</div>
        {price !== null ? <div className="mt-1 text-sm font-bold text-slate-950 dark:text-white">{formatCurrency(price)}</div> : null}
      </div>
    </div>
  );
}

function HorizontalReviewCard({ review, product, onVote, onReport }) {
  const customerName = review.customerId?.name || review.userId?.name || "Customer";
  const avatarUrl = review.customerId?.avatarUrl || review.userId?.avatarUrl;
  return (
    <article className="flex min-h-[250px] w-[300px] shrink-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:w-[330px]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
            {avatarUrl ? <img src={resolveApiAssetUrl(avatarUrl)} alt="" className="h-full w-full object-cover" /> : <UserCircle className="h-7 w-7" />}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-slate-950 dark:text-white">{customerName}</div>
            <div className="text-xs font-semibold text-slate-500">{review.verifiedPurchase ? "Verified Purchase" : "Customer Review"}</div>
          </div>
        </div>
        <button type="button" onClick={() => onReport(review._id)} className="text-slate-400 hover:text-rose-600" aria-label="Report review">
          <Flag className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3">
        <RatingStars value={review.rating} />
      </div>
      <p className="mt-3 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-slate-700 dark:text-slate-300">
        {review.review || review.title || "Customer shared feedback for this product."}
      </p>

      <ReviewProductTile product={review.productId?.name ? review.productId : product} />

      {review.vendorReply ? (
        <div className="mt-3 line-clamp-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-200">
          <span className="font-semibold">Vendor Reply:</span> {review.vendorReply}
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between pt-4 text-xs text-slate-500">
        <span>{formatReviewDate(review.createdAt)}</span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => onVote(review._id, "helpful")} className="inline-flex items-center gap-1 hover:text-emerald-600">
            <ThumbsUp className="h-3.5 w-3.5" /> {review.helpfulCount || 0}
          </button>
          <button type="button" onClick={() => onVote(review._id, "not_helpful")} className="inline-flex items-center gap-1 hover:text-rose-600" aria-label="Not helpful">
            <ThumbsDown className="h-3.5 w-3.5" /> {review.notHelpfulCount || 0}
          </button>
          <Bookmark className="h-3.5 w-3.5" />
        </div>
      </div>
    </article>
  );
}

export function ProductReviewsSection({ productId, product = null }) {
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

  const load = useCallback(async () => {
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
  }, [params, productId]);

  useEffect(() => {
    void load();
  }, [load]);

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
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-950 dark:text-white">Customer Reviews</h2>
        <button type="button" onClick={() => setFilter({ sortBy: "most_recent" })} className="text-sm font-semibold text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
          View all reviews
        </button>
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        <div className="min-h-[250px] w-[260px] shrink-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">{Number(summary.averageRating || 0).toFixed(1)}</div>
          <div className="mt-2">
            <RatingStars value={summary.averageRating || 0} large />
          </div>
          <div className="mt-2 text-xs text-slate-500">Based on {(summary.totalReviews || summary.totalRatings || 0).toLocaleString()} reviews</div>
          <div className="mt-4 grid gap-2 text-xs">
            {[5, 4, 3, 2, 1].map((rating) => (
              <div key={rating} className="grid grid-cols-[1.5rem_minmax(0,1fr)_2.75rem] items-center gap-2">
                <span className="font-medium text-slate-700 dark:text-slate-200">{rating}</span>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${distribution[rating]?.percent || 0}%` }} />
                </div>
                <span className="text-right text-slate-500">{distribution[rating]?.count || 0}</span>
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[250px] min-w-[300px] items-center justify-center rounded-xl border border-slate-200 text-sm text-slate-500 dark:border-slate-800">
            Loading reviews...
          </div>
        ) : reviews.length ? (
          reviews.map((review) => (
            <HorizontalReviewCard key={review._id} review={review} product={product} onVote={handleVote} onReport={handleReport} />
          ))
        ) : (
          <EmptyReviewState />
        )}
      </div>

      {summary.media?.length ? (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
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

      <div className="mt-5 flex flex-wrap items-center gap-2">
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
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <RatingStars value={form.rating} onChange={(rating) => setForm((next) => ({ ...next, rating }))} large />
            </div>
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
    </section>
  );
}
