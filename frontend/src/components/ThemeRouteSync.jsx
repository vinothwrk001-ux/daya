import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { resolveBreakpointFromWidth, resolvePageKeyFromPath } from "../theme/themeRouteMap";

export function ThemeRouteSync() {
  const location = useLocation();
  const { applyForRoute, loading } = useTheme();

  useEffect(() => {
    if (loading) return;

    const pageKey = resolvePageKeyFromPath(location.pathname);
    const breakpoint = resolveBreakpointFromWidth(window.innerWidth);
    const isThemeBuilder = location.pathname.startsWith("/admin/theme-engine");

    if (isThemeBuilder) return;

    applyForRoute({ pageKey, breakpoint }).catch(() => {});
  }, [applyForRoute, loading, location.pathname]);

  useEffect(() => {
    if (loading) return;

    function handleResize() {
      const pageKey = resolvePageKeyFromPath(window.location.pathname);
      if (window.location.pathname.startsWith("/admin/theme-engine")) return;
      applyForRoute({ pageKey, breakpoint: resolveBreakpointFromWidth(window.innerWidth) }).catch(() => {});
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [applyForRoute, loading]);

  return null;
}
