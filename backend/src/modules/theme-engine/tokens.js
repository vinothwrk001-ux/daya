const COLOR_DEFAULTS = Object.freeze({
  primary: "#e53935",
  secondary: "#111111",
  accent: "#f97316",
  background: "#ffffff",
  surface: "#ffffff",
  card: "#ffffff",
  border: "#e5e5e5",
  textPrimary: "#111111",
  textSecondary: "#555555",
  success: "#16a34a",
  warning: "#f59e0b",
  danger: "#dc2626",
  info: "#2563eb",
});

const TYPOGRAPHY_DEFAULTS = Object.freeze({
  fontFamily: '"Manrope", sans-serif',
  headingFont: '"Space Grotesk", "Manrope", sans-serif',
  bodyFont: '"Manrope", sans-serif',
  buttonFont: '"Manrope", sans-serif',
  fontSizes: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
  },
  lineHeights: {
    tight: "1.25",
    normal: "1.5",
    relaxed: "1.625",
  },
  letterSpacing: {
    tight: "-0.025em",
    normal: "0",
    wide: "0.025em",
  },
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
});

const SPACING_DEFAULTS = Object.freeze({
  containerWidth: "1280px",
  sectionPadding: "4rem",
  cardPadding: "1.25rem",
  buttonPadding: "0.75rem 1.5rem",
  inputPadding: "0.75rem 1rem",
  gapSizes: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
  },
  gridSpacing: "1.5rem",
});

const RADIUS_DEFAULTS = Object.freeze({
  card: "12px",
  button: "9999px",
  input: "12px",
  modal: "16px",
  drawer: "16px 0 0 16px",
  container: "16px",
});

const SHADOW_DEFAULTS = Object.freeze({
  card: "0 8px 24px -20px rgba(17, 17, 17, 0.42)",
  hover: "0 22px 60px -38px rgba(17, 17, 17, 0.45)",
  modal: "0 32px 100px -48px rgba(17, 17, 17, 0.5)",
  button: "0 4px 14px -6px rgba(17, 17, 17, 0.35)",
  dropdown: "0 12px 40px -16px rgba(17, 17, 17, 0.4)",
});

const ANIMATION_DEFAULTS = Object.freeze({
  transitionSpeed: "300ms ease",
  hoverDuration: "200ms",
  pageAnimation: "fade 400ms ease",
  cardAnimation: "translateY 300ms ease",
  buttonAnimation: "scale 150ms ease",
  modalAnimation: "fade 250ms ease",
  reelsAnimation: "slide 350ms ease",
});

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createGlobalTheme(overrides = {}) {
  return {
    colors: { ...COLOR_DEFAULTS, ...(overrides.colors || {}) },
    typography: {
      ...TYPOGRAPHY_DEFAULTS,
      ...(overrides.typography || {}),
      fontSizes: { ...TYPOGRAPHY_DEFAULTS.fontSizes, ...(overrides.typography?.fontSizes || {}) },
      lineHeights: { ...TYPOGRAPHY_DEFAULTS.lineHeights, ...(overrides.typography?.lineHeights || {}) },
      letterSpacing: { ...TYPOGRAPHY_DEFAULTS.letterSpacing, ...(overrides.typography?.letterSpacing || {}) },
      fontWeight: { ...TYPOGRAPHY_DEFAULTS.fontWeight, ...(overrides.typography?.fontWeight || {}) },
    },
    spacing: {
      ...SPACING_DEFAULTS,
      ...(overrides.spacing || {}),
      gapSizes: { ...SPACING_DEFAULTS.gapSizes, ...(overrides.spacing?.gapSizes || {}) },
    },
    radius: { ...RADIUS_DEFAULTS, ...(overrides.radius || {}) },
    shadows: { ...SHADOW_DEFAULTS, ...(overrides.shadows || {}) },
    animation: { ...ANIMATION_DEFAULTS, ...(overrides.animation || {}) },
  };
}

function createEmptyThemeLayers() {
  return {
    pageThemes: {},
    sectionThemes: {},
    componentThemes: {},
    mobileTheme: {},
    tabletTheme: {},
    desktopTheme: {},
  };
}

module.exports = {
  ANIMATION_DEFAULTS,
  COLOR_DEFAULTS,
  RADIUS_DEFAULTS,
  SHADOW_DEFAULTS,
  SPACING_DEFAULTS,
  TYPOGRAPHY_DEFAULTS,
  createEmptyThemeLayers,
  createGlobalTheme,
  deepClone,
};
