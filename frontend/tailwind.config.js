/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    screens: {
      xs: "360px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1440px",
      "3xl": "1920px",
    },
    extend: {
      colors: {
        brand: {
          primary: "var(--color-primary)",
          primaryHover: "var(--color-primary-hover)",
          secondary: "var(--color-secondary)",
          background: "var(--color-background)",
          surface: "var(--color-surface)",
          surfaceSecondary: "var(--color-surface-secondary)",
          textPrimary: "var(--color-text-primary)",
          textSecondary: "var(--color-text-secondary)",
          border: "var(--color-border)",
          danger: "var(--color-danger)",
          success: "var(--color-success)",
          warning: "var(--color-warning)",
          info: "var(--color-info)",
          accent: "var(--color-accent)",
          card: "var(--color-card)",
        },
      },
      maxWidth: {
        content: "90rem",
        prose: "65ch",
      },
      fontSize: {
        "fluid-sm": ["clamp(0.8125rem, 0.78rem + 0.18vw, 0.875rem)", { lineHeight: "1.5" }],
        "fluid-base": ["clamp(0.9375rem, 0.88rem + 0.28vw, 1rem)", { lineHeight: "1.6" }],
        "fluid-lg": ["clamp(1.0625rem, 0.98rem + 0.42vw, 1.125rem)", { lineHeight: "1.5" }],
        "fluid-xl": ["clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem)", { lineHeight: "1.35" }],
        "fluid-2xl": ["clamp(1.5rem, 1.25rem + 1.25vw, 2rem)", { lineHeight: "1.25" }],
        "fluid-3xl": ["clamp(1.875rem, 1.5rem + 1.875vw, 2.5rem)", { lineHeight: "1.15" }],
      },
      boxShadow: {
        brandSm: "var(--shadow-small)",
        brandMd: "var(--shadow-medium)",
        brandLg: "var(--shadow-large)",
      },
      borderRadius: {
        brandSm: "var(--radius-small)",
        brandMd: "var(--radius-medium)",
        brandLg: "var(--radius-large)",
      },
    },
  },
  plugins: [],
};
