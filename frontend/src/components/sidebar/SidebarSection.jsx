import { ChevronDown } from "lucide-react";
import { SidebarItem } from "./SidebarItem";

export function SidebarSection({
  section,
  sectionIcon: SectionIcon,
  items,
  badgeCount = 0,
  isOpen,
  onToggle,
  onNavigate,
  contentId,
  buttonId,
  collapsed = false,
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white/80 p-2 shadow-sm transition-colors duration-200 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-slate-700 dark:hover:bg-slate-800">
      <button
        id={buttonId}
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={onToggle}
        title={section}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:text-white dark:hover:bg-slate-800"
      >
        <span className="flex items-center gap-2">
          {SectionIcon ? <SectionIcon className="h-4 w-4 flex-shrink-0 text-slate-600 dark:text-slate-300" /> : null}
          <span className="hidden truncate group-hover:block">{section}</span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          {badgeCount > 0 ? (
            <span className="inline-flex min-w-6 justify-center rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white">
              {badgeCount}
            </span>
          ) : null}
          <ChevronDown
            className={`h-4 w-4 flex-shrink-0 text-slate-500 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      <div
        id={contentId}
        role="region"
        aria-labelledby={buttonId}
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="space-y-1 px-1 pb-1 pt-2">
          {items.map((item) => (
            <SidebarItem key={item.to || item.path} item={item} onNavigate={onNavigate} collapsed={!isOpen && collapsed} />
          ))}
        </div>
      </div>
    </section>
  );
}
