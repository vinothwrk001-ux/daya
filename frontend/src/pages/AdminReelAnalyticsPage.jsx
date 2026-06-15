import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getReelsAnalytics } from "../services/reelService";
import { formatCurrency } from "../utils/formatCurrency";

function MetricCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

export function AdminReelAnalyticsPage() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getReelsAnalytics();
        setMetrics(data);
      } catch {
        setMetrics(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Reels Analytics</h1>
          <p className="text-sm text-slate-500">Engagement, commerce, and conversion metrics.</p>
        </div>
        <Link to="/admin/reels" className="text-sm font-semibold text-orange-600">
          Back to reels
        </Link>
      </div>

      {loading ? <div className="py-12 text-center text-sm text-slate-500">Loading analytics...</div> : null}

      {metrics ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total Reels" value={metrics.totalReels} />
          <MetricCard label="Published Reels" value={metrics.publishedReels} />
          <MetricCard label="Total Views" value={metrics.totalViews} />
          <MetricCard label="Unique Views" value={metrics.uniqueViews} />
          <MetricCard label="Likes" value={metrics.totalLikes} />
          <MetricCard label="Comments" value={metrics.totalComments} />
          <MetricCard label="Shares" value={metrics.totalShares} />
          <MetricCard label="Saves" value={metrics.totalSaves} />
          <MetricCard label="Product Clicks" value={metrics.productClicks} />
          <MetricCard label="Product Views" value={metrics.productViews} />
          <MetricCard label="Add To Cart" value={metrics.addToCart} />
          <MetricCard label="Orders" value={metrics.orders} />
          <MetricCard label="Revenue" value={formatCurrency(metrics.revenue)} />
          <MetricCard label="CTR" value={`${metrics.ctr}%`} />
          <MetricCard label="Conversion Rate" value={`${metrics.conversionRate}%`} />
        </div>
      ) : null}
    </div>
  );
}
