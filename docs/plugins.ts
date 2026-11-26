import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createHighlighter, type Highlighter } from "shiki";
import type { Plugin } from "vite";
import { listComponents, repoRoot } from "../vite.shared.ts";
import { collectPages, collectTokens, type PropsDoc, propsTables, readFolder } from "./extract.ts";

export type { PageMeta, PropDoc, PropsDoc, TokenDoc } from "./extract.ts";

/**
 * Everything the docs site knows about the repository is generated here from the files
 * themselves, so adding a component, a guide or a demo never means editing a shared list.
 *
 *   virtual:docs-pages    every page: guides, component docs, demos, root Markdown files
 *   virtual:docs-props    props tables, read from exported `*Props` interfaces and their JSDoc
 *   virtual:docs-tokens   token tables, read from src/styles/tokens/*.css
 *   <file>?source         an example's source code, highlighted at build time
 *
 * The readers themselves are in extract.ts; agent-docs.ts builds the plain-Markdown export for
 * coding agents (llms.txt and a page per component) from the same data.
 */

const virtual = (name: string) => `\0${name}`;
const IDS = ["virtual:docs-pages", "virtual:docs-props", "virtual:docs-tokens"];
const SOURCE_QUERY = "?source";
export const SHIKI_THEMES = { light: "github-light", dark: "github-dark" } as const;

export function docsData(): Plugin {
  let highlighter: Promise<Highlighter> | undefined;

  return {
    name: "macalicious:docs-data",
    enforce: "pre",

    async resolveId(source, importer) {
      if (IDS.includes(source)) return virtual(source);
      if (source.endsWith(SOURCE_QUERY)) {
        const resolved = await this.resolve(source.slice(0, -SOURCE_QUERY.length), importer, {
          skipSelf: true,
        });
        return resolved ? `${virtual("source:")}${resolved.id}.source.js` : null;
      }
      return null;
    },

    async load(id) {
      if (id === virtual("virtual:docs-pages")) {
        const pages = collectPages();
        return `export const pages = [\n${pages
          .map(
            ({ file, ...meta }) =>
              `  { ...${JSON.stringify(meta)}, load: () => import(${JSON.stringify(file)}) }`,
          )
          .join(",\n")}\n];\n`;
      }

      if (id === virtual("virtual:docs-props")) {
        // Keyed by component folder and interface name: two components may each have an
        // `ItemProps`, and a page must show its own.
        const all: Record<string, PropsDoc> = {};
        for (const component of listComponents()) {
          const dir = path.join(repoRoot, "src/components", component);
          // .ts and .tsx, subfolders included, as the Markdown export reads them; a type
          // index.ts exports is read from the module that declares it, under its public name.
          const modules = readFolder(dir);
          for (const file of modules.keys()) this.addWatchFile(file);
          for (const [name, doc] of propsTables(dir, modules)) all[`${component}/${name}`] = doc;
        }
        return `export const props = ${JSON.stringify(all)};\n`;
      }

      if (id === virtual("virtual:docs-tokens")) {
        const dir = path.join(repoRoot, "src/styles/tokens");
        for (const file of readdirSync(dir)) this.addWatchFile(path.join(dir, file));
        return `export const tokens = ${JSON.stringify(collectTokens())};\n`;
      }

      if (id.startsWith(virtual("source:"))) {
        const file = id.slice(virtual("source:").length, -".source.js".length);
        this.addWatchFile(file);
        const code = readFileSync(file, "utf8").trimEnd();
        highlighter ??= createHighlighter({
          themes: Object.values(SHIKI_THEMES),
          langs: ["tsx", "css"],
        });
        const html = (await highlighter).codeToHtml(code, {
          lang: file.endsWith(".css") ? "css" : "tsx",
          themes: SHIKI_THEMES,
          defaultColor: false,
        });
        return `export default ${JSON.stringify({ code, html })};\n`;
      }
      return null;
    },

    configureServer(server) {
      // A page or example was added or removed: rebuild the generated lists.
      const refresh = (file: string) => {
        if (!/\.(mdx?|tsx?)$/.test(file)) return;
        for (const id of IDS) {
          const module = server.moduleGraph.getModuleById(virtual(id));
          if (module) server.moduleGraph.invalidateModule(module);
        }
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.add([path.join(repoRoot, "src"), path.join(repoRoot, "demos")]);
      server.watcher.on("add", refresh);
      server.watcher.on("unlink", refresh);
    },
  };
}
