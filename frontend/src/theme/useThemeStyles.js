import { useMemo } from "react";
import { useTheme } from "../context/ThemeContext";
import { themeToCssVariables } from "./themeManager";

export function useThemeStyles(options = {}) {
  const { resolveTheme } = useTheme();
  const theme = useMemo(() => resolveTheme(options), [options, resolveTheme]);
  const cssVariables = useMemo(() => themeToCssVariables(theme), [theme]);
  const style = useMemo(() => cssVariables, [cssVariables]);

  return { theme, cssVariables, style };
}

export function useComponentTheme(componentKey, options = {}) {
  return useThemeStyles({ ...options, componentKey });
}

export function usePageTheme(pageKey, options = {}) {
  return useThemeStyles({ ...options, pageKey });
}

export function useSectionTheme(sectionKey, options = {}) {
  return useThemeStyles({ ...options, sectionKey });
}
