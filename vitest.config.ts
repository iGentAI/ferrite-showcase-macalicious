import { defineConfig } from "vitest/config";
import { alias } from "./vite.shared.ts";

export default defineConfig({
  resolve: { alias },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "demos/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
