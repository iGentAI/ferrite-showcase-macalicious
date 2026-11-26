import { readFileSync } from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { alias, cssTarget, fsAllow, repoRoot } from "../../vite.shared.ts";

/**
 * The demos the Ferrite desktop does not deploy (`ferrite-apps/desktop/not-deployed.json`). In
 * the build `ferrite-apps/desktop/scripts/pack-site.mjs` makes (`VITE_MACALICIOUS_API=1`), each
 * one's `app.ts` loads as a module with no descriptor, so the desktop never finds it and none of
 * its code is bundled. Every other build, the documentation's included, hosts all the demos.
 */
function leaveOutOfFerrite(): Plugin | false {
  if (process.env.VITE_MACALICIOUS_API !== "1") return false;
  const list = path.join(repoRoot, "ferrite-apps/desktop/not-deployed.json");
  const { apps } = JSON.parse(readFileSync(list, "utf8")) as { apps: { id: string }[] };
  const left = new Set(apps.map(({ id }) => path.join(repoRoot, "demos", id, "app.ts")));
  return {
    name: "macalicious-leave-out-of-ferrite",
    enforce: "pre",
    load(id) {
      return left.has(path.normalize(id.split("?")[0] ?? id))
        ? "export const app = undefined;\n"
        : null;
    },
  };
}

/**
 * The full-window desktop page. `npm run desktop:build` writes it to docs/dist/desktop, so run
 * it after `npm run docs:build`, which empties docs/dist. The site then serves the desktop at
 * /desktop/ next to the documentation.
 */
export default defineConfig({
  root: path.join(repoRoot, "docs/desktop"),
  base: "./",
  resolve: { alias },
  plugins: [react(), leaveOutOfFerrite()],
  server: { port: 3001, fs: { allow: fsAllow } },
  build: {
    outDir: path.join(repoRoot, "docs/dist/desktop"),
    emptyOutDir: true,
    target: "es2022",
    cssTarget,
  },
});
