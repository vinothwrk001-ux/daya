import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_GLOBAL_THEME } from "../theme/tokens";
import { resolveEffectiveTheme, themeToCssVariables } from "../theme/themeManager";
import { applyResolvedTheme } from "../theme/themeRenderer";
import { getPublicTheme } from "../services/themeEngineService";

const ThemeContext = createContext({
  loading: true,
  theme: null,
  cssVariables: {},
  resolveTheme: () => DEFAULT_GLOBAL_THEME,
  applyForRoute: async () => {},
  reload: async () => {},
});

const FALLBACK_THEME = {
  name: "Default",
  themeType: "default",
  globalTheme: DEFAULT_GLOBAL_THEME,
  pageThemes: {},
  sectionThemes: {},
  componentThemes: {},
  mobileTheme: {},
  tabletTheme: {},
  desktopTheme: {},
};

export function ThemeProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(null);
  const themeRef = useRef(null);

  const applyThemeState = useCallback((nextTheme, resolveOptions = {}) => {
    themeRef.current = nextTheme;
    setTheme(nextTheme);
    applyResolvedTheme(nextTheme, resolveOptions, {
      scope: resolveOptions.pageKey || "platform",
      themeName: nextTheme?.name || "",
    });
  }, []);

  const applyForRoute = useCallback(async (resolveOptions = {}) => {
    const source = themeRef.current || FALLBACK_THEME;
    applyResolvedTheme(source, resolveOptions, {
      scope: resolveOptions.pageKey || "platform",
      themeName: source?.name || "",
    });
  }, []);

  const reload = useCallback(async (resolveOptions = {}) => {
    setLoading(true);
    try {
      const nextTheme = await getPublicTheme({ _ts: Date.now() });
      applyThemeState(nextTheme, resolveOptions);
    } catch {
      applyThemeState(FALLBACK_THEME, resolveOptions);
    } finally {
      setLoading(false);
    }
  }, [applyThemeState]);

  useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  useEffect(() => {
    const handleUpdate = () => reload().catch(() => {});
    const handleStorage = (event) => {
      if (event.key === "theme:updated") reload().catch(() => {});
    };
    window.addEventListener("theme:updated", handleUpdate);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("theme:updated", handleUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, [reload]);

  const resolveTheme = useCallback(
    (options = {}) => {
      const source = theme || FALLBACK_THEME;
      return resolveEffectiveTheme(source, options) || DEFAULT_GLOBAL_THEME;
    },
    [theme]
  );

  const cssVariables = useMemo(
    () => theme?.cssVariables || themeToCssVariables(theme?.globalTheme || DEFAULT_GLOBAL_THEME),
    [theme]
  );

  const value = useMemo(
    () => ({ loading, theme, cssVariables, resolveTheme, applyForRoute, reload }),
    [applyForRoute, cssVariables, loading, reload, resolveTheme, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useScopedTheme(options = {}) {
  const { resolveTheme } = useTheme();
  return useMemo(() => resolveTheme(options), [options, resolveTheme]);
}
