import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStaffAuthStore } from "../../context/staffAuthStore";
import * as staffAuthService from "../../services/staffAuthService";

export function StaffTopbar({ user, role, permissions, module, onMenuToggle }) {
  const navigate = useNavigate();
  const logout = useStaffAuthStore((state) => state.logout);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);

  // Update dropdown position when opened
  useEffect(() => {
    function updateDropdownPosition() {
      if (!triggerRef.current) return;

      const rect = triggerRef.current.getBoundingClientRect();
      const dropdownHeight = 280; // Approximate dropdown height
      const viewportHeight = window.innerHeight;
      
      // Check if there's enough space below
      const hasSpaceBelow = rect.bottom + dropdownHeight + 16 < viewportHeight;
      
      if (hasSpaceBelow) {
        // Position below the trigger
        setDropdownPosition({
          top: rect.bottom + 8,
          left: rect.right - 256, // Align right edge (w-64 = 256px)
        });
      } else {
        // Position above the trigger
        setDropdownPosition({
          top: rect.top - dropdownHeight - 8,
          left: rect.right - 256,
        });
      }
    }

    if (dropdownOpen) {
      updateDropdownPosition();
      window.addEventListener("resize", updateDropdownPosition);
      return () => window.removeEventListener("resize", updateDropdownPosition);
    }
  }, [dropdownOpen]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          triggerRef.current && !triggerRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }

    return undefined;
  }, [dropdownOpen]);

  async function handleLogout() {
    try {
      await staffAuthService.logout();
    } finally {
      logout();
      navigate("/login", { replace: true });
    }
  }

  const activePermissionCount = Object.values(permissions || {}).reduce(
    (count, actions) => count + Object.values(actions || {}).filter(Boolean).length,
    0
  );

  const initials = String(user?.name || "ST")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={onMenuToggle}
            className="rounded-xl p-2 hover:bg-slate-100 lg:hidden"
            aria-label="Toggle staff navigation"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Staff workspace</div>
            <h1 className="truncate text-xl font-semibold text-slate-950">{module?.name || "Dashboard"}</h1>
            <p className="truncate text-sm text-slate-500">{module?.description || "Permission-based internal operations"}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 md:flex">
            <ShieldIcon className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-medium text-slate-600">{activePermissionCount} active permissions</span>
          </div>

          <button type="button" className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            <BellIcon className="h-5 w-5" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500" />
          </button>

          <div className="relative" ref={dropdownRef}>
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setDropdownOpen((current) => !current)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-100"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-800">
                {initials}
              </div>
              <div className="hidden text-left sm:block">
                <div className="text-sm font-medium text-slate-950">{user?.name || "Staff"}</div>
                <div className="text-xs text-slate-500">{role?.name || "No role assigned"}</div>
              </div>
              <ChevronDownIcon className={`h-4 w-4 text-slate-500 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen ? (
              <div
                ref={dropdownRef}
                style={{
                  position: "fixed",
                  top: `${dropdownPosition.top}px`,
                  left: `${dropdownPosition.left}px`,
                  zIndex: 9999,
                }}
                className="w-64 rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5"
              >
                <div className="border-b border-slate-200 px-4 py-3">
                  <div className="text-sm font-medium text-slate-950">{user?.name || "Staff"}</div>
                  <div className="text-xs text-slate-500">{user?.email}</div>
                  <div className="mt-2 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {role?.name || "No role"}
                  </div>
                </div>

                <div className="border-b border-slate-200 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Visible modules</div>
                  <div className="mt-2 text-sm text-slate-600">
                    {Object.entries(permissions || {})
                      .filter(([, actions]) => Object.values(actions || {}).some(Boolean))
                      .map(([name]) => name)
                      .join(", ") || "No permissions"}
                  </div>
                </div>

                <div className="p-2">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                  >
                    <LogoutIcon className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

function IconBase({ className = "h-4 w-4", children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function BellIcon({ className }) {
  return (
    <IconBase className={className}>
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M10 17a2 2 0 0 0 4 0" />
    </IconBase>
  );
}

function ChevronDownIcon({ className }) {
  return (
    <IconBase className={className}>
      <path d="m6 9 6 6 6-6" />
    </IconBase>
  );
}

function LogoutIcon({ className }) {
  return (
    <IconBase className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </IconBase>
  );
}

function ShieldIcon({ className }) {
  return (
    <IconBase className={className}>
      <path d="M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-3Z" />
      <path d="m9.5 12 1.8 1.8 3.7-4.3" />
    </IconBase>
  );
}
