import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "qr-core",
    include: ["test/**/*.test.ts"],
  },
});
