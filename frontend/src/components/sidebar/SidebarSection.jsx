import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { SidebarItem } from "./SidebarItem";

function itemMatchesPath(item, pathname, search) {
  if (!item) return false;
  const activePath = item.matchPath || item.path;
  if (!activePath) return false;
  if (item.matchSearch) {
    return pathname === activePath && search === item.matchSearch;
  }
  if (item.exact) {
    return pathname === activePath;
  }
  return pathname === activePath || pathname.startsWith(`${activePath}/`);
}

function getActiveGroupKey(items, pathname, search) {
  const activeGroup = items.find((item) => item.children?.some((child) => itemMatchesPath(child, pathname, search)));
  return activeGroup?.key || activeGroup?.name;
}

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
  const location = useLocation();
  const activeGroupKey = useMemo(
    () => getActiveGroupKey(items, location.pathname, location.search),
    [items, location.pathname, location.search],
  );
  const [openGroups, setOpenGroups] = useState(() => (activeGroupKey ? { [activeGroupKey]: true } : {}));

  useEffect(() => {
    if (!activeGroupKey) return;
    setOpenGroups((current) => ({ ...current, [activeGroupKey]: true }));
  }, [activeGroupKey]);

  const toggleGroup = (groupKey) => {
    setOpenGroups((current) => ({ ...current, [groupKey]: !current[groupKey] }));
  };

  return (
    <section className="rounded-brandMd border border-white/10 bg-white/[0.04] p-2 shadow-sm transition-colors duration-200 hover:border-red-500/40 hover:bg-white/[0.07]">
      <button
        id={buttonId}
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={onToggle}
        title={section}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        <span className="flex items-center gap-2">
          {SectionIcon ? <SectionIcon className="h-4 w-4 flex-shrink-0 text-brand-primary" /> : null}
          <span className="hidden truncate group-hover:block">{section}</span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          {badgeCount > 0 ? (
            <span className="inline-flex min-w-6 justify-center rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white">
              {badgeCount}
            </span>
          ) : null}
          <ChevronDown
            className={`h-4 w-4 flex-shrink-0 text-white/60 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      <div
        id={contentId}
        role="region"
        aria-labelledby={buttonId}
        className={`transition-all duration-300 ease-in-out ${isOpen ? "max-h-[min(68vh,720px)] overflow-y-auto overflow-x-hidden pr-1 opacity-100 [scrollbar-color:#E53935_transparent] [scrollbar-width:thin]" : "max-h-0 overflow-hidden opacity-0"}`}
      >
        <div className="space-y-1 px-1 pb-1 pt-2">
          {items.map((item) => {
            if (item.children?.length) {
              const GroupIcon = item.icon;
              const groupKey = item.key || item.name;
              const isGroupOpen = Boolean(openGroups[groupKey]);
              return (
                <div key={item.key || item.name} className="space-y-1">
                  <button
                    type="button"
                    aria-expanded={isGroupOpen}
                    onClick={() => toggleGroup(groupKey)}
                    title={item.name}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-white/55 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  >
                    {GroupIcon ? <GroupIcon className="h-3.5 w-3.5 flex-shrink-0" /> : null}
                    <span className="hidden flex-1 truncate group-hover:block">{item.name}</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 flex-shrink-0 text-white/45 transition-transform duration-200 ${isGroupOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <div className={`${isGroupOpen ? "block" : "hidden"} space-y-1`}>
                    {item.children.map((child) => (
                      <SidebarItem key={child.to || child.path} item={child} onNavigate={onNavigate} collapsed={!isOpen && collapsed} depth={1} />
                    ))}
                  </div>
                </div>
              );
            }
            return <SidebarItem key={item.to || item.path} item={item} onNavigate={onNavigate} collapsed={!isOpen && collapsed} />;
          })}
        </div>
      </div>
    </section>
  );
}
