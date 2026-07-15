export const COLOR_TOKENS = [
  { key: "primary", label: "Primary Color" },
  { key: "secondary", label: "Secondary Color" },
  { key: "accent", label: "Accent Color" },
  { key: "background", label: "Background Color" },
  { key: "surface", label: "Surface Color" },
  { key: "card", label: "Card Color" },
  { key: "border", label: "Border Color" },
  { key: "textPrimary", label: "Text Primary" },
  { key: "textSecondary", label: "Text Secondary" },
  { key: "success", label: "Success Color" },
  { key: "warning", label: "Warning Color" },
  { key: "danger", label: "Danger Color" },
  { key: "info", label: "Info Color" },
];

export const TYPOGRAPHY_TOKENS = [
  { key: "fontFamily", label: "Font Family" },
  { key: "headingFont", label: "Heading Font" },
  { key: "bodyFont", label: "Body Font" },
  { key: "buttonFont", label: "Button Font" },
];

export const SPACING_TOKENS = [
  { key: "containerWidth", label: "Container Width" },
  { key: "sectionPadding", label: "Section Padding" },
  { key: "cardPadding", label: "Card Padding" },
  { key: "buttonPadding", label: "Button Padding" },
  { key: "inputPadding", label: "Input Padding" },
  { key: "gridSpacing", label: "Grid Spacing" },
];

export const RADIUS_TOKENS = [
  { key: "card", label: "Card Radius" },
  { key: "button", label: "Button Radius" },
  { key: "input", label: "Input Radius" },
  { key: "modal", label: "Modal Radius" },
  { key: "drawer", label: "Drawer Radius" },
  { key: "container", label: "Container Radius" },
];

export const SHADOW_TOKENS = [
  { key: "card", label: "Card Shadow" },
  { key: "hover", label: "Hover Shadow" },
  { key: "modal", label: "Modal Shadow" },
  { key: "button", label: "Button Shadow" },
  { key: "dropdown", label: "Dropdown Shadow" },
];

export const ANIMATION_TOKENS = [
  { key: "transitionSpeed", label: "Transition Speed" },
  { key: "hoverDuration", label: "Hover Duration" },
  { key: "pageAnimation", label: "Page Animation" },
  { key: "cardAnimation", label: "Card Animation" },
  { key: "buttonAnimation", label: "Button Animation" },
  { key: "modalAnimation", label: "Modal Animation" },
  { key: "reelsAnimation", label: "Reels Animation" },
];

export const DEFAULT_GLOBAL_THEME = {
  colors: {
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
  },
  typography: {
    fontFamily: '"Poppins", sans-serif',
    headingFont: '"Poppins", sans-serif',
    bodyFont: '"Poppins", sans-serif',
    buttonFont: '"Poppins", sans-serif',
  },
  spacing: {
    containerWidth: "1280px",
    sectionPadding: "4rem",
    cardPadding: "1.25rem",
    buttonPadding: "0.75rem 1.5rem",
    inputPadding: "0.75rem 1rem",
    gridSpacing: "1.5rem",
  },
  radius: {
    card: "12px",
    button: "9999px",
    input: "12px",
    modal: "16px",
    drawer: "16px 0 0 16px",
    container: "16px",
  },
  shadows: {
    card: "0 8px 24px -20px rgba(17, 17, 17, 0.42)",
    hover: "0 22px 60px -38px rgba(17, 17, 17, 0.45)",
    modal: "0 32px 100px -48px rgba(17, 17, 17, 0.5)",
    button: "0 4px 14px -6px rgba(17, 17, 17, 0.35)",
    dropdown: "0 12px 40px -16px rgba(17, 17, 17, 0.4)",
  },
  animation: {
    transitionSpeed: "300ms ease",
    hoverDuration: "200ms",
    pageAnimation: "fade 400ms ease",
    cardAnimation: "translateY 300ms ease",
    buttonAnimation: "scale 150ms ease",
    modalAnimation: "fade 250ms ease",
    reelsAnimation: "slide 350ms ease",
  },
};

export function createEmptyThemeForm(name = "New Theme") {
  return {
    name,
    description: "",
    themeType: "custom",
    status: "draft",
    globalTheme: structuredClone(DEFAULT_GLOBAL_THEME),
    pageThemes: {},
    sectionThemes: {},
    componentThemes: {},
    mobileTheme: {},
    tabletTheme: {},
    desktopTheme: {},
    schedule: { enabled: false, startAt: "", endAt: "", timezone: "UTC" },
  };
}
