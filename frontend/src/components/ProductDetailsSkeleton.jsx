/**
 * Gallery-first skeleton that fills the viewport so the shared Layout footer
 * never appears in the initial viewport while the PDP loads.
 */
export function ProductDetailsSkeleton() {
  return (
    <main className="min-h-[calc(100dvh-10rem)] bg-white py-8 transition-colors duration-300 dark:bg-slate-950 lg:py-12 animate-pulse" aria-busy="true" aria-label="Loading product">
      <div className="mx-auto max-w-[1100px] px-4 xl:px-0 mb-8 flex items-center justify-between gap-3">
        <div className="h-8 w-40 rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="h-9 w-24 rounded-lg bg-slate-200 dark:bg-slate-800" />
      </div>

      <div className="mx-auto flex max-w-[1100px] flex-col gap-10 lg:grid lg:grid-cols-[484px_minmax(0,1fr)] lg:gap-12 px-4 xl:px-0 lg:items-start">
        <div className="w-full max-w-[800px] mx-auto lg:w-[484px] lg:mx-0">
          <div className="aspect-[4/5] w-full rounded-[2rem] bg-slate-200 dark:bg-slate-800 lg:h-[450px]" />
        </div>
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
    </main>
  );
}
