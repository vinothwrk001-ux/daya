import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboard, getAnalytics, getDailyRevenue } from "../services/adminApi";
import { DailyRevenueChart } from "../components/DailyRevenueChart";
import { StatusBadge } from "../components/StatusBadge";
import { formatCurrency } from "../utils/formatCurrency";
import { useAdminSession } from "../hooks/useAdminSession";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Request failed";
}

export function AdminDashboardPage() {
  const { basePath } = useAdminSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [dailyRevenue, setDailyRevenue] = useState([]);
  const [chartDays, setChartDays] = useState(7);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const [dashboardRes, analyticsRes, dailyRevenueRes] = await Promise.all([
          getDashboard(),
          getAnalytics(),
          getDailyRevenue(chartDays),
        ]);
        if (!alive) return;
        setDashboard(dashboardRes.data);
        setAnalytics(analyticsRes.data);
        setDailyRevenue(Array.isArray(dailyRevenueRes.data) ? dailyRevenueRes.data : []);
      } catch (err) {
        if (alive) setError(normalizeError(err));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [chartDays]);

  const totals = dashboard?.totals || {};
  const queues = dashboard?.queues || {};
  const salesOverview = analytics?.categoryPerformance || [];
  const topProducts = analytics?.highestRevenueProducts || [];

  return (
    <div className="grid min-w-0 max-w-full gap-4 sm:gap-6">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="grid min-w-0 max-w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Total Users" value={loading ? "..." : totals.users ?? 0} tone="slate" />
        <MetricCard label="Total Orders" value={loading ? "..." : totals.orders ?? 0} tone="amber" />
        <MetricCard
          label="Revenue"
          value={loading ? "..." : formatCurrency(totals.revenue || 0)}
          tone="emerald"
        />
      </section>

      {/* Daily Revenue Chart Section */}
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950 dark:text-white sm:text-lg">Daily Revenue</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Revenue ups and downs</p>
          </div>
          <div className="flex gap-2">
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => setChartDays(days)}
                className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                  chartDays === days
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6">
          <DailyRevenueChart data={dailyRevenue} loading={loading} type="bar" />
        </div>
      </section>

      <section className="grid min-w-0 max-w-full gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950 dark:text-white sm:text-lg">Sales Overview</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Last 6 recorded revenue periods</p>
            </div>
            <Link to={`${basePath}/analytics`} className="w-full text-sm font-medium text-blue-600 hover:underline sm:w-auto">
              View analytics
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {loading ? (
              <div className="h-56 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
            ) : salesOverview.length ? (
              salesOverview.map((entry) => (
                <div key={entry.categoryId || entry.categoryName} className="grid min-w-0 grid-cols-[4.25rem_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {entry.categoryName}
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-slate-900 dark:bg-white"
                      style={{
                        width: `${Math.max(
                          12,
                          (entry.revenue / Math.max(...salesOverview.map((item) => item.revenue || 0), 1)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(entry.revenue || 0)}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState text="No revenue data available yet." />
            )}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <h2 className="text-base font-semibold text-slate-950 dark:text-white sm:text-lg">Approval Queue</h2>
            <div className="mt-4 grid gap-3">
              <QueueRow label="Pending products" value={queues.pendingProducts ?? 0} href={`${basePath}/products`} />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white sm:text-lg">Top Products</h2>
              <Link to={`${basePath}/products`} className="w-full text-sm font-medium text-blue-600 hover:underline sm:w-auto">
                Open catalog
              </Link>
            </div>
            <div className="mt-4 grid gap-3">
              {loading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="h-14 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
                ))
              ) : topProducts.length ? (
                topProducts.map((product) => (
                  <div key={product.productId} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{product.productName}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{product.categoryName}</div>
                      </div>
                      <StatusBadge value={product.productStatus} />
                    </div>
                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                      Revenue: {formatCurrency(product.analytics?.totalRevenue || 0)} • Sales: {product.analytics?.salesCount || 0}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState text="No approved product performance yet." />
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, tone }) {
  const tones = {
    slate: "from-slate-950 to-slate-700 text-white",
    blue: "from-blue-600 to-cyan-500 text-white",
    amber: "from-amber-500 to-orange-500 text-white",
    emerald: "from-emerald-500 to-green-500 text-white",
  };

  return (
    <div className={`rounded-3xl bg-gradient-to-br p-4 shadow-sm sm:p-5 ${tones[tone]}`}>
      <div className="text-sm font-medium opacity-90">{label}</div>
      <div className="mt-3 truncate text-2xl font-bold tracking-tight sm:text-3xl">{value}</div>
    </div>
  );
}

function QueueRow({ label, value, href }) {
  return (
    <Link to={href} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
      <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <span className="text-lg font-semibold text-slate-950 dark:text-white">{value}</span>
    </Link>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
      {text}
    </div>
  );
}
