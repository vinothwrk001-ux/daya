import { useCallback, useEffect, useState } from "react";
import { StatCard } from "../../components/influencer/StatCard";
import { EarningsTable } from "../../components/influencer/EarningsTable";
import { getInfluencerEarnings } from "../../services/influencerCommerceService";

export default function InfluencerEarningsPage() {
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [type, setType] = useState("");
  const [source, setSource] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (nextPage = 1) => {
    setLoading(true);
    setError("");
    try {
      const params = { page: nextPage, limit: 15 };
      if (type) params.type = type;
      if (source) params.source = source;
      if (from) params.from = new Date(from).toISOString();
      if (to) params.to = new Date(to).toISOString();
      const res = await getInfluencerEarnings(params);
      const d = res?.data;
      setSummary(d);
      setRows(Array.isArray(d?.transactions) ? d.transactions : []);
      setPage(d?.page || 1);
      setTotalPages(d?.totalPages || 1);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load earnings.");
    } finally {
      setLoading(false);
    }
  }, [type, source, from, to]);

  useEffect(() => {
    load(1);
  }, [type, source, from, to, load]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Earnings</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Available balance reflects released ledger credits. Pending matches open commission holds.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Available" value={summary?.available ?? 0} format="currency" hint="Ready for payout programs" />
        <StatCard label="Pending (on hold)" value={summary?.pending ?? 0} format="currency" hint="Tied to delivered orders in hold" />
        <StatCard label="Withdrawn" value={summary?.withdrawn ?? 0} format="currency" hint="Processed withdrawals" />
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Filters</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">Type (any)</option>
            <option value="CREDIT">Credit</option>
            <option value="DEBIT">Debit</option>
          </select>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">Source (any)</option>
            <option value="COMMISSION">Commission</option>
            <option value="REVERSAL">Reversal</option>
          </select>
          <input
            type="date"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            type="date"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Transaction history</h2>
        <EarningsTable rows={rows} loading={loading && !rows.length} />
        {totalPages > 1 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium disabled:opacity-40 dark:border-slate-700"
                onClick={() => load(page - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium disabled:opacity-40 dark:border-slate-700"
                onClick={() => load(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {!loading && !rows.length && !error ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">Ledger is empty — earnings appear after attributed orders settle.</p>
      ) : null}
    </div>
  );
}
