// What each component exports, read from its index.ts with a real parser. Used to refuse two
// components that export the same name: the root entry re-exports every component with
// `export *`, and the bundler drops a name exported twice without failing the build.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";

/** Names exported by a module, split into values and types. `export *` is reported as "*". */
export function exportedNames(file) {
  const { module, errors } = parseSync(file, readFileSync(file, "utf8"));
  if (errors.length > 0) throw new Error(`${file}: ${errors[0].message}`);
  const names = [];
  for (const statement of module.staticExports) {
    for (const entry of statement.entries) {
      if (entry.exportName.kind === "Name") {
        names.push({ name: entry.exportName.name, isType: entry.isType });
      } else if (entry.exportName.kind === "Default") {
        names.push({ name: "default", isType: false });
      } else if (entry.importName.kind === "AllButDefault" || entry.importName.kind === "All") {
        names.push({ name: "*", isType: entry.isType });
      }
    }
  }
  return names;
}

/**
 * Messages for every name exported by more than one component under <root>/src/components.
 * Values and types share one namespace here on purpose: `import { Item }` from the package
 * root must mean one thing.
 */
export function duplicateExports(root) {
  const dir = path.join(root, "src/components");
  if (!existsSync(dir)) return [];
  const owners = new Map();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const index = path.join(dir, entry.name, "index.ts");
    if (!entry.isDirectory() || !existsSync(index)) continue;
    for (const { name } of exportedNames(index)) {
      if (name === "*" || name === "default") continue;
      owners.set(name, [...(owners.get(name) ?? []), entry.name]);
    }
  }
  return [...owners]
    .filter(([, components]) => new Set(components).size > 1)
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(
      ([name, components]) =>
        `"${name}" is exported by ${[...new Set(components)].sort().join(" and ")}; the package root can export it only once, so give each a name of its own (for example prefixed with the component)`,
    );
}
