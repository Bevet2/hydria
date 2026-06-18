import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/crm/",
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/crm-api": {
        target: "http://127.0.0.1:4010",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/crm-api/, "/api")
      }
    }
  },
  preview: { port: 4174 }
});
