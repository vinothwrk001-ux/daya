import { useEffect, useMemo, useState } from "react";
import { confirmAction } from "../services/notificationService";
import { deleteReview, listReviews, updateProductReviewModeration } from "../services/adminApi";
import { useAdminSession } from "../hooks/useAdminSession";

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

export function AdminReviewsPage() {
  const { canAccess } = useAdminSession();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadReviews() {
      setLoading(true);
      setError("");
      try {
        const response = await listReviews({
          ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
        });
        if (active) setReviews(response?.data?.reviews || response?.reviews || response?.data || response || []);
      } catch (err) {
        if (active) setError(normalizeError(err));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadReviews();

    return () => {
      active = false;
    };
  }, [searchTerm]);

  const canDelete = canAccess("reviews.delete");

  const filteredReviews = useMemo(() => {
    if (statusFilter === "all") return reviews;
    return reviews.filter((r) => r.status === statusFilter);
  }, [reviews, statusFilter]);

  async function handleDelete(reviewId) {
    if (!(await confirmAction({ message: "Delete this review?", tone: "danger", confirmLabel: "Confirm" }))) return;

    setBusyId(reviewId);
    setError("");
    try {
      await deleteReview(reviewId);
      setReviews((current) => current.filter((review) => review._id !== reviewId));
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusyId("");
    }
  }

  async function handleToggleStorefront(reviewId, currentValue) {
    setBusyId(reviewId);
    setError("");
    try {
      await updateProductReviewModeration(reviewId, { displayInStorefront: !currentValue });
      setReviews((current) =>
        current.map((r) => (r._id === reviewId ? { ...r, displayInStorefront: !currentValue } : r))
      );
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Reviews</h1>
          <p className="mt-1 text-sm text-slate-600">Manage product reviews and ratings</p>
        </div>
      </section>

      <div className="flex flex-col gap-4 lg:flex-row">
        <input
          type="text"
          placeholder="Search by product, customer, or review..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-amber-500 focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-amber-500 focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-amber-500" />
              <p className="mt-4 text-sm text-slate-600">Loading reviews...</p>
            </div>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-sm text-slate-600">No reviews found</p>
          </div>
        ) : (
          filteredReviews.map((review) => (
            <div key={review._id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-950">{review.productId?.name || "Unknown product"}</h3>
                    <span className="inline-flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={i < Number(review.rating || 0) ? "text-amber-400" : "text-slate-300"}>
                          *
                        </span>
                      ))}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">by {review.userId?.name || review.customerId?.name || "Unknown customer"}</p>
                  {review.title ? <p className="mt-3 text-sm font-medium text-slate-800">{review.title}</p> : null}
                  <p className="mt-2 text-sm text-slate-700">{review.comment || review.review || "No comment provided."}</p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    review.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                    review.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {review.status ? review.status.charAt(0).toUpperCase() + review.status.slice(1) : "Unknown"}
                  </span>
                  {review.status === 'approved' && (
                    <label className="flex items-center gap-2 cursor-pointer" title="Display this review on the storefront homepage">
                      <span className="text-xs font-medium text-slate-600">Storefront</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!!review.displayInStorefront}
                        disabled={busyId === review._id}
                        onClick={() => handleToggleStorefront(review._id, !!review.displayInStorefront)}
                        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                          review.displayInStorefront ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
                            review.displayInStorefront ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </label>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      disabled={busyId === review._id}
                      onClick={() => handleDelete(review._id)}
                      className="text-sm font-medium text-rose-700 hover:text-rose-900 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
