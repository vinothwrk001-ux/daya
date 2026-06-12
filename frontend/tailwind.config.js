/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#E53935",
          primaryHover: "#111111",
          secondary: "#111111",
          background: "#FFFFFF",
          surface: "#FFFFFF",
          surfaceSecondary: "#F5F5F5",
          textPrimary: "#111111",
          textSecondary: "#555555",
          border: "#E5E5E5",
          danger: "#E53935",
          success: "#16A34A",
          warning: "#F97316",
          info: "#111111",
        },
      },
      boxShadow: {
        brandSm: "0 8px 24px -20px rgba(17, 17, 17, 0.42)",
        brandMd: "0 22px 60px -38px rgba(17, 17, 17, 0.45)",
        brandLg: "0 32px 100px -48px rgba(17, 17, 17, 0.5)",
      },
      borderRadius: {
        brandSm: "8px",
        brandMd: "12px",
        brandLg: "16px",
      },
    },
  },
  plugins: [],
}
