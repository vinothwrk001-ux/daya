/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
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
