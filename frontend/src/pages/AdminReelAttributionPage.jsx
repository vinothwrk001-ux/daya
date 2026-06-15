import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getReelsAttribution } from "../services/reelService";
import { formatCurrency } from "../utils/formatCurrency";

export function AdminReelAttributionPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getReelsAttribution();
        setRows(data.rows || []);
      } catch {
        setRows([]);
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
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Reels Attribution</h1>
          <p className="text-sm text-slate-500">Reel-to-product performance and revenue attribution.</p>
        </div>
        <Link to="/admin/reels" className="text-sm font-semibold text-orange-600">
          Back to reels
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-900/60">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Reel</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Product</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Views</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Clicks</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Add To Cart</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Orders</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Revenue</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Conversion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                  Loading attribution data...
                </td>
              </tr>
            ) : null}
            {!loading && !rows.length ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                  No attribution data yet.
                </td>
              </tr>
            ) : null}
            {rows.map((row, index) => (
              <tr key={`${row.reel?._id}-${row.product?._id}-${index}`}>
                <td className="px-4 py-4 text-sm font-semibold">{row.reel?.title || "Reel"}</td>
                <td className="px-4 py-4 text-sm">{row.product?.name || "Product"}</td>
                <td className="px-4 py-4 text-sm">{row.views || 0}</td>
                <td className="px-4 py-4 text-sm">{row.clicks || 0}</td>
                <td className="px-4 py-4 text-sm">{row.addToCart || 0}</td>
                <td className="px-4 py-4 text-sm">{row.orders || 0}</td>
                <td className="px-4 py-4 text-sm">{formatCurrency(row.revenue || 0)}</td>
                <td className="px-4 py-4 text-sm">{row.conversionRate || 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
