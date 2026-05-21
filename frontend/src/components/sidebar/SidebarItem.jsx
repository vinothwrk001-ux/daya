import { NavLink } from "react-router-dom";

export function SidebarItem({ item, onNavigate, collapsed = false }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      title={item.name}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
          isActive
            ? "bg-indigo-500 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
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
