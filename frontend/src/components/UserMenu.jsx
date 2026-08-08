import { logger } from "../services/logger/logger.js";
import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../context/authStore";
import { Portal } from "./Portal";
import * as authService from "../services/authService";

export function UserMenu({ variant = "default" }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    function updatePosition() {
      if (!triggerRef.current) return;

      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = 360;
      const viewportHeight = window.innerHeight;
      const hasSpaceBelow = rect.bottom + menuHeight + 16 < viewportHeight;

      setPosition({
        top: hasSpaceBelow ? rect.bottom + 8 : rect.top - menuHeight - 8,
        left: rect.right - 224,
      });
    }

    if (isOpen) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      return () => window.removeEventListener("resize", updatePosition);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      logger.debug("Server logout response:", { value: error?.response?.status });
    } finally {
      logout();
      setIsOpen(false);
      navigate("/login", { replace: true });
    }
  };

  const handleMenuClick = (path) => {
    if (!path) return;
    navigate(path);
    setIsOpen(false);
  };

  if (!user) return null;

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  const roleColors = {
    admin: "bg-purple-500",
    user: "bg-slate-500",
  };
  const avatarBg = roleColors[user.role] || "bg-slate-500";

  const menuItemsByRole = {
    user: [
      { label: "My Profile", path: "/profile", icon: "P" },
      { label: "My Orders", path: "/orders", icon: "O" },
      { label: "Wishlist", path: "/wishlist", icon: "W" },
    ],
    admin: [{ label: "Dashboard", path: "/dashboard/admin", icon: "D" }],
    super_admin: [{ label: "Dashboard", path: "/dashboard/admin", icon: "D" }],
    support_admin: [{ label: "Dashboard", path: "/dashboard/admin", icon: "D" }],
    finance_admin: [{ label: "Dashboard", path: "/dashboard/admin", icon: "D" }],
  };

  let menuItems = menuItemsByRole[user.role] || [
    { label: "My Profile", path: "/profile", icon: "P" },
    { label: "My Orders", path: "/orders", icon: "O" },
  ];

  const isHero = variant === "hero";
  const triggerClass = isHero
    ? `flex w-auto items-center gap-2 rounded-lg px-2 py-2 transition-all sm:px-3 ${
        isOpen
          ? "bg-white/15 text-white shadow-md"
          : "bg-white/10 text-white hover:bg-white/15"
      }`
    : `flex w-auto items-center gap-2 rounded-lg px-2 py-2 transition-all sm:px-3 ${
        isOpen
          ? "bg-blue-50 shadow-md"
          : "bg-white hover:bg-slate-50"
      }`;
  const nameClass = isHero ? "hidden max-w-[8rem] truncate text-sm font-medium text-white sm:inline" : "hidden max-w-[8rem] truncate text-sm font-medium text-slate-700 sm:inline";
  const chevronClass = isHero ? `hidden sm:block h-4 w-4 text-white/80 transition-transform ${isOpen ? "rotate-180" : ""}` : `hidden sm:block h-4 w-4 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`;
  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={triggerClass}
        aria-label="Open user menu"
        aria-expanded={isOpen}
      >
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarBg}`}
          title={user.name}
        >
          {initials}
        </div>

        <span className={nameClass}>
          {user.name}
        </span>

        <svg
          className={chevronClass}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </button>

      {isOpen && (
        <Portal>
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: `${position.top}px`,
              left: `${position.left}px`,
              zIndex: 50000,
            }}
            className="w-56 origin-top-right rounded-lg border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarBg}`}
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {user.name}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {user.email}
                  </div>
                  <div className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">
                    {user.role}
                  </div>
                </div>
              </div>
            </div>

            <nav className="space-y-0 py-2">
              {menuItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleMenuClick(item.path)}
                  disabled={item.disabled}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-wait disabled:text-slate-400 disabled:hover:bg-white disabled:hover:text-slate-400"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="border-t border-slate-100" />

            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-xs font-semibold text-red-600">
                L
              </span>
              <span>Logout</span>
            </button>
          </div>
        </Portal>
      )}
    </div>
  );
}
