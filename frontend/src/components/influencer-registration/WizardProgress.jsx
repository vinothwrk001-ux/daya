import { Check } from "lucide-react";

const labels = [
  "Account Information",
  "Social Verification",
  "Profile Information",
  "Business Information",
  "Payment & Commission",
  "Identity Verification",
  "Review & Submit",
];

export function WizardProgress({ step }) {
  const percent = step === 4 ? 66 : step === 5 ? 83 : Math.round((step / 6) * 100);
  return (
    <aside className="sticky top-20 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Step {step} of 6</div>
          <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{percent}% complete</div>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200">{labels[step - 1]}</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
      </div>
      <ol className="mt-5 grid gap-2" aria-label="Influencer registration progress">
        {labels.slice(0, 6).map((label, index) => {
          const number = index + 1;
          const completed = number < step;
          const current = number === step;
          return (
            <li key={label} aria-current={current ? "step" : undefined} className={`flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold ${current ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : completed ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200" : "bg-slate-50 text-slate-400 dark:bg-slate-950 dark:text-slate-500"}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${current ? "bg-white text-slate-950 dark:bg-slate-950 dark:text-white" : completed ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500 dark:bg-slate-800"}`}>
                {completed ? <Check className="h-3.5 w-3.5" /> : current ? "→" : number}
              </span>
              {label}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
