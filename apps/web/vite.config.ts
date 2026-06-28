import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.VITE_PROXY_API_TARGET ?? process.env.API_PROXY_TARGET ?? "http://127.0.0.1:18080";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: false
      },
      "/healthz": {
        target: apiTarget,
        changeOrigin: false
      }
    }
  }
});
