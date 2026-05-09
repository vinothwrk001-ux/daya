import { formatCurrency } from "../../utils/formatCurrency";

export function StatCard({ label, value, format = "text", hint, className = "" }) {
  const display =
    format === "currency"
      ? formatCurrency(value)
      : format === "percent"
        ? `${Number(value || 0).toFixed(2)}%`
        : format === "number"
          ? new Intl.NumberFormat("en-IN").format(Number(value || 0))
          : value;

  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 ${className}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{display}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div> : null}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100/80 p-4 dark:border-slate-800 dark:bg-slate-800/50">
      <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mt-3 h-8 w-32 rounded bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}
