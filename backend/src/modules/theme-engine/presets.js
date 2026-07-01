const { createGlobalTheme } = require("./tokens");

const PRESET_THEMES = Object.freeze({
  "modern-saas": {
    name: "Modern SaaS",
    themeType: "modern-saas",
    globalTheme: createGlobalTheme({
      colors: {
        primary: "#6366f1",
        secondary: "#0f172a",
        accent: "#22d3ee",
        background: "#f8fafc",
        surface: "#ffffff",
        card: "#ffffff",
        border: "#e2e8f0",
        textPrimary: "#0f172a",
        textSecondary: "#64748b",
      },
      radius: { card: "16px", button: "10px", input: "10px" },
    }),
  },
  "premium-ecommerce": {
    name: "Premium Ecommerce",
    themeType: "premium-ecommerce",
    globalTheme: createGlobalTheme({
      colors: {
        primary: "#b8860b",
        secondary: "#1a1a1a",
        accent: "#d4af37",
        background: "#faf9f7",
        surface: "#ffffff",
        card: "#ffffff",
        border: "#e8e4dc",
        textPrimary: "#1a1a1a",
        textSecondary: "#6b6560",
      },
      shadows: {
        card: "0 12px 40px -24px rgba(26, 26, 26, 0.25)",
        hover: "0 24px 64px -32px rgba(26, 26, 26, 0.35)",
      },
    }),
  },
  "dark-luxury": {
    name: "Dark Luxury",
    themeType: "dark-luxury",
    globalTheme: createGlobalTheme({
      colors: {
        primary: "#c9a962",
        secondary: "#0a0a0a",
        accent: "#e8d5a3",
        background: "#0a0a0a",
        surface: "#141414",
        card: "#1a1a1a",
        border: "#2a2a2a",
        textPrimary: "#f5f5f5",
        textSecondary: "#a3a3a3",
      },
    }),
  },
  "minimal-white": {
    name: "Minimal White",
    themeType: "minimal-white",
    globalTheme: createGlobalTheme({
      colors: {
        primary: "#111111",
        secondary: "#333333",
        accent: "#666666",
        background: "#ffffff",
        surface: "#ffffff",
        card: "#ffffff",
        border: "#eeeeee",
        textPrimary: "#111111",
        textSecondary: "#777777",
      },
      radius: { card: "4px", button: "4px", input: "4px" },
      shadows: {
        card: "none",
        hover: "0 4px 20px -8px rgba(0,0,0,0.08)",
      },
    }),
  },
  "creative-studio": {
    name: "Creative Studio",
    themeType: "creative-studio",
    globalTheme: createGlobalTheme({
      colors: {
        primary: "#ec4899",
        secondary: "#7c3aed",
        accent: "#f97316",
        background: "#fdf4ff",
        surface: "#ffffff",
        card: "#ffffff",
        border: "#f5d0fe",
        textPrimary: "#581c87",
        textSecondary: "#9333ea",
      },
    }),
  },
  "fashion-store": {
    name: "Fashion Store",
    themeType: "fashion-store",
    globalTheme: createGlobalTheme({
      colors: {
        primary: "#000000",
        secondary: "#1c1c1c",
        accent: "#e11d48",
        background: "#ffffff",
        surface: "#fafafa",
        card: "#ffffff",
        border: "#e5e5e5",
        textPrimary: "#000000",
        textSecondary: "#525252",
      },
      typography: {
        headingFont: '"Playfair Display", Georgia, serif',
        bodyFont: '"Manrope", sans-serif',
      },
    }),
  },
  glassmorphism: {
    name: "Glassmorphism",
    themeType: "glassmorphism",
    globalTheme: createGlobalTheme({
      colors: {
        primary: "#818cf8",
        secondary: "#312e81",
        accent: "#a5b4fc",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        surface: "rgba(255, 255, 255, 0.15)",
        card: "rgba(255, 255, 255, 0.2)",
        border: "rgba(255, 255, 255, 0.3)",
        textPrimary: "#ffffff",
        textSecondary: "rgba(255, 255, 255, 0.8)",
      },
      radius: { card: "20px", button: "12px", input: "12px" },
    }),
  },
  "neo-brutalism": {
    name: "Neo Brutalism",
    themeType: "neo-brutalism",
    globalTheme: createGlobalTheme({
      colors: {
        primary: "#ffeb3b",
        secondary: "#000000",
        accent: "#ff5722",
        background: "#fff9c4",
        surface: "#ffffff",
        card: "#ffffff",
        border: "#000000",
        textPrimary: "#000000",
        textSecondary: "#333333",
      },
      radius: { card: "0", button: "0", input: "0" },
      shadows: {
        card: "4px 4px 0 #000000",
        hover: "6px 6px 0 #000000",
        button: "3px 3px 0 #000000",
      },
    }),
  },
  "corporate-pro": {
    name: "Corporate Pro",
    themeType: "corporate-pro",
    globalTheme: createGlobalTheme({
      colors: {
        primary: "#1e40af",
        secondary: "#1e3a8a",
        accent: "#3b82f6",
        background: "#f1f5f9",
        surface: "#ffffff",
        card: "#ffffff",
        border: "#cbd5e1",
        textPrimary: "#0f172a",
        textSecondary: "#475569",
      },
    }),
  },
});

function getPresetList() {
  return Object.entries(PRESET_THEMES).map(([key, preset]) => ({
    key,
    name: preset.name,
    themeType: preset.themeType,
  }));
}

function getPresetTheme(key) {
  const preset = PRESET_THEMES[key];
  if (!preset) return null;
  return JSON.parse(JSON.stringify(preset));
}

module.exports = {
  PRESET_THEMES,
  getPresetList,
  getPresetTheme,
};
