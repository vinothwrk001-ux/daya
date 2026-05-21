import { useEffect, useMemo, useState } from "react";
import {
  createUserReview,
  deleteUserReview,
  getUserReviewableProducts,
  getUserReviews,
  updateUserReview,
} from "../services/userService";
import { resolveApiAssetUrl } from "../utils/resolveUrl";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Failed to update reviews.";
}

const defaultForm = {
  productId: "",
  orderId: "",
  rating: 5,
  title: "",
  comment: "",
};

function RatingStars({ value = 0, onChange, size = "text-3xl" }) {
  const numericValue = Number(value) || 0;
  return (
    <div className="flex items-center gap-1" role={onChange ? "radiogroup" : "img"} aria-label={`${numericValue} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = numericValue >= star;
        const half = numericValue >= star - 0.5 && numericValue < star;
        return (
          <button
            key={star}
            type="button"
            role={onChange ? "radio" : undefined}
            aria-checked={onChange ? numericValue === star : undefined}
            disabled={!onChange}
            onClick={() => onChange?.(star)}
            className={`${size} leading-none ${onChange ? "cursor-pointer transition hover:scale-110" : "cursor-default"} ${filled || half ? "text-amber-500" : "text-slate-300 dark:text-slate-700"}`}
            title={`${star} star${star > 1 ? "s" : ""}`}
          >
            <span className="relative inline-block">
              <span className={half ? "text-slate-300 dark:text-slate-700" : ""}>★</span>
              {half ? <span className="absolute inset-0 w-1/2 overflow-hidden text-amber-500">★</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [reviewableProducts, setReviewableProducts] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const photoPreviews = useMemo(
    () => photoFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [photoFiles]
  );

  useEffect(() => {
    return () => {
      photoPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [photoPreviews]);

  async function loadReviews() {
    setLoading(true);
    try {
      const [reviewsResponse, reviewableResponse] = await Promise.all([
        getUserReviews(),
        getUserReviewableProducts(),
      ]);
      setReviews(reviewsResponse.data || []);
      setReviewableProducts(reviewableResponse.data || []);
      setError("");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReviews();
  }, []);

  function openCreate() {
    setEditingId("");
    const firstItem = reviewableProducts[0];
    setForm({
      ...defaultForm,
      productId: firstItem?.productId || "",
      orderId: firstItem?.orderId || "",
    });
    setPhotoFiles([]);
    setShowForm(true);
  }

  function openCreateForItem(item) {
    setEditingId("");
    setForm({
      ...defaultForm,
      productId: item.productId || "",
      orderId: item.orderId || "",
    });
    setPhotoFiles([]);
    setShowForm(true);
  }

  function openEdit(review) {
    setEditingId(review._id);
    setForm({
      productId: review.productId?._id || "",
      orderId: review.orderId?._id || "",
      rating: review.rating || 5,
      title: review.title || "",
      comment: review.review || review.comment || "",
    });
    setPhotoFiles([]);
    setShowForm(true);
  }

  async function submitForm(event) {
    event.preventDefault();
    try {
      if (editingId) {
        const response = await updateUserReview(editingId, {
          rating: Number(form.rating),
          title: form.title,
          comment: form.comment,
        }, photoFiles);
        setReviews(response.data || []);
      } else {
        const response = await createUserReview({
          productId: form.productId,
          orderId: form.orderId || null,
          rating: Number(form.rating),
          title: form.title,
          comment: form.comment,
        }, photoFiles);
        setReviews(response.data || []);
      }
      setShowForm(false);
      setForm(defaultForm);
      setEditingId("");
      setPhotoFiles([]);
      await loadReviews();
      setError("");
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  async function removeReview(id) {
    try {
      await deleteUserReview(id);
      setReviews((current) => current.filter((review) => review._id !== id));
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  function closeForm() {
    setShowForm(false);
    setEditingId("");
    setForm(defaultForm);
    setPhotoFiles([]);
  }

  function renderReviewForm({ inline = false } = {}) {
    return (
      <form onSubmit={submitForm} className={`${inline ? "mt-5 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950" : "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          {!editingId ? (
            <label className="grid gap-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Delivered product</span>
              <select
                value={`${form.orderId}:${form.productId}`}
                onChange={(event) => {
                  const [orderId, productId] = event.target.value.split(":");
                  setForm((current) => ({ ...current, orderId, productId }));
                }}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                required
              >
                {reviewableProducts.map((item) => (
                  <option key={`${item.orderId}-${item.productId}`} value={`${item.orderId}:${item.productId}`}>
                    {item.productName} - {item.orderNumber}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="grid gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Rating</span>
            <div className="flex min-h-14 items-center rounded-2xl border border-slate-300 px-4 dark:border-slate-700 dark:bg-slate-950">
              <RatingStars value={form.rating} onChange={(rating) => setForm((current) => ({ ...current, rating }))} />
            </div>
          </div>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Title</span>
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          </label>
          <label className="grid gap-2 sm:col-span-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Comment</span>
            <textarea value={form.comment} onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))} className="min-h-28 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          </label>
          <label className="grid gap-2 sm:col-span-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Photos</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => setPhotoFiles(Array.from(event.target.files || []).slice(0, 10))}
              className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
            />
          </label>
          {photoPreviews.length ? (
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              {photoPreviews.map((preview, index) => (
                <div key={`${preview.file.name}-${index}`} className="relative h-20 w-20 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800">
                  <img src={preview.url} alt={preview.file.name} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="mt-5 flex gap-3">
          <button type="submit" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white">{editingId ? "Update review" : "Publish review"}</button>
          <button type="button" onClick={closeForm} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Cancel</button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Reviews and ratings</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Share feedback on delivered products and manage your published reviews.</p>
        </div>
        <button type="button" onClick={openCreate} disabled={!reviewableProducts.length} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950">
          Add review
        </button>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {!editingId && reviewableProducts.length ? (
        <div className="grid gap-3">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Delivered products ready for review</div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {reviewableProducts.map((item) => (
              <button
                key={`${item.orderId}-${item.productId}`}
                type="button"
                onClick={() => openCreateForItem(item)}
                className="flex min-h-24 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                  {item.image ? <img src={resolveApiAssetUrl(item.image)} alt={item.productName || "Product"} className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm font-semibold text-slate-950 dark:text-white">{item.productName}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Order {item.orderNumber}</div>
                  {item.variantTitle ? <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{item.variantTitle}</div> : null}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {showForm && !editingId ? (
        <form onSubmit={submitForm} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-4 sm:grid-cols-2">
            {!editingId ? (
              <label className="grid gap-2 sm:col-span-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Delivered product</span>
                <select
                  value={`${form.orderId}:${form.productId}`}
                  onChange={(event) => {
                    const [orderId, productId] = event.target.value.split(":");
                    setForm((current) => ({ ...current, orderId, productId }));
                  }}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  required
                >
                  {reviewableProducts.map((item) => (
                    <option key={`${item.orderId}-${item.productId}`} value={`${item.orderId}:${item.productId}`}>
                      {item.productName} - {item.orderNumber}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="grid gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Rating</span>
              <div className="flex min-h-14 items-center rounded-2xl border border-slate-300 px-4 dark:border-slate-700 dark:bg-slate-950">
                <RatingStars value={form.rating} onChange={(rating) => setForm((current) => ({ ...current, rating }))} />
              </div>
            </div>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Title</span>
              <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            </label>
            <label className="grid gap-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Comment</span>
              <textarea value={form.comment} onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))} className="min-h-28 rounded-2xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            </label>
            <label className="grid gap-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Photos</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(event) => setPhotoFiles(Array.from(event.target.files || []).slice(0, 10))}
                className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
              />
            </label>
            {photoPreviews.length ? (
              <div className="flex flex-wrap gap-3 sm:col-span-2">
                {photoPreviews.map((preview, index) => (
                  <div key={`${preview.file.name}-${index}`} className="relative h-20 w-20 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800">
                    <img src={preview.url} alt={preview.file.name} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="mt-5 flex gap-3">
            <button type="submit" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white">{editingId ? "Update review" : "Publish review"}</button>
            <button type="button" onClick={() => { setShowForm(false); setPhotoFiles([]); }} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Cancel</button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <div className="h-48 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800" />
      ) : reviews.length ? (
        <div className="grid gap-4">
          {reviews.map((review) => (
            <div key={review._id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
                    {review.productId?.images?.[0]?.url ? (
                      <img src={resolveApiAssetUrl(review.productId.images[0].url)} alt={review.productId?.name || "Product"} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-950 dark:text-white">{review.productId?.name}</div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{review.title || "Untitled review"}</div>
                  </div>
                </div>
                <RatingStars value={review.rating} size="text-xl" />
              </div>
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{review.review || review.comment || "No review comment added."}</p>
              {review.images?.length ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  {review.images.map((image, index) => (
                    <a key={`${image.url}-${index}`} href={resolveApiAssetUrl(image.url)} target="_blank" rel="noreferrer" className="h-20 w-20 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800">
                      <img src={resolveApiAssetUrl(image.url)} alt="Review photo" className="h-full w-full object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              ) : null}
              {review.vendorReply || review.sellerResponse?.message ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                  Seller response: {review.vendorReply || review.sellerResponse.message}
                </div>
              ) : null}
              {review.status ? <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-emerald-600">{review.status}</div> : null}
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => openEdit(review)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Edit</button>
                <button type="button" onClick={() => removeReview(review._id)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200">Delete</button>
              </div>
              {showForm && editingId === review._id ? renderReviewForm({ inline: true }) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          No reviews yet. You can review delivered products from here.
        </div>
      )}
    </div>
  );
}
