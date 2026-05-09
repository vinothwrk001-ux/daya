import { resolveApiAssetUrl } from "../../utils/resolveUrl";

const STATE_LABEL = {
  uploaded: "Uploaded",
  pending_review: "Pending review",
  approved: "Approved",
  published: "Published",
  rejected: "Rejected",
};

export function ReelCard({ reel }) {
  const src = resolveApiAssetUrl(reel.videoUrl);
  const m = reel.metrics || {};
  const reason = reel.moderation?.notes;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <div className="relative aspect-video bg-slate-950">
        <video src={src} className="h-full w-full object-cover" controls muted playsInline preload="metadata" />
      </div>
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {STATE_LABEL[reel.state] || reel.state}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {reel.campaignId?.vendorId?.shopName || "Campaign"}
          </span>
        </div>
        {reel.caption ? <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{reel.caption}</p> : null}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-slate-50 py-2 dark:bg-slate-800/80">
            <div className="font-semibold text-slate-900 dark:text-white">{m.views ?? 0}</div>
            <div className="text-slate-500 dark:text-slate-400">Views</div>
          </div>
          <div className="rounded-lg bg-slate-50 py-2 dark:bg-slate-800/80">
            <div className="font-semibold text-slate-900 dark:text-white">{m.clicks ?? 0}</div>
            <div className="text-slate-500 dark:text-slate-400">Clicks</div>
          </div>
          <div className="rounded-lg bg-slate-50 py-2 dark:bg-slate-800/80">
            <div className="font-semibold text-slate-900 dark:text-white">{m.orders ?? 0}</div>
            <div className="text-slate-500 dark:text-slate-400">Orders</div>
          </div>
        </div>
        {reel.state === "rejected" && reason ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
            <span className="font-semibold">Reason: </span>
            {reason}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function ReelCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
      <div className="aspect-video bg-slate-200 dark:bg-slate-800" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}
