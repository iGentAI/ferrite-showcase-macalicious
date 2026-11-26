// The JavaScript entry points of the package, read from package.json "exports".
//
// A pattern ("./*", "./lib/*") names one entry for each component folder or helper in the
// source tree, which is what the library build makes its entries from (vite.shared.ts:
// listComponents, listLibModules). The names come from the source, not from dist/, so an
// entry whose built file is missing is reported instead of being left out.
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

/** Component folder names: every directory in src/components that has an index.ts. */
function componentNames(root) {
  const dir = path.join(root, "src/components");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(dir, entry.name, "index.ts")))
    .map((entry) => entry.name)
    .sort();
}

/** Helper names: every module in src/lib that is not a test or a declaration file. */
function helperNames(root) {
  const dir = path.join(root, "src/lib");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && !file.endsWith(".d.ts"))
    .map((file) => file.slice(0, -3))
    .sort();
}

/**
 * Every entry of the package that is JavaScript: `specifier` is what an application imports
 * ("macalicious", "macalicious/push-button", "macalicious/lib/cn") and `file` the built file
 * it resolves to. Stylesheets and package.json are not entries of this kind. `missing` lists
 * the entries whose built file does not exist.
 */
export function packageEntries(root, pkg) {
  const entries = [];
  for (const [key, value] of Object.entries(pkg.exports ?? {})) {
    const target = typeof value === "string" ? value : value?.import;
    if (typeof target !== "string" || !target.endsWith(".js")) continue;
    const specifier = (name) => path.posix.join(pkg.name, key.replace("*", name));
    if (!key.includes("*")) {
      entries.push({ specifier: specifier(""), file: path.join(root, target) });
      continue;
    }
    const names = key.startsWith("./lib/") ? helperNames(root) : componentNames(root);
    for (const name of names) {
      entries.push({
        specifier: specifier(name),
        file: path.join(root, target.replace("*", name)),
      });
    }
  }
  return { entries, missing: entries.filter((entry) => !existsSync(entry.file)) };
}
