import { useCallback, useEffect, useState } from "react";
import { ReportingToolbar } from "../components/ReportingToolbar";
import { InlineToast } from "../components/commerce/InlineToast";
import { useReporting } from "../hooks/useReporting";
import { VendorList, VendorSection } from "../components/VendorPanel";
import { useModuleAccess } from "../context/VendorModuleContext";
import * as vendorDashboardService from "../services/vendorDashboardService";

export function VendorReviewsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const { can } = useModuleAccess();
  const reporting = useReporting({
    module: "reviews",
  });

  const load = useCallback(async () => {
    try {
      const response = await vendorDashboardService.getVendorReviews({ limit: 20, ...reporting.appliedParams });
      setData(response.data);
      setError("");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load reviews.");
    }
  }, [reporting.appliedParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);

    return () => clearTimeout(timer);
  }, [load]);

  async function respondToReview(id) {
    const message = window.prompt("Reply to customer");
    if (!message) return;
    try {
      await vendorDashboardService.respondToVendorReview(id, { message });
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to send review response.");
    }
  }

  async function handleExport(format) {
    try {
      await reporting.exportReport(format);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to export reviews.");
    }
  }

  return (
    <VendorSection title="Reviews" description="Monitor customer sentiment and respond directly from the seller panel.">
      <div className="mb-4">
        <ReportingToolbar
          startDate={reporting.startDate}
          endDate={reporting.endDate}
          onDateChange={reporting.setDateRange}
          onApply={reporting.applyDateRange}
          onExport={handleExport}
          exportingFormat={reporting.exportingFormat}
          isDirty={reporting.hasPendingChanges}
        />
      </div>
      {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      <VendorList
        items={data?.reviews || []}
        emptyMessage="No customer reviews yet."
        renderItem={(review) => (
          <div key={review._id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950 dark:text-white">{review.productId?.name || "Product review"}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">By {review.customerId?.name || review.userId?.name || "Customer"} · {review.rating}/5 · {review.status}</div>
                <div className="mt-3 text-sm text-slate-700 dark:text-slate-300">{review.review || review.comment || review.title || "No written review."}</div>
                {review.vendorReply || review.sellerResponse?.message ? (
                  <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                    Vendor reply: {review.vendorReply || review.sellerResponse.message}
                  </div>
                ) : null}
              </div>
              {can("reviews.update") ? (
                <button onClick={() => respondToReview(review._id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                  {review.vendorReply || review.sellerResponse?.message ? "Edit Reply" : "Reply"}
                </button>
              ) : null}
            </div>
          </div>
        )}
      />
      <InlineToast toast={reporting.toast} onClose={reporting.clearToast} />
    </VendorSection>
  );
}
