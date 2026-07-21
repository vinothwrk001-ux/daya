import { useState, lazy, Suspense } from "react";

const DateRangePicker = lazy(() => import("./DateRangePicker").then(module => ({ default: module.DateRangePicker })));

export function ReportingToolbar({
  startDate,
  endDate,
  startTime,
  endTime,
  onDateChange,
  onTimeChange,
  onApply,
  onExport,
  exportingFormat = "",
  disabled = false,
  isDirty = false,
  applyLabel = "Apply filters",
}) {
  const [selectedFormat, setSelectedFormat] = useState("excel");

  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
              <path d="M6 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18h-10.5A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V3a1 1 0 0 1 1-1Zm9.25 6h-10.5a.75.75 0 0 0-.75.75v6.5c0 .414.336.75.75.75h10.5a.75.75 0 0 0 .75-.75v-6.5a.75.75 0 0 0-.75-.75Z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-950 dark:text-white">Date-wise reporting</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Choose a date range, apply filters, and export the same dataset.</div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-4 md:flex-row md:items-end md:gap-4">
          <Suspense fallback={<div className="h-12 w-full md:w-[450px] rounded-xl bg-slate-100 animate-pulse dark:bg-slate-800" />}>
            <DateRangePicker 
              startDate={startDate} 
              endDate={endDate} 
              startTime={startTime} 
              endTime={endTime} 
              onChange={onDateChange} 
              onTimeChange={onTimeChange} 
              disabled={disabled} 
            />
          </Suspense>
          <button
            type="button"
            onClick={onApply}
            disabled={disabled || !isDirty}
            className="h-12 self-start whitespace-nowrap rounded-xl border border-slate-300 px-5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 md:self-auto dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {applyLabel}
          </button>
          <div className="flex flex-col gap-3 sm:flex-row md:ml-auto md:items-end">
            <select
              value={selectedFormat}
              onChange={(event) => setSelectedFormat(event.target.value)}
              disabled={disabled || Boolean(exportingFormat)}
              className="h-12 rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none focus:border-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="csv">Export CSV</option>
              <option value="excel">Export Excel</option>
              <option value="pdf">Export PDF</option>
            </select>
            <button
              type="button"
              onClick={() => onExport(selectedFormat)}
              disabled={disabled || Boolean(exportingFormat)}
              className="h-12 whitespace-nowrap rounded-xl bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
            >
              {exportingFormat ? `Exporting ${exportingFormat.toUpperCase()}...` : "Download report"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
