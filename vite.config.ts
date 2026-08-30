/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// On GitHub Pages the app is served from https://<user>.github.io/packout-organizer-designer/
// so it needs a non-root base. Everywhere else (local dev, `vite preview`, Replit) it is
// served from the domain root. The deploy workflow sets GITHUB_PAGES=true.
const base = process.env.GITHUB_PAGES === "true" ? "/packout-organizer-designer/" : "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5000,
  },
  preview: {
    host: "0.0.0.0",
    port: 5000,
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
