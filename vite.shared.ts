import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSync } from "oxc-parser";
import { cssReferences } from "./scripts/lib/css-references.mjs";

/** Shared by the library build, the tests, the docs site and the visual harness. */

export const repoRoot = path.dirname(fileURLToPath(import.meta.url));

const nodeModules = path.join(repoRoot, "node_modules");

/**
 * Folders Vite's dev servers may serve files from: the repository root and, when `node_modules`
 * is a symlink to a shared cache outside the tree, its resolved target.
 */
export const fsAllow = [
  ...new Set([repoRoot, ...(existsSync(nodeModules) ? [realpathSync(nodeModules)] : [])]),
];

const src = (p: string) => path.join(repoRoot, "src", p);

/**
 * Resolve the package's public import paths to source, so examples, demos and docs import
 * exactly what a consumer would: `import { PushButton } from "macalicious/push-button"`.
 */
export const alias = [
  { find: /^macalicious\/tokens\.css$/, replacement: src("styles/index.css") },
  { find: /^macalicious\/fallback-font\.css$/, replacement: src("styles/fallback-font.css") },
  { find: /^macalicious\/lib\/(.+)$/, replacement: src("lib/$1") },
  { find: /^macalicious\/([a-z0-9-]+)$/, replacement: src("components/$1/index.ts") },
];

/**
 * Browsers that support light-dark() and relative colour syntax. Without this, Vite's CSS
 * minifier rewrites light-dark() into a fallback that only works at the document root and
 * breaks appearance switching on a subtree.
 */
export const cssTarget = ["chrome123", "edge123", "firefox128", "safari17.5"];

/** Component folder names: every directory in src/components that has an index.ts. */
export function listComponents(): string[] {
  const dir = src("components");
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(dir, d.name, "index.ts")))
    .map((d) => d.name)
    .sort();
}

interface ModuleStatement {
  type: string;
  source?: { value?: unknown } | null;
  importKind?: string;
  exportKind?: string;
  specifiers?: { importKind?: string; exportKind?: string }[];
}

/**
 * The module specifiers a source file imports or re-exports at run time: the declarations in
 * source order, then every `import("...")` with a literal path, wherever it is written.
 * Read from the syntax tree, so comments, strings and layout cannot add or hide one. A
 * declaration that brings only types (`import type`, `export type`, or every specifier marked
 * `type`) is left out: it is erased when the file is compiled. An `import()` with a computed
 * path names no file and is left out too; the registry build refuses it. With
 * `dynamic: false` only the declarations are returned: what is loaded when the file is.
 */
export function runtimeImports(fileName: string, code: string, { dynamic = true } = {}): string[] {
  const sources: string[] = [];
  const parsed = parseSync(fileName, code);
  for (const statement of parsed.program.body as unknown as ModuleStatement[]) {
    const isImport = statement.type === "ImportDeclaration";
    const isExport =
      statement.type === "ExportNamedDeclaration" || statement.type === "ExportAllDeclaration";
    if ((!isImport && !isExport) || typeof statement.source?.value !== "string") continue;
    if ((isImport ? statement.importKind : statement.exportKind) === "type") continue;
    const specifiers = statement.specifiers ?? [];
    const typesOnly =
      specifiers.length > 0 &&
      specifiers.every((specifier) => (specifier.importKind ?? specifier.exportKind) === "type");
    if (!typesOnly) sources.push(statement.source.value);
  }
  for (const request of dynamic ? parsed.module.dynamicImports : []) {
    const text = code.slice(request.moduleRequest.start, request.moduleRequest.end).trim();
    const literal = /^(["'`])([^"'`$]+)\1$/.exec(text);
    if (literal?.[2]) sources.push(literal[2]);
  }
  return sources;
}

/** Source files of a component, subfolders included; examples and tests are not source. */
function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "examples" && entry.name !== "__tests__") files.push(...sourceFiles(full));
    } else if (
      /\.tsx?$/.test(entry.name) &&
      !/\.test\.tsx?$/.test(entry.name) &&
      !entry.name.endsWith(".d.ts")
    ) {
      files.push(full);
    }
  }
  return files.sort();
}

/**
 * The stylesheet files of a component in the order the package ships them, which is the order
 * the source loads them in: its modules are followed from index.ts through their static
 * imports, as the browser evaluates them (each import before the next, a module's imports
 * before the module), and every stylesheet takes the place of its first import. So the package
 * and a copied component cascade alike whatever order a component imports its stylesheets in.
 * A module loaded with `import()` is not followed: it loads later or not at all, while the
 * package ships a component's stylesheets at once, so a stylesheet reached only that way is
 * refused like one nothing imports.
 *
 * Whatever would make the package differ from the source and from a copied component is an
 * error. Lint refuses each of these too, but the build must not depend on lint having run:
 *
 * - a stylesheet in a subfolder: the source would load it, the package ships top-level files
 *   only and would silently lose its rules;
 * - a top-level stylesheet that no module reached from index.ts imports statically: the
 *   package would ship rules the source does not load with the component;
 * - an import of a stylesheet from a package or from outside the component's folder: the
 *   package build replaces every stylesheet import with nothing, so those rules would be lost;
 * - `@import` in a stylesheet: the package joins a component's stylesheets into one file,
 *   where an @import is no longer first and is ignored;
 * - an import of one of the component's own files that cannot be followed (`./box.js` for
 *   box.tsx, a file that does not exist): the stylesheets behind it would lose their place in
 *   the order. The registry build refuses the same import.
 *
 * `componentsDir` is the folder of component folders; only tests pass another one.
 */
export function componentStylesheets(name: string, componentsDir = src("components")): string[] {
  const dir = path.join(componentsDir, name);
  const nested: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "examples" && entry.name !== "__tests__") walk(full);
      } else if (current !== dir && entry.name.endsWith(".css")) {
        nested.push(path.relative(componentsDir, full).split(path.sep).join("/"));
      }
    }
  };
  walk(dir);
  if (nested.length > 0) {
    throw new Error(
      `src/components/${nested.sort().join(", src/components/")}: stylesheets live at the top level of the component folder; the package ships only those, so the rules of a stylesheet in a subfolder would be missing from it. Move it beside ${name}.css.`,
    );
  }
  const shown = (file: string) =>
    `src/components/${path.relative(componentsDir, file).split(path.sep).join("/")}`;
  const present = readdirSync(dir)
    .filter((file) => file.endsWith(".css"))
    .sort()
    .map((file) => path.join(dir, file));
  for (const file of present) {
    // Read as CSS reads it: @IMPORT counts, an @import in a string or a data: URI does not.
    if (cssReferences(readFileSync(file, "utf8")).imports.length > 0) {
      throw new Error(
        `${shown(file)}: @import is not supported in a component stylesheet; the package joins a component's stylesheets into one file, where it would be ignored. Import the other stylesheet from the component's code.`,
      );
    }
  }

  const imported: string[] = [];
  const seen = new Set<string>();
  const follow = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const code = readFileSync(file, "utf8");
    const loadedWithFile = new Set(runtimeImports(file, code, { dynamic: false }));
    for (const source of runtimeImports(file, code)) {
      const target = source.startsWith(".") ? path.resolve(path.dirname(file), source) : undefined;
      if (!target?.startsWith(dir + path.sep)) {
        if (/\.css([?#]|$)/.test(source)) {
          throw new Error(
            `${shown(file)}: imports the stylesheet "${source}", which the package would not ship: it ships only the stylesheets at the top of the component's own folder. Use another component through its folder, and put the rules this one needs in ${name}.css.`,
          );
        }
        // Another component's code brings that component's stylesheet, which ships on its own.
        continue;
      }
      // What import() names loads later or not at all, so it has no place in the order.
      if (!loadedWithFile.has(source)) continue;
      if (target.endsWith(".css") && present.includes(target)) {
        if (!imported.includes(target)) imported.push(target);
        continue;
      }
      const module = [target, `${target}.ts`, `${target}.tsx`]
        .concat(["index.ts", "index.tsx"].map((index) => path.join(target, index)))
        .find((candidate) => /\.tsx?$/.test(candidate) && existsSync(candidate));
      if (!module) {
        throw new Error(
          `${shown(file)}: cannot follow the import "${source}", so the order of the stylesheets behind it is unknown. Import the component's own files by their source name ("./${name}" or "./${name}.tsx", not "./${name}.js"), and stylesheets from the top of the folder.`,
        );
      }
      follow(module);
    }
  };
  const entry = path.join(dir, "index.ts");
  // A folder without index.ts is no component yet and is not shipped.
  if (!existsSync(entry)) return present;
  follow(entry);
  const unloaded = present.filter((file) => !imported.includes(file));
  if (unloaded.length > 0) {
    throw new Error(
      `${unloaded.map(shown).join(", ")}: no source file reached from index.ts imports this stylesheet (a type-only import or an import() does not count), so the source and a copied component do not load it with the component and the package must not ship it. Import it from the component's code, or remove it.`,
    );
  }
  return imported;
}

/**
 * Components that the code of `name` imports at run time, sorted. Every source file of the
 * folder is read, in subfolders too, and each relative import is resolved from the file that
 * holds it, so `../../label` in `parts/title.tsx` counts like `../label` beside the index.
 * Comments and type-only imports are not dependencies: they bring no rendered part, and so no
 * stylesheet, with them.
 */
function importedComponents(name: string, componentsDir: string): string[] {
  const dir = path.join(componentsDir, name);
  if (!existsSync(dir)) return [];
  const found = new Set<string>();
  for (const full of sourceFiles(dir)) {
    for (const source of runtimeImports(full, readFileSync(full, "utf8"))) {
      if (!source.startsWith(".")) continue;
      const target = path.relative(componentsDir, path.resolve(path.dirname(full), source));
      const [other] = target.split(path.sep);
      if (other && other !== ".." && other !== name && /^[a-z0-9-]+$/.test(other)) {
        found.add(other);
      }
    }
  }
  return [...found].sort();
}

/**
 * The components a component is built from, transitively, each one after the components it
 * uses itself. This is also the order their stylesheets have to load in, with the component's
 * own last: a component restyles the parts it borrows (a box gives its title, a label, a
 * padding) with selectors of the same specificity, so its own rule must come later.
 *
 * Components that import each other in a circle have no such order, so that is an error.
 * `componentsDir` is the folder of component folders; only tests pass another one.
 */
export function usedComponents(name: string, componentsDir = src("components")): string[] {
  const done = new Set<string>();
  const order: string[] = [];
  const visit = (current: string, trail: string[]) => {
    for (const other of importedComponents(current, componentsDir)) {
      if (trail.includes(other)) {
        const cycle = [...trail.slice(trail.indexOf(other)), other].join(" -> ");
        throw new Error(
          `src/components: ${cycle} import each other in a circle, so their stylesheets have no order in which each follows the ones it builds on. Move the shared part into a component both can import.`,
        );
      }
      if (done.has(other)) continue;
      visit(other, [...trail, other]);
      done.add(other);
      order.push(other);
    }
  };
  visit(name, [name]);
  return order;
}

/** The given components in stylesheet order: each one after the components it uses. */
export function inStylesheetOrder(names: string[]): string[] {
  const wanted = new Set(names);
  const order = new Set<string>();
  for (const name of names) {
    for (const other of [...usedComponents(name), name]) {
      if (wanted.has(other)) order.add(other);
    }
  }
  return [...order];
}

/**
 * Folders in src/components that are not components yet: they have no index.ts, so they are
 * no package entry and get no docs page. The docs build reports them instead of passing over
 * them in silence.
 */
export function listUnfinishedComponentFolders(): string[] {
  const dir = src("components");
  return readdirSync(dir, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() &&
        !d.name.startsWith(".") &&
        !existsSync(path.join(dir, d.name, "index.ts")),
    )
    .map((d) => d.name)
    .sort();
}

/** Public helper modules: every non-test .ts file in src/lib. */
export function listLibModules(): string[] {
  return readdirSync(src("lib"))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".d.ts"))
    .map((f) => f.slice(0, -3))
    .sort();
}
