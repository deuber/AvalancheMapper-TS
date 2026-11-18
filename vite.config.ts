import { defineConfig } from "vitest/config";

// GitHub Pages serves project sites from /<repo-name>/, so asset URLs need that prefix.
export default defineConfig({
  base: "/AvalancheMapper-TS/",
  build: { outDir: "dist", sourcemap: true },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
