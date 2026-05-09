import { formatCurrency } from "../../utils/formatCurrency";

export function CampaignCard({ campaign, onAccept, onReject, busyId }) {
  const vendorName = campaign.vendorId?.shopName || campaign.vendorId?.companyName || "Vendor";
  const isProposed = campaign.state === "proposed";
  const id = campaign._id;
  const busy = busyId === id;

  return (
    <article className="flex flex-col rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{vendorName}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {campaign.productIds?.length || 0} product{(campaign.productIds?.length || 0) === 1 ? "" : "s"} linked
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {campaign.state}
        </span>
      </div>
      <dl className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300">
        <div className="flex justify-between gap-2">
          <dt>Commission</dt>
          <dd className="font-medium text-slate-900 dark:text-white">{campaign.commissionPercent}%</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Fixed fee</dt>
          <dd className="font-medium text-slate-900 dark:text-white">{formatCurrency(campaign.fixedFee || 0)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Deadline</dt>
          <dd className="font-medium text-slate-900 dark:text-white">
            {campaign.deadline ? new Date(campaign.deadline).toLocaleDateString() : "Open"}
          </dd>
        </div>
      </dl>
      {isProposed && (onAccept || onReject) ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {onAccept ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAccept(campaign)}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              Accept
            </button>
          ) : null}
          {onReject ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onReject(campaign)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Decline
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
