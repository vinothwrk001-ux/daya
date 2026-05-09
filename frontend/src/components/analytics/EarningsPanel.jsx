import { formatCurrency } from "../../utils/formatCurrency";

export function EarningsPanel({ wallet, ledger = [] }) {
  const credits = ledger.filter((entry) => entry.type === "CREDIT").reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const debits = ledger.filter((entry) => entry.type === "DEBIT").reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Available", value: formatCurrency(wallet?.availableBalance || 0) },
          { label: "Lifetime", value: formatCurrency(wallet?.totalEarnings || 0) },
          { label: "Reversed", value: formatCurrency(wallet?.reversedAmount || 0) },
        ].map((item) => (
          <div key={item.label} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{item.label}</div>
            <div className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">{item.value}</div>
          </div>
        ))}
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
          <div className="text-xs uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">Ledger inflow</div>
          <div className="mt-3 text-2xl font-semibold">{formatCurrency(credits)}</div>
        </div>
        <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-5 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
          <div className="text-xs uppercase tracking-[0.22em] text-rose-600 dark:text-rose-300">Ledger outflow</div>
          <div className="mt-3 text-2xl font-semibold">{formatCurrency(debits)}</div>
        </div>
      </section>
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Recent ledger</h2>
        <div className="mt-4 grid gap-3">
          {ledger.length ? ledger.map((entry) => (
            <div key={entry._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
              <div>
                <div className="font-semibold text-slate-950 dark:text-white">{entry.source}</div>
                <div className="text-slate-500 dark:text-slate-400">{new Date(entry.createdAt).toLocaleString()}</div>
                {entry.meta?.campaignId ? <div className="text-xs text-slate-400 dark:text-slate-500">Campaign linked</div> : null}
              </div>
              <div className={entry.type === "CREDIT" ? "font-semibold text-emerald-600" : "font-semibold text-rose-600"}>
                {entry.type === "CREDIT" ? "+" : "-"}{formatCurrency(entry.amount || 0)}
              </div>
            </div>
          )) : (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No ledger activity yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
