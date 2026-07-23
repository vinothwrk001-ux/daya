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
    fontFamily: {
      sans: ["Poppins", "sans-serif"],
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
        "fluid-sm": ["clamp(0.9375rem, 0.88rem + 0.28vw, 1rem)", { lineHeight: "1.5" }],
        "fluid-base": ["clamp(1rem, 0.92rem + 0.4vw, 1.125rem)", { lineHeight: "1.6" }],
        "fluid-lg": ["clamp(1.125rem, 1.02rem + 0.52vw, 1.25rem)", { lineHeight: "1.5" }],
        "fluid-xl": ["clamp(1.375rem, 1.2rem + 0.87vw, 1.75rem)", { lineHeight: "1.35" }],
        "fluid-2xl": ["clamp(1.75rem, 1.45rem + 1.5vw, 2.25rem)", { lineHeight: "1.25" }],
        "fluid-3xl": ["clamp(2.125rem, 1.75rem + 1.875vw, 2.75rem)", { lineHeight: "1.15" }],
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
      animation: {
        marquee: "marquee 20s linear infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
};
