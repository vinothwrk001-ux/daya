import { formatCurrency } from "../../utils/formatCurrency";

export function CampaignPanel({ title, subtitle, campaigns = [], actionLabel, onAction }) {
  const stateCounts = campaigns.reduce((accumulator, campaign) => {
    const key = campaign.state || "unknown";
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="text-xl font-semibold text-slate-950 dark:text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(stateCounts).map(([state, count]) => (
          <div key={state} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {state} · {count}
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4">
        {campaigns.length ? campaigns.map((campaign) => (
          <article key={campaign._id} className="rounded-[1.5rem] border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-slate-950 dark:text-white">
                  {campaign.vendorId?.shopName || campaign.influencerId?.userId?.name || "Campaign"}
                </div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {campaign.productIds?.length || 0} linked products
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {campaign.state}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300">
              <div>Commission: {campaign.commissionPercent}%</div>
              <div>Fixed fee: {formatCurrency(campaign.fixedFee || 0)}</div>
              <div>Deadline: {campaign.deadline ? new Date(campaign.deadline).toLocaleDateString() : "Open"}</div>
              {campaign.termsFrozen?.frozenAt ? <div>Terms frozen: {new Date(campaign.termsFrozen.frozenAt).toLocaleString()}</div> : null}
            </div>
            {actionLabel && onAction ? (
              <button
                type="button"
                onClick={() => onAction(campaign)}
                disabled={campaign.state !== "proposed"}
                className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950"
              >
                {actionLabel}
              </button>
            ) : null}
          </article>
        )) : (
          <div className="rounded-[1.5rem] border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No campaigns yet.
          </div>
        )}
      </div>
    </section>
  );
}
