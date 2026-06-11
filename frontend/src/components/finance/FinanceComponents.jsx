import { NavLink } from "react-router-dom";

export function FinanceTabs({ items = [] }) {
  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                "whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
              ].join(" ")
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export function FinanceModal({ open, title, description, children, footer = null, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-lg rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close modal"
          >
            x
          </button>
        </div>
        <div className="mt-6 space-y-4">{children}</div>
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function FinanceField({ label, hint, children }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
      {children}
      {hint ? <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span> : null}
    </label>
  );
}

export function FinanceInput(props) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition",
        "placeholder:text-slate-400 focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white",
        props.className || "",
      ].join(" ")}
    />
  );
}

export function FinanceTextarea(props) {
  return (
    <textarea
      {...props}
      className={[
        "min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition",
        "placeholder:text-slate-400 focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white",
        props.className || "",
      ].join(" ")}
    />
  );
}

export function FinanceInfoBanner({ tone = "default", title, children }) {
  const toneClass =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
      : tone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100"
        : "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100";

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      {title ? <div className="text-sm font-semibold">{title}</div> : null}
      <div className={title ? "mt-1 text-sm" : "text-sm"}>{children}</div>
    </div>
  );
}

export function FinancePagination({ pagination, disabled = false, onPageChange }) {
  if (!pagination || (pagination.pages || 1) <= 1) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
      <div className="text-slate-500 dark:text-slate-400">
        Page {pagination.page || 1} of {pagination.pages || 1}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled || (pagination.page || 1) <= 1}
          onClick={() => onPageChange(Math.max(1, (pagination.page || 1) - 1))}
          className="rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={disabled || (pagination.page || 1) >= (pagination.pages || 1)}
          onClick={() => onPageChange(Math.min(pagination.pages || 1, (pagination.page || 1) + 1))}
          className="rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function FinanceEmptyState({ title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center dark:border-slate-700">
      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</div>
      {description ? <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</div> : null}
    </div>
  );
}

export function maskAccountNumber(value) {
  const digits = String(value || "").replace(/\s+/g, "");
  if (!digits) return "Not added";
  if (digits.length <= 4) return digits;
  return `${"*".repeat(Math.max(digits.length - 4, 4))}${digits.slice(-4)}`;
}

export function formatFinanceDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatFinanceDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

