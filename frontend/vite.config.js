import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    global: "window", // ✅ Fix for sockjs-client "global is not defined"
  },
  server: {
    port: 5173, // Frontend port
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
    // (No API proxy yet—only Cesium asset serving via public/)
  },
});
