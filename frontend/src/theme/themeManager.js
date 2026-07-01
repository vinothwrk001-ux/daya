import { CSS_VAR_FALLBACKS, withCssVarFallbacks } from "./themeDefaults";
import { DEFAULT_GLOBAL_THEME } from "./tokens";

export function deepMerge(base, override) {
  if (!override || typeof override !== "object") return base;
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === "object" && !Array.isArray(value) && result[key] && typeof result[key] === "object") {
      result[key] = deepMerge(result[key], value);
    } else if (value !== undefined && value !== null && value !== "") {
      result[key] = value;
    }
  }
  return result;
}

export function resolveEffectiveTheme(config, options = {}) {
  if (!config) return structuredClone(DEFAULT_GLOBAL_THEME);
  const { pageKey, sectionKey, componentKey, breakpoint = "desktop" } = options;
  let merged = structuredClone(config.globalTheme || DEFAULT_GLOBAL_THEME);

  const breakpointTheme =
    breakpoint === "mobile"
      ? config.mobileTheme
      : breakpoint === "tablet"
        ? config.tabletTheme
        : config.desktopTheme;
  merged = deepMerge(merged, breakpointTheme || {});

  if (pageKey && config.pageThemes?.[pageKey]) {
    merged = deepMerge(merged, config.pageThemes[pageKey]);
  }
  if (sectionKey && config.sectionThemes?.[sectionKey]) {
    merged = deepMerge(merged, config.sectionThemes[sectionKey]);
  }
  if (componentKey && config.componentThemes?.[componentKey]) {
    merged = deepMerge(merged, config.componentThemes[componentKey]);
  }

  return merged;
}

function resolveInputColors(colors = {}) {
  const textPrimary = colors.textPrimary || DEFAULT_GLOBAL_THEME.colors.textPrimary;
  const isLightText = /^#(fff|ffffff|fefefe|fafafa)/i.test(String(textPrimary).trim()) || /^rgba?\(\s*255\s*,/i.test(String(textPrimary).trim());

  return {
    inputText: colors.inputText || (isLightText ? colors.secondary || "#111111" : textPrimary),
    inputBackground: colors.inputBackground || "#ffffff",
    inputPlaceholder: colors.inputPlaceholder || (isLightText ? "#64748b" : colors.textSecondary || "#64748b"),
  };
}

export function themeToCssVariables(theme) {
  const colors = { ...DEFAULT_GLOBAL_THEME.colors, ...(theme?.colors || {}) };
  const typography = { ...DEFAULT_GLOBAL_THEME.typography, ...(theme?.typography || {}) };
  const spacing = { ...DEFAULT_GLOBAL_THEME.spacing, ...(theme?.spacing || {}) };
  const radius = { ...DEFAULT_GLOBAL_THEME.radius, ...(theme?.radius || {}) };
  const shadows = { ...DEFAULT_GLOBAL_THEME.shadows, ...(theme?.shadows || {}) };
  const animation = { ...DEFAULT_GLOBAL_THEME.animation, ...(theme?.animation || {}) };
  const inputColors = resolveInputColors(colors);

  return withCssVarFallbacks({
    "--color-primary": colors.primary,
    "--color-primary-hover": colors.secondary,
    "--color-secondary": colors.secondary,
    "--color-accent": colors.accent,
    "--color-background": colors.background,
    "--color-surface": colors.surface,
    "--color-surface-secondary": colors.surface,
    "--color-card": colors.card,
    "--color-border": colors.border,
    "--color-text-primary": colors.textPrimary,
    "--color-text-secondary": colors.textSecondary,
    "--color-success": colors.success,
    "--color-warning": colors.warning,
    "--color-danger": colors.danger,
    "--color-info": colors.info,
    "--color-input-text": inputColors.inputText,
    "--color-input-background": inputColors.inputBackground,
    "--color-input-placeholder": inputColors.inputPlaceholder,
    "--font-family": typography.fontFamily,
    "--font-heading": typography.headingFont || typography.fontFamily,
    "--font-body": typography.bodyFont || typography.fontFamily,
    "--font-button": typography.buttonFont || typography.fontFamily,
    "--container-width": spacing.containerWidth,
    "--section-padding": spacing.sectionPadding,
    "--card-padding": spacing.cardPadding,
    "--button-padding": spacing.buttonPadding,
    "--input-padding": spacing.inputPadding,
    "--grid-spacing": spacing.gridSpacing,
    "--radius-card": radius.card,
    "--radius-button": radius.button,
    "--radius-input": radius.input,
    "--radius-modal": radius.modal,
    "--radius-drawer": radius.drawer,
    "--radius-container": radius.container,
    "--radius-small": radius.input,
    "--radius-medium": radius.card,
    "--radius-large": radius.container,
    "--shadow-card": shadows.card,
    "--shadow-hover": shadows.hover,
    "--shadow-modal": shadows.modal,
    "--shadow-button": shadows.button,
    "--shadow-dropdown": shadows.dropdown,
    "--shadow-small": shadows.card,
    "--shadow-medium": shadows.hover,
    "--shadow-large": shadows.modal,
    "--transition-standard": animation.transitionSpeed,
    "--animation-hover": animation.hoverDuration,
    "--animation-page": animation.pageAnimation,
    "--animation-card": animation.cardAnimation,
    "--animation-button": animation.buttonAnimation,
    "--animation-modal": animation.modalAnimation,
    "--animation-reels": animation.reelsAnimation,
    "--commerce-accent": colors.primary,
    "--commerce-accent-warm": colors.accent,
  });
}

export function buildThemeCssText(variables) {
  const lines = Object.entries(withCssVarFallbacks(variables)).map(([key, value]) => `  ${key}: ${value};`);
  return `:root {\n${lines.join("\n")}\n}\n\nbody {\n  background: var(--color-background);\n  color: var(--color-text-primary);\n  font-family: var(--font-body);\n}\n\nh1, h2, h3, .font-display {\n  font-family: var(--font-heading);\n  color: var(--color-text-primary);\n}\n\n.enterprise-shell {\n  background: var(--color-background);\n  color: var(--color-text-primary);\n}\n\ninput,\ntextarea,\nselect {\n  color: var(--color-input-text);\n  background-color: var(--color-input-background);\n  border-color: var(--color-border);\n}\n\ninput::placeholder,\ntextarea::placeholder {\n  color: var(--color-input-placeholder);\n  opacity: 1;\n}\n\ninput:-webkit-autofill,\ninput:-webkit-autofill:hover,\ninput:-webkit-autofill:focus,\ntextarea:-webkit-autofill,\nselect:-webkit-autofill {\n  -webkit-text-fill-color: var(--color-input-text);\n  box-shadow: 0 0 0 1000px var(--color-input-background) inset;\n}\n`;
}

export { CSS_VAR_FALLBACKS };
