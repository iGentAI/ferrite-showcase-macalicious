// The copy-in registry, generated from a source tree: <out>/<name>.json for every component,
// plus "tokens" and an index. The item shape is modelled on shadcn's registry items (name,
// dependencies, registryDependencies, files with inline content) and is read by
// bin/macalicious.mjs. Nothing is hand-maintained: a component's files, npm dependencies and
// dependencies on other components are read from its folder and its import statements.
//
// A registry item must be complete, because `macalicious add` copies exactly what it lists.
// So anything the builder cannot follow is an error here rather than a file missing in
// somebody's project: an import that leaves the component, an import of a file that is not
// shipped, a dynamic import with a computed path.
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseSync } from "oxc-parser";
import { componentNameProblem } from "./names.mjs";

const isTest = (file) => /\.test\.[cm]?[jt]sx?$/.test(file);
const isShipped = (file) => /\.(tsx?|css)$/.test(file) && !isTest(file) && !file.endsWith(".d.ts");
/** Folders inside a component that are documentation or tests, not source to copy. */
const NOT_SOURCE = new Set(["examples", "__tests__"]);

async function walk(dir, { skip = new Set() } = {}) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skip.has(entry.name)) files.push(...(await walk(full, { skip })));
    } else files.push(full);
  }
  return files.sort();
}

/**
 * Every module request of a source file, read with a parser, so quotes, layout and comments
 * cannot add or hide one. `form` is "import", "export" (a re-export) or "dynamic" (`import()`).
 * `names` is false for an import made only for its side effect. `erased` marks a request that
 * brings only types (`import type`, `export type`, or every name marked `type`): it is gone
 * when the file is compiled, so the module behind it is never loaded. An `import()` with a
 * computed path has no `specifier`; `text` holds its argument.
 */
export function moduleRequests(file, code) {
  const { module, errors } = parseSync(file, code);
  if (errors.length > 0) throw new Error(`${file}: ${errors[0].message}`);
  const requests = [];
  for (const statement of module.staticImports) {
    const names = statement.entries.length > 0;
    requests.push({
      specifier: statement.moduleRequest.value,
      form: "import",
      names,
      erased: names && statement.entries.every((entry) => entry.isType),
    });
  }
  for (const statement of module.staticExports) {
    for (const entry of statement.entries) {
      if (!entry.moduleRequest) continue;
      requests.push({
        specifier: entry.moduleRequest.value,
        form: "export",
        names: true,
        erased: entry.isType,
      });
    }
  }
  for (const dynamic of module.dynamicImports) {
    const text = code.slice(dynamic.moduleRequest.start, dynamic.moduleRequest.end).trim();
    const literal = /^(["'`])([^"'`$]+)\1$/.exec(text);
    requests.push({ specifier: literal?.[2], form: "dynamic", names: false, erased: false, text });
  }
  return { requests, importMetas: module.importMetas.length };
}

/**
 * Every module specifier a source file imports or re-exports. With `runtime`, a request that
 * brings only types is left out. The registry reads without it, because a copied file needs
 * the modules its types come from too.
 */
export function importsOf(file, code, { runtime = false } = {}) {
  const specifiers = [];
  for (const request of moduleRequests(file, code).requests) {
    if (request.specifier === undefined) {
      throw new Error(
        `${file}: import(${request.text}) has a computed path, so the registry cannot tell which file to copy; import a literal path`,
      );
    }
    if (!(runtime && request.erased)) specifiers.push(request.specifier);
  }
  return [...new Set(specifiers)];
}

const packageName = (specifier) =>
  specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];

/** The source file a relative import of TypeScript or CSS resolves to, or undefined. */
function resolveSource(target) {
  return [
    target,
    `${target}.ts`,
    `${target}.tsx`,
    `${target}/index.ts`,
    `${target}/index.tsx`,
  ].find((candidate) => existsSync(candidate) && /\.(tsx?|css)$/.test(candidate));
}

/**
 * Build the registry for the package at `root` into `out`.
 * Returns the names of the items written.
 */
export async function buildRegistry({ root, out }) {
  const src = path.join(root, "src");
  const componentsDir = path.join(src, "components");
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const rel = (file) => path.relative(root, file).split(path.sep).join("/");

  const versionOf = (name) =>
    pkg.dependencies?.[name] ?? pkg.peerDependencies?.[name] ?? pkg.devDependencies?.[name];

  const toFile = async (file) => ({
    path: path.relative(src, file).split(path.sep).join("/"),
    type: path.relative(src, file).startsWith(`lib${path.sep}`)
      ? "registry:lib"
      : file.endsWith(".css")
        ? "registry:style"
        : "registry:ui",
    content: await readFile(file, "utf8"),
  });

  async function describe(name) {
    const mdx = path.join(componentsDir, name, `${name}.mdx`);
    if (!existsSync(mdx)) return {};
    const text = await readFile(mdx, "utf8");
    return {
      title: /^title:\s*(.+)$/m.exec(text)?.[1]?.trim(),
      description: /^description:\s*(.+)$/m.exec(text)?.[1]?.trim(),
    };
  }

  /**
   * Follow the imports of `own` (the files of the component `name`, or helpers in lib when
   * `name` is undefined): the helpers in lib they reach, the npm packages and the other
   * components they import.
   */
  async function collect(own, name) {
    const files = new Set(own);
    const npm = new Set();
    const components = new Set();

    const queue = [...own];
    for (let file = queue.pop(); file; file = queue.pop()) {
      if (file.endsWith(".css")) continue;
      for (const specifier of importsOf(file, await readFile(file, "utf8"))) {
        if (!specifier.startsWith(".")) {
          const dependency = packageName(specifier);
          if (dependency === pkg.name) {
            throw new Error(
              `${rel(file)}: imports "${specifier}"; library source imports its siblings relatively`,
            );
          }
          if (dependency !== "react" && dependency !== "react-dom") npm.add(dependency);
          continue;
        }
        const target = path.resolve(path.dirname(file), specifier);
        const relative = path.relative(src, target).split(path.sep);
        const inLib = file.startsWith(path.join(src, "lib") + path.sep);
        if (name && relative[0] === "components" && relative[1] === name && !inLib) {
          // The component's own files: each must be one of the files that are copied.
          const resolved = resolveSource(target);
          if (!resolved) throw new Error(`${rel(file)}: cannot resolve "${specifier}"`);
          if (!files.has(resolved)) {
            throw new Error(
              `${rel(file)}: imports "${specifier}" (${rel(resolved)}), which is not copied with the component: examples, tests and files that are not .ts, .tsx or .css are left out. Move it into the component's source.`,
            );
          }
        } else if (name && relative[0] === "components" && relative.length >= 2 && !inLib) {
          const other = relative[1];
          if (!existsSync(path.join(componentsDir, other, "index.ts"))) {
            throw new Error(
              `${rel(file)}: imports "${specifier}", but ${other} is not a component`,
            );
          }
          // Only the folder itself or its index: anything longer names a file of the other
          // component, or a path that does not exist.
          const entry =
            relative.length === 2 ||
            (relative.length === 3 && (relative[2] === "index" || relative[2] === "index.ts"));
          if (!entry) {
            throw new Error(
              `${rel(file)}: imports "${specifier}"; import another component through its folder ("../${other}"), not one of its files`,
            );
          }
          components.add(other);
        } else if (relative[0] === "lib") {
          const resolved = resolveSource(target);
          if (!resolved || resolved.endsWith(".css")) {
            throw new Error(`${rel(file)}: cannot resolve "${specifier}"`);
          }
          if (!files.has(resolved)) {
            files.add(resolved);
            queue.push(resolved);
          }
        } else {
          throw new Error(
            name
              ? `${rel(file)}: import "${specifier}" leaves the component. Components may import their own files, ../<other-component> and ../../lib/*; helpers in lib may import each other.`
              : `${rel(file)}: import "${specifier}" leaves lib. Helpers in lib may import each other and npm packages, nothing else.`,
          );
        }
      }
    }
    return { files, npm, components };
  }

  const versioned = (item, npm) =>
    [...npm].sort().map((dependency) => {
      const version = versionOf(dependency);
      if (!version) {
        throw new Error(`${item}: "${dependency}" is imported but not in package.json`);
      }
      return `${dependency}@${version}`;
    });

  async function componentItem(name) {
    const dir = path.join(componentsDir, name);
    // The whole folder, subfolders included; examples and tests are not source.
    const own = (await walk(dir, { skip: NOT_SOURCE })).filter(isShipped);
    // The package ships a component's top-level stylesheets only. A stylesheet in a subfolder
    // would be copied here and missing there, so the two ways of using a component would differ.
    const nested = own.filter((file) => file.endsWith(".css") && path.dirname(file) !== dir);
    if (nested.length > 0) {
      throw new Error(
        `${nested.map(rel).join(", ")}: stylesheets live at the top level of the component folder; move it beside ${name}.css`,
      );
    }
    const { files, npm, components } = await collect(own, name);
    return {
      name,
      type: "registry:ui",
      ...(await describe(name)),
      dependencies: versioned(name, npm),
      registryDependencies: [...components.add("tokens")].sort(),
      files: await Promise.all([...files].sort().map(toFile)),
    };
  }

  // The helpers that set the attributes the tokens read. No component imports them, so they
  // travel with the tokens: a project that copies source instead of importing the package
  // still gets setAppearance(), setAccent() and trackWindowActivation().
  const themingHelpers = ["appearance.ts", "window-activation.ts"].map((file) =>
    path.join(src, "lib", file),
  );
  for (const file of themingHelpers) {
    if (!existsSync(file)) throw new Error(`registry: ${rel(file)} is missing`);
  }
  // Followed like a component's helpers, so what they import is copied and installed too.
  const theming = await collect(themingHelpers);

  const items = [
    {
      name: "tokens",
      type: "registry:style",
      title: "Design tokens",
      description:
        "Catalina colours, typography, metrics, shadows, materials and control sizes as CSS custom properties.",
      dependencies: versioned("tokens", theming.npm),
      registryDependencies: [],
      files: await Promise.all(
        [
          ...(await walk(path.join(src, "styles"))).filter(isShipped),
          ...[...theming.files].sort(),
        ].map(toFile),
      ),
    },
  ];

  const entries = existsSync(componentsDir)
    ? (await readdir(componentsDir, { withFileTypes: true })).sort((a, b) =>
        a.name.localeCompare(b.name, "en"),
      )
    : [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !existsSync(path.join(componentsDir, entry.name, "index.ts"))) {
      continue;
    }
    // A component called "tokens" or "index" would replace the registry's own item.
    const problem = componentNameProblem(entry.name);
    if (problem) throw new Error(`src/components/${entry.name}: ${problem}`);
    items.push(await componentItem(entry.name));
  }

  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  for (const item of items) {
    await writeFile(path.join(out, `${item.name}.json`), `${JSON.stringify(item, null, 2)}\n`);
  }
  await writeFile(
    path.join(out, "index.json"),
    `${JSON.stringify(
      {
        name: pkg.name,
        version: pkg.version,
        items: items.map(({ files, ...item }) => ({
          ...item,
          files: files.map((file) => file.path),
        })),
      },
      null,
      2,
    )}\n`,
  );
  return items.map((item) => item.name);
}
