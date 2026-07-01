import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getReelsAnalytics, getReelsPerformance } from "../services/reelService";
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
  const [performanceRows, setPerformanceRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [data, performance] = await Promise.all([getReelsAnalytics(), getReelsPerformance()]);
        setMetrics(data);
        setPerformanceRows(performance.rows || []);
      } catch {
        setMetrics(null);
        setPerformanceRows([]);
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
          <MetricCard label="Widget Opens" value={metrics.productWidgetOpens || 0} />
          <MetricCard label="Product Views" value={metrics.productViews} />
          <MetricCard label="Add To Cart" value={metrics.addToCart} />
          <MetricCard label="Orders" value={metrics.orders} />
          <MetricCard label="Revenue" value={formatCurrency(metrics.revenue)} />
          <MetricCard label="CTR" value={`${metrics.ctr}%`} />
          <MetricCard label="Conversion Rate" value={`${metrics.conversionRate}%`} />
        </div>
      ) : null}

      {!loading ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Reel Commerce Performance</h2>
          </div>
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Reel</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Views</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Widget Opens</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Product Clicks</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">CTR</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Add To Cart</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Purchases</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
              {!performanceRows.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                    No reel performance data yet.
                  </td>
                </tr>
              ) : null}
              {performanceRows.map((row) => (
                <tr key={row.reelId}>
                  <td className="px-4 py-4 text-sm font-semibold">{row.title}</td>
                  <td className="px-4 py-4 text-sm">{row.views || 0}</td>
                  <td className="px-4 py-4 text-sm">{row.widgetOpens || 0}</td>
                  <td className="px-4 py-4 text-sm">{row.productClicks || 0}</td>
                  <td className="px-4 py-4 text-sm">{row.ctr || 0}%</td>
                  <td className="px-4 py-4 text-sm">{row.addToCart || 0}</td>
                  <td className="px-4 py-4 text-sm">{row.purchases || 0}</td>
                  <td className="px-4 py-4 text-sm">{formatCurrency(row.revenue || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
