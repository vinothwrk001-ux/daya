import { buildThemeCssText, resolveEffectiveTheme, themeToCssVariables } from "./themeManager";
import { withCssVarFallbacks } from "./themeDefaults";

const STYLE_ID = "daya-theme-engine-styles";

export function applyCssVariables(variables, { scope = "platform", themeName = "" } = {}) {
  if (typeof document === "undefined" || !variables) return;

  const resolved = withCssVarFallbacks(variables);
  const root = document.documentElement;

  Object.entries(resolved).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  root.setAttribute("data-theme-active", scope);
  if (themeName) {
    root.setAttribute("data-theme-name", themeName);
  }

  injectThemeStyleSheet(buildThemeCssText(resolved));

  if (document.body) {
    document.body.style.background = resolved["--color-background"];
    document.body.style.color = resolved["--color-text-primary"];
    document.body.style.fontFamily = resolved["--font-body"];
  }
}

export function applyThemeConfig(config, options = {}) {
  const variables = config?.cssVariables || themeToCssVariables(config?.globalTheme);
  applyCssVariables(variables, options);
}

export function injectThemeStyleSheet(cssText) {
  if (typeof document === "undefined") return;
  let node = document.getElementById(STYLE_ID);
  if (!node) {
    node = document.createElement("style");
    node.id = STYLE_ID;
    document.head.appendChild(node);
  }
  node.textContent = cssText || "";
}

export function removeThemeStyleSheet() {
  if (typeof document === "undefined") return;
  document.getElementById(STYLE_ID)?.remove();
}

export function applyPreviewTheme(theme, options = {}) {
  const variables = themeToCssVariables(theme);
  applyCssVariables(variables, { ...options, scope: "preview" });
}

export function applyResolvedTheme(themeConfig, resolveOptions = {}, applyOptions = {}) {
  const effective = resolveEffectiveTheme(themeConfig, resolveOptions);
  const variables = themeToCssVariables(effective);
  applyCssVariables(variables, {
    scope: resolveOptions.pageKey || "platform",
    themeName: themeConfig?.name || "",
    ...applyOptions,
  });
  return { effective, variables };
}
