#!/usr/bin/env node
// Make the generated type declarations in dist/ match the JavaScript that ships with them.
// Run by `npm run build` after tsc has written them.
//
// 1. The published JavaScript does not import stylesheets (vite.config.ts ships the CSS as
//    separate files), so the declarations must not either.
// 2. Relative imports get their real path and extension. The source writes "../push-button"
//    and "../../lib/cn", which a bundler resolves; in dist/ the folder
//    dist/components/push-button/ sits beside the entry dist/components/push-button.js, so the
//    same specifier would resolve to the JavaScript file, which has no declarations, and every
//    prop of a component built on another would silently become `any`. Written out as
//    "../push-button/index.js" the import means one thing under every moduleResolution,
//    including node16 and nodenext, which require the extension.
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");

/** `from "./x"`, `import "./x"` and `import("./x")` with a relative specifier. */
const RELATIVE = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"']*|\.{1,2})\2/g;

function withExtension(file, specifier) {
  if (/\.[cm]?js$/.test(specifier)) return specifier;
  const target = path.resolve(path.dirname(file), specifier);
  if (existsSync(`${target}.d.ts`)) return `${specifier}.js`;
  if (existsSync(path.join(target, "index.d.ts")))
    return `${specifier.replace(/\/$/, "")}/index.js`;
  throw new Error(
    `${path.relative(dist, file)}: "${specifier}" has no declaration file in dist/, so the package's types would be incomplete`,
  );
}

let changed = 0;
for (const entry of await readdir(dist, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".d.ts")) continue;
  const file = path.join(entry.parentPath, entry.name);
  const text = await readFile(file, "utf8");
  const fixed = text
    .replace(/^import "[^"]+\.css";\r?\n/gm, "")
    .replace(
      RELATIVE,
      (_, lead, quote, specifier) => `${lead}${quote}${withExtension(file, specifier)}${quote}`,
    );
  if (fixed !== text) {
    await writeFile(file, fixed);
    changed++;
  }
}
console.log(`declarations: ${changed} files adjusted in dist/`);
