import { useEffect, useState } from "react";
import { getInfluencerAnalytics } from "../../services/influencerCommerceService";
import { formatCurrency } from "../../utils/formatCurrency";

export default function InfluencerAnalyticsPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    getInfluencerAnalytics().then((response) => setData(response?.data)).catch(() => setData(null));
  }, []);

  const stats = [
    ["Store Views", data?.storeViews || 0],
    ["Profile Visits", data?.profileVisits || 0],
    ["Followers", data?.followers || 0],
    ["Affiliate Clicks", data?.affiliateClicks || 0],
    ["Orders", data?.orders || 0],
    ["Revenue Generated", formatCurrency(data?.revenueGenerated || 0)],
    ["Conversion Rate", `${data?.conversionRate || 0}%`],
    ["Average Order Value", formatCurrency(data?.averageOrderValue || 0)],
    ["Commission Earned", formatCurrency(data?.commissionEarned || 0)],
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-black text-slate-950 dark:text-white">Analytics Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Storefront, affiliate, revenue, and conversion metrics for your creator commerce activity.</p>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
            <div className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{value}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
