import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path"; // <-- Required for path.resolve

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tsconfigPaths({ root: __dirname }), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"), // <-- Adds explicit alias for '@'
    },
  },
  base: "/", // Ensures correct asset paths on Vercel
  build: {
    outDir: "dist", // Ensures build output goes to dist/
    rollupOptions: {
      output: {
        manualChunks: {
          antd: ["antd"],
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
});
