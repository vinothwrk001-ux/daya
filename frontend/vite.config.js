import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const frontendRoot = fileURLToPath(new URL(".", import.meta.url));
const reactRoot = path.resolve(frontendRoot, "node_modules/react");
const reactDomRoot = path.resolve(frontendRoot, "node_modules/react-dom");
const nodeModuleReactPackages = /\/node_modules\/(?:react|react-dom|react-router|react-router-dom)\//;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: false,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");

          if (!normalizedId.includes("/node_modules/")) return undefined;
          if (normalizedId.includes("/lucide-react/")) return "vendor-icons";
          if (normalizedId.includes("/date-fns/") || normalizedId.includes("/react-date-range/")) return "vendor-dates";
          if (nodeModuleReactPackages.test(normalizedId)) return "vendor-react";
          if (normalizedId.includes("/recharts/")) return "vendor-charts";
          if (
            normalizedId.includes("/framer-motion/") ||
            normalizedId.includes("/@dnd-kit/") ||
            normalizedId.includes("/react-rnd/")
          ) {
            return "vendor-interactions";
          }
          return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: [
      { find: "react/jsx-dev-runtime", replacement: path.resolve(reactRoot, "jsx-dev-runtime.js") },
      { find: "react/jsx-runtime", replacement: path.resolve(reactRoot, "jsx-runtime.js") },
      { find: "react-dom/client", replacement: path.resolve(reactDomRoot, "client.js") },
      { find: "react-dom", replacement: reactDomRoot },
      { find: "react", replacement: reactRoot },
    ],
    dedupe: ["react", "react-dom"],
  },
});
