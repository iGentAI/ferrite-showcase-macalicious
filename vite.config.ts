import { readFileSync } from "node:fs";
import path from "node:path";
import { transform } from "lightningcss";
import { defineConfig, type Plugin } from "vite";
import { agentDocs } from "./docs/agent-docs.ts";
import { duplicateExports } from "./scripts/lib/component-exports.mjs";
import { CLIENT_DIRECTIVE, isClientModule } from "./scripts/lib/use-client.mjs";
import {
  alias,
  componentStylesheets,
  cssTarget,
  inStylesheetOrder,
  listComponents,
  listLibModules,
  repoRoot,
} from "./vite.shared.ts";

/**
 * Library build.
 *
 *   dist/index.js                  everything (generated barrel; nobody maintains an index)
 *   dist/components/<name>.js      one entry per component  -> import "macalicious/<name>"
 *   dist/lib/<name>.js             helpers                  -> import "macalicious/lib/<name>"
 *   dist/tokens.css                all design tokens, minified
 *   dist/components/<name>.css     one stylesheet per component
 *   dist/styles.css                tokens + every component stylesheet, minified; a component's
 *                                  styles follow those of the components it is built from
 *   dist/docs/                     the documentation as Markdown for coding agents: llms.txt,
 *                                  llms-full.txt and a page per component (docs/agent-docs.ts)
 *
 * JavaScript never imports CSS in the published package: stylesheets are separate files that the
 * application imports, which works in every bundler and in server runtimes.
 *
 * A built file that holds a module marked "use client" opens with the directive: the bundler
 * drops a module's directives when it merges modules into a chunk, and without it a server
 * component that imports the package would run the component's hooks on the server.
 */

const components = listComponents();
const libModules = listLibModules();
const INDEX_ID = "\0macalicious-index";
// The root entry is generated. Vite resolves library entries as file paths, so it is addressed
// by a path that does not exist on disk (and must not: see scripts/check-conventions.mjs).
const INDEX_ENTRY = path.join(repoRoot, "src/index.ts");
const EMPTY_ID = "\0macalicious-empty-css";

const componentDir = (name: string) => path.join(repoRoot, "src/components", name);

/** Inline local `@import "./x.css";` statements (one level of nesting is all the tokens use). */
function inlineCss(file: string): string {
  const css = readFileSync(file, "utf8");
  return css.replace(/^@import\s+"(\.[^"]+)";[ \t]*\n?/gm, (_, rel: string) =>
    inlineCss(path.resolve(path.dirname(file), rel)),
  );
}

/**
 * Minify a shipped stylesheet and drop its comments. The token files are mostly comments (the
 * measurements behind each value), which belong in the repository and the copy-in registry, not
 * in every page that loads the package. The targets are the supported browsers, so
 * light-dark() and relative colours are kept as written rather than down-levelled.
 */
const cssTargets = Object.fromEntries(
  cssTarget.map((target) => {
    const [, name = "", version = ""] = /^([a-z]+)([\d.]+)$/.exec(target) ?? [];
    const [major = 0, minor = 0] = version.split(".").map(Number);
    return [name, (major << 16) | (minor << 8)];
  }),
);

function minifyCss(fileName: string, css: string): string {
  const { code } = transform({
    filename: fileName,
    code: Buffer.from(css),
    minify: true,
    targets: cssTargets,
  });
  return new TextDecoder().decode(code);
}

/**
 * A component's stylesheet as shipped: the .css files at the top of its folder in the order its
 * source imports them, so the package and a copied component cascade alike. A stylesheet
 * in a subfolder stops the build (componentStylesheets in vite.shared.ts).
 */
function componentCss(name: string): string {
  return componentStylesheets(name)
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

/**
 * The stylesheets the package ships, by file name under dist/. A function of the source tree
 * alone, so the tests can read what would be emitted without running a build.
 */
export function packageStylesheets(): Map<string, string> {
  const files = new Map<string, string>();
  const tokens = inlineCss(path.join(repoRoot, "src/styles/index.css"));
  const all = [tokens];
  // Not alphabetical: the source loads a used component's stylesheet before the user's own
  // (box.tsx imports Label, then box.css), and the cascade depends on that order.
  for (const name of inStylesheetOrder(components)) {
    const css = componentCss(name);
    if (!css) continue;
    all.push(css);
    files.set(`components/${name}.css`, css);
  }
  files.set("tokens.css", minifyCss("tokens.css", tokens));
  files.set("styles.css", minifyCss("styles.css", all.join("\n")));
  files.set(
    "fallback-font.css",
    readFileSync(path.join(repoRoot, "src/styles/fallback-font.css"), "utf8"),
  );
  return files;
}

function macaliciousPackage(): Plugin {
  return {
    name: "macalicious:package",
    enforce: "pre",
    buildStart() {
      // The root entry is `export *` of every component. The bundler drops a name exported by
      // two of them with a warning only, so the package would silently lose it.
      const clashes = duplicateExports(repoRoot);
      if (clashes.length > 0) {
        this.error(`components export the same name:\n  ${clashes.join("\n  ")}`);
      }
    },
    resolveId(source) {
      if (source === INDEX_ENTRY) return INDEX_ID;
      if (source.endsWith(".css")) return { id: EMPTY_ID, moduleSideEffects: false };
      return null;
    },
    load(id) {
      if (id === INDEX_ID) {
        return components
          .map(
            (name) => `export * from ${JSON.stringify(path.join(componentDir(name), "index.ts"))};`,
          )
          .join("\n");
      }
      if (id === EMPTY_ID) return "export {};";
      return null;
    },
    generateBundle() {
      for (const [fileName, source] of packageStylesheets()) {
        this.emitFile({ type: "asset", fileName, source });
      }
      this.emitFile({
        type: "asset",
        fileName: "index.d.ts",
        source: `${components.map((name) => `export * from "./components/${name}/index";`).join("\n")}\n`,
      });
    },
  };
}

export default defineConfig({
  resolve: { alias },
  plugins: [macaliciousPackage(), agentDocs({ dir: "docs", fail: false })],
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    minify: false,
    sourcemap: true,
    lib: {
      formats: ["es"],
      entry: {
        index: INDEX_ENTRY,
        ...Object.fromEntries(
          components.map((name) => [
            `components/${name}`,
            path.join(componentDir(name), "index.ts"),
          ]),
        ),
        ...Object.fromEntries(
          libModules.map((name) => [`lib/${name}`, path.join(repoRoot, "src/lib", `${name}.ts`)]),
        ),
      },
    },
    rollupOptions: {
      external: [/^react($|\/)/, /^react-dom($|\/)/, /^@base-ui\/react($|\/)/],
      output: {
        // Documentation comments stay in the type declarations, which is where an editor reads
        // them; in the JavaScript they are bytes every page would load. Annotations such as
        // @__PURE__ and licence comments are kept.
        comments: { jsdoc: false },
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        banner: (chunk) => (chunk.moduleIds.some(isClientModule) ? CLIENT_DIRECTIVE : ""),
      },
      // The "use client" directive is written back by `banner` above, so the bundler's notice
      // that it does not keep that one says nothing new. Every other warning is still printed,
      // the same notice about any other directive included.
      onwarn(warning, warn) {
        const restored =
          warning.code === "MODULE_LEVEL_DIRECTIVE" && /"use client"/.test(warning.message ?? "");
        if (!restored) warn(warning);
      },
    },
  },
});
