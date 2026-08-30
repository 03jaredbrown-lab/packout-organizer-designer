import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  server: {
    // stl.ts imports the shared core from ../../src (outside this package)
    fs: { allow: [".."] },
  },
});
