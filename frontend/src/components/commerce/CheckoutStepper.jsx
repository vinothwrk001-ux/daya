const STEPS = [
  { key: "address", label: "Address" },
  { key: "summary", label: "Order Summary" },
  { key: "payment", label: "Payment" },
];

export function CheckoutStepper({ currentStep = "address", onStepChange, unlockedSteps = [] }) {
  const currentIndex = STEPS.findIndex((step) => step.key === currentStep);

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-3 sm:p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 w-full min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
        {STEPS.map((step, index) => {
          const isComplete = currentIndex > index;
          const isActive = currentStep === step.key;
          const isUnlocked = unlockedSteps.includes(step.key) || isComplete || isActive;

          return (
            <div key={step.key} className="flex min-w-[88px] flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => isUnlocked && onStepChange?.(step.key)}
                className={`flex items-center gap-3 text-left transition ${
                  isUnlocked ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                }`}
                disabled={!isUnlocked}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold ${
                    isComplete
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : isActive
                        ? "border-[color:var(--commerce-accent)] bg-[color:var(--commerce-accent)] text-white"
                        : "border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400"
                  }`}
                >
                  {isComplete ? "OK" : index + 1}
                </span>
                <span className="hidden text-sm font-medium text-slate-700 dark:text-slate-200 sm:block">{step.label}</span>
              </button>

              {index < STEPS.length - 1 ? (
                <div
                  className={`hidden h-px flex-1 sm:block ${
                    currentIndex > index ? "bg-emerald-400" : "bg-slate-200 dark:bg-slate-700"
                  }`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
