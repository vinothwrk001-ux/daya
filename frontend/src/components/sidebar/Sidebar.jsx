import { useState } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Loader, FolderTree, Settings, Users, Wallet, Boxes, Megaphone, Clapperboard, Store } from "lucide-react";
import { SidebarSection } from "./SidebarSection";
import { BrandLogo } from "../BrandLogo";

export function Sidebar({
  open = true,
  onNavigate,
  title,
  subtitle,
  planLabel = "",
  primaryItem,
  sections,
  loading = false,
  error = "",
}) {
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
      className="group fixed inset-y-0 left-0 z-40 flex flex-col border-r border-black bg-brand-secondary text-white backdrop-blur transition-all duration-300 ease-out w-20 hover:w-80 lg:w-20 lg:hover:w-80"
    >
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-white/10 px-3 py-4">
        <BrandLogo showName={false} imgClassName="h-7 w-auto max-w-[44px] object-contain" />
        <div className="hidden truncate text-base font-semibold text-white sm:text-lg group-hover:block">
          {title}
          {subtitle ? <span className="block truncate text-xs font-medium text-white/60">{subtitle}</span> : null}
          {planLabel ? (
            <span className="mt-1 inline-flex max-w-full truncate rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-white ring-1 ring-red-500/30">
              {planLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="border-b border-white/10 px-2 py-3">
        <NavLink
          to={primaryItem.path}
          onClick={() => {
            if (onNavigate) onNavigate();
          }}
          className={({ isActive }) =>
            [
              "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition-colors",
              isActive
                ? "bg-brand-primary text-white"
                : "bg-white/5 text-white/78 hover:bg-white/10 hover:text-white",
            ].join(" ")
          }
        >
          <PrimaryIcon className="h-4 w-4 flex-shrink-0" />
          <span className="hidden truncate group-hover:block">{primaryItem.name}</span>
        </NavLink>
      </div>

        <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
          {loading ? (
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
              <Loader className="h-4 w-4 animate-spin" />
              <span>Loading navigation...</span>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-white">
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
