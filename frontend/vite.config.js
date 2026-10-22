import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The frontend calls /api/...; Vite forwards it to the FastAPI backend, so no CORS setup is needed.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", rewrite: (path) => path.replace(/^\/api/, "") },
    },
  },
});
