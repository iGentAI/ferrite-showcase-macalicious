import path from "node:path";
import { defineConfig } from "vite";
import { alias, fsAllow, repoRoot } from "../vite.shared.ts";

/** Dev server for the visual comparison harness page (visual/harness). Started by run.mjs. */
export default defineConfig({
  root: path.join(repoRoot, "visual/harness"),
  resolve: { alias },
  publicDir: false,
  clearScreen: false,
  logLevel: "warn",
  server: {
    fs: { allow: fsAllow },
    // A run takes a page as it was when it loaded: an edit elsewhere in the tree, by another worker
    // on a shared checkout, must not reload a page under a test.
    hmr: false,
    watch: null,
  },
  cacheDir: path.join(repoRoot, "node_modules/.vite-visual"),
});
