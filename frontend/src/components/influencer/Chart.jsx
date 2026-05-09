import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "../../utils/formatCurrency";

export function EarningsAreaChart({ data = [], loading }) {
  if (loading) {
    return (
      <div className="flex h-[280px] animate-pulse items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
        <span className="text-sm text-slate-500">Loading chart…</span>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="flex h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 text-center dark:border-slate-700 dark:bg-slate-900/40">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No earnings in this window yet</p>
        <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
          When commissions settle, they appear here for trend visibility.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[280px] w-full rounded-2xl border border-slate-200/80 bg-white/90 p-2 pt-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fillEarnings" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={56} tickFormatter={(v) => `₹${v}`} />
          <Tooltip
            formatter={(value) => [formatCurrency(value), "Earnings"]}
            labelFormatter={(label) => label}
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
          />
          <Area type="monotone" dataKey="amount" stroke="#4f46e5" fill="url(#fillEarnings)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
