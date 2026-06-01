import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const frontendRoot = fileURLToPath(new URL(".", import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom")) return "vendor-react";
          if (id.includes("recharts")) return "vendor-charts";
          if (id.includes("framer-motion") || id.includes("@dnd-kit") || id.includes("react-rnd")) return "vendor-interactions";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("date-fns") || id.includes("react-date-range")) return "vendor-dates";
          return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: {
      react: path.resolve(frontendRoot, "node_modules/react"),
      "react-dom": path.resolve(frontendRoot, "node_modules/react-dom"),
    },
    dedupe: ["react", "react-dom"],
  },
});
