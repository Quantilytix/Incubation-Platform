import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tsconfigPaths({ root: __dirname }), react()],
  base: "./", // Ensures correct asset paths on Vercel
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
});