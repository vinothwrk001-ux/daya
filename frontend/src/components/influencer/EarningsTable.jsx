import { formatCurrency } from "../../utils/formatCurrency";

export function EarningsTable({ rows = [], loading }) {
  if (loading) {
    return (
      <div className="animate-pulse space-y-2 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        No transactions match your filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
        <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-right">Balance after</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row) => (
            <tr key={row._id} className="text-slate-700 dark:text-slate-200">
              <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
              </td>
              <td className="px-4 py-3 font-medium">{row.type}</td>
              <td className="px-4 py-3">{row.source}</td>
              <td
                className={`px-4 py-3 text-right font-semibold ${
                  row.type === "CREDIT" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {row.type === "CREDIT" ? "+" : "-"}
                {formatCurrency(row.amount || 0)}
              </td>
              <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatCurrency(row.balanceAfter || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
