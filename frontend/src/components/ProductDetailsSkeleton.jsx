/**
 * Gallery-first skeleton that fills the viewport so the shared Layout footer
 * never appears in the initial viewport while the PDP loads.
 */
export function ProductDetailsSkeleton() {
  return (
    <div className="min-h-[calc(100dvh-10rem)] space-y-8 animate-pulse" aria-busy="true" aria-label="Loading product">
      <div className="flex items-center justify-between gap-3">
        <div className="h-8 w-40 rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="h-9 w-24 rounded-lg bg-slate-200 dark:bg-slate-800" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="aspect-[4/5] w-full rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="space-y-5">
          <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-10 w-full max-w-lg rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-8 w-32 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="space-y-2">
            <div className="h-4 w-full max-w-2xl rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-full max-w-xl rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-full max-w-lg rounded bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="flex gap-3 pt-2">
            <div className="h-12 flex-1 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-12 flex-1 rounded-xl bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      </div>
    </div>
  );
}
