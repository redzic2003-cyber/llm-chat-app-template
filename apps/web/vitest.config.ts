import { defineConfig } from "vitest/config";

// Tests des services serveur : modules TypeScript purs, base SQLite en mémoire.
export default defineConfig({
  test: {
    name: "web",
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
