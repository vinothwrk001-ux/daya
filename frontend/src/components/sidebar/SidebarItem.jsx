import { NavLink, useLocation } from "react-router-dom";

export function SidebarItem({ item, onNavigate, collapsed = false, depth = 0 }) {
  const Icon = item.icon;
  const location = useLocation();
  const target = item.to || item.path;
  const activePath = item.matchPath || item.path;
  const isQueryActive = item.matchSearch
    ? location.pathname === activePath && location.search === item.matchSearch
    : null;

  return (
    <NavLink
      to={target}
      end={item.exact}
      title={item.name}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
          depth > 0 ? "ml-5 border-l border-white/10 pl-4" : "",
          (isQueryActive ?? isActive)
            ? "bg-brand-primary text-white shadow-sm"
            : "text-white/70 hover:bg-white/10 hover:text-white",
        ].join(" ")
      }
    >
      {Icon ? <Icon className="h-4 w-4 flex-shrink-0" /> : null}
      {!collapsed ? <span className="truncate">{item.name}</span> : null}
      {item.badgeCount > 0 && !collapsed ? (
        <span className="ml-auto inline-flex flex-shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white">
          {item.badgeCount}
        </span>
      ) : null}
    </NavLink>
  );
}
