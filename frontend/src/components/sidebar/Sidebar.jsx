import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Loader, FolderTree, Settings, Users, Wallet, Boxes, Megaphone, Clapperboard, Store } from "lucide-react";
import { SidebarSection } from "./SidebarSection";
import { BrandLogo } from "../BrandLogo";

function pathMatches(pathname, targetPath) {
  return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
}

export function Sidebar({
  open = true,
  onNavigate,
  title,
  subtitle,
  primaryItem,
  sections,
  loading = false,
  error = "",
}) {
  const location = useLocation();
  const PrimaryIcon = primaryItem.icon || LayoutDashboard;

  const SECTION_ICONS = {
    overview: LayoutDashboard,
    management: Users,
    catalog: FolderTree,
    finance: Wallet,
    withdrawals: Wallet,
    workspace: Settings,
    collection: Boxes,
    storefront: Store,
    growth: Megaphone,
    content: Clapperboard,
    campaigns: Megaphone,
    verification: Settings,
    profileSettings: Users,
  };

  const [openSection, setOpenSection] = useState(null);

  if (!open) {
    return null;
  }

  return (
    <aside
      className="group fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-slate-50/95 backdrop-blur transition-all duration-300 ease-out dark:border-slate-800 dark:bg-slate-950/95 w-20 hover:w-80 lg:w-20 lg:hover:w-80"
    >
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-slate-200 px-3 py-4 dark:border-slate-800">
        <BrandLogo showName={false} imgClassName="h-7 w-auto max-w-[44px] object-contain" />
        <div className="hidden truncate text-base font-semibold text-slate-950 dark:text-white sm:text-lg group-hover:block">
          {title}
        </div>
      </div>

      <div className="border-b border-slate-200 px-2 py-3 dark:border-slate-800">
        <NavLink
          to={primaryItem.path}
          onClick={() => {
            if (onNavigate) onNavigate();
          }}
          className={({ isActive }) =>
            [
              "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition-colors",
              isActive
                ? "bg-indigo-500 text-white"
                : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
            ].join(" ")
          }
        >
          <PrimaryIcon className="h-4 w-4 flex-shrink-0" />
          <span className="hidden truncate group-hover:block">{primaryItem.name}</span>
        </NavLink>
      </div>

        <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
          {loading ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              <Loader className="h-4 w-4 animate-spin" />
              <span>Loading navigation...</span>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200">
              {error}
            </div>
          ) : null}

          {sections.map((section) => (
            <div
              key={section.key}
              onMouseEnter={() => setOpenSection(section.key)}
              onMouseLeave={() => setOpenSection(null)}
            >
              <SidebarSection
                section={section.section}
                sectionIcon={SECTION_ICONS[section.key]}
                items={section.items}
                badgeCount={section.badgeCount}
                isOpen={openSection === section.key}
                onToggle={() =>
                  setOpenSection((current) => (current === section.key ? null : section.key))
                }
                onNavigate={() => {
                  if (onNavigate) onNavigate();
                }}
                contentId={`sidebar-section-${section.key}`}
                buttonId={`sidebar-trigger-${section.key}`}
                collapsed={true}
              />
            </div>
          ))}
        </nav>
      </aside>
  );
}
