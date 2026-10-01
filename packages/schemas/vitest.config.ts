import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "schemas",
    include: ["test/**/*.test.ts"],
  },
});
