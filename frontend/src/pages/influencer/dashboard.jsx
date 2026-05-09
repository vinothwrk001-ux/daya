import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { StatCard, StatCardSkeleton } from "../../components/influencer/StatCard";
import { EarningsAreaChart } from "../../components/influencer/Chart";
import { getInfluencerDashboard } from "../../services/influencerCommerceService";
import { formatCurrency } from "../../utils/formatCurrency";

export default function InfluencerDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getInfluencerDashboard();
      setData(res?.data ?? null);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load dashboard.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Performance snapshot</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Figures reconcile with the commission ledger and published reel tracking.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard label="Total earnings (lifetime)" value={data?.totalEarnings ?? 0} format="currency" hint="Settled commissions credited" />
            <StatCard
              label="Pending earnings"
              value={data?.pendingEarnings ?? 0}
              format="currency"
              hint="Orders in hold until policy release"
            />
            <StatCard label="Attributed orders" value={data?.totalOrders ?? 0} format="number" />
            <StatCard label="Total clicks" value={data?.totalClicks ?? 0} format="number" hint="Across your reels" />
            <StatCard label="Conversion rate" value={data?.conversionRate ?? 0} format="percent" hint="Orders ÷ clicks" />
          </>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Earnings (30 days)</h2>
          <EarningsAreaChart data={data?.earningsOverTime || []} loading={loading} />
        </div>
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Recent activity</h2>
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            {loading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-slate-100 dark:bg-slate-800" />
                ))}
              </div>
            ) : (data?.recentActivity || []).length ? (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.recentActivity.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0 last:pb-0">
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">{item.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{item.detail}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}
                      </div>
                    </div>
                    <div
                      className={`text-sm font-semibold ${
                        item.entryType === "CREDIT" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {item.entryType === "CREDIT" ? "+" : "-"}
                      {formatCurrency(item.amount)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No recent wallet events.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
