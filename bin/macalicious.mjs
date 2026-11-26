#!/usr/bin/env node
// macalicious: copy component source into your project, shadcn style.
//
//   npx macalicious list
//   npx macalicious add <component...> [--dir src/components/macalicious] [--overwrite] [--dry-run]
//   npx macalicious docs [page]        the documentation as Markdown, for coding agents
//
// Files keep their layout under --dir (components/<name>/, lib/, styles/), so the relative
// imports between them work unchanged. --registry <dir or URL> reads another registry.
//
// A registry is data from somewhere else, so nothing in it is trusted with the file system:
// item names, file paths and dependency names are checked before anything is written, and a
// file is only ever written inside --dir.
import { existsSync, lstatSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const here = path.dirname(fileURLToPath(import.meta.url));

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dir: { type: "string", default: "src/components/macalicious" },
    registry: { type: "string", default: path.join(here, "../dist/registry") },
    docs: { type: "string", default: path.join(here, "../dist/docs") },
    overwrite: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

const [command, ...names] = positionals;

function usage() {
  console.log(`Usage:
  macalicious list                      Show the components that can be copied
  macalicious add <component...>        Copy components, their helpers and the tokens
  macalicious docs [page]               Print documentation as Markdown (for coding agents):
                                        no page for the index (llms.txt), a component or guide
                                        name (push-button, theming), or "full" for everything

Options:
  --dir <path>        Destination folder (default: src/components/macalicious)
  --overwrite         Replace files that differ from the registry version
  --dry-run           Show what would be written
  --registry <path>   Registry folder or URL (default: the installed package)
  --docs <path>       Folder of the Markdown documentation (default: the installed package)

Coding agents: read AGENTS.md in the macalicious package first.`);
}

const ITEM_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
/** The folders a registry file may be copied into, below --dir. */
const FILE_ROOTS = ["components", "lib", "styles"];
const FILE_SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;
/** An npm package name with an optional version or range: what `npm install` is told to add. */
const DEPENDENCY =
  /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:@[A-Za-z0-9.^~<>=|*+ -]+)?$/;

/**
 * One argument of the install command that is printed for the user to paste. A range may hold
 * spaces, <, >, | and ^, which a shell would read as redirections, pipes and escapes, so
 * anything but a plain word is put in double quotes. DEPENDENCY admits no character that is
 * special inside double quotes (no ", $, `, \ or !) in sh, cmd or PowerShell.
 */
const shellArgument = (text) => (/^[A-Za-z0-9@/._-]+$/.test(text) ? text : `"${text}"`);

/**
 * Where a registry file goes, or an error if the registry asks for anywhere but inside --dir:
 * an absolute path, a path with `..`, a path outside components/, lib/ or styles/, or a path
 * that passes through a symbolic link.
 */
function targetFor(item, file) {
  const refuse = (reason) =>
    new Error(
      `Refusing registry item "${item.name}": file path ${JSON.stringify(file?.path)} ${reason}. Nothing was written.`,
    );
  if (!file || typeof file.path !== "string" || typeof file.content !== "string") {
    throw refuse("is not a file with a path and content");
  }
  const segments = file.path.split("/");
  if (
    file.path.includes("\\") ||
    path.isAbsolute(file.path) ||
    path.win32.isAbsolute(file.path) ||
    !segments.every((segment) => FILE_SEGMENT.test(segment) && segment !== "..")
  ) {
    throw refuse("is not a plain relative path");
  }
  if (segments.length < 2 || !FILE_ROOTS.includes(segments[0])) {
    throw refuse(`is not under ${FILE_ROOTS.map((root) => `${root}/`).join(", ")}`);
  }
  const base = path.resolve(options.dir);
  const target = path.resolve(base, ...segments);
  if (!target.startsWith(base + path.sep)) throw refuse("leaves the destination folder");
  // A link below --dir could still lead outside it.
  let current = base;
  for (const segment of segments) {
    current = path.join(current, segment);
    if (lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) {
      throw refuse(`passes through the symbolic link ${path.relative(process.cwd(), current)}`);
    }
  }
  return target;
}

async function readItem(name) {
  // The name becomes part of a file name or URL, so it must be a name and nothing else.
  if (name !== "index" && !ITEM_NAME.test(name)) {
    throw new Error(
      `"${name}" is not a component name. Names are kebab-case; run "macalicious list" to see them.`,
    );
  }
  const location = /^https?:/.test(options.registry)
    ? new URL(
        `${name}.json`,
        options.registry.endsWith("/") ? options.registry : `${options.registry}/`,
      )
    : path.join(options.registry, `${name}.json`);
  try {
    if (location instanceof URL) {
      const response = await fetch(location);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    }
    return JSON.parse(await readFile(location, "utf8"));
  } catch (error) {
    if (name === "index") {
      throw new Error(`Cannot read the registry at ${options.registry}: ${error.message}`);
    }
    throw new Error(
      `Unknown component "${name}". Run "macalicious list" to see what is available.`,
    );
  }
}

async function list() {
  const index = await readItem("index");
  for (const item of index.items) {
    console.log(`${item.name.padEnd(24)} ${item.description ?? ""}`);
  }
}

async function add() {
  if (names.length === 0) {
    usage();
    process.exit(2);
  }
  // Resolve the requested components and everything they depend on.
  const items = new Map();
  const queue = [...names];
  while (queue.length > 0) {
    const name = queue.shift();
    if (items.has(name)) continue;
    const item = await readItem(name);
    if (!item || typeof item !== "object" || !Array.isArray(item.files)) {
      throw new Error(`Registry item "${name}" is malformed: it has no list of files.`);
    }
    for (const key of ["dependencies", "registryDependencies"]) {
      const list = item[key] ?? [];
      if (!Array.isArray(list) || list.some((entry) => typeof entry !== "string")) {
        throw new Error(`Registry item "${name}" is malformed: ${key} must be a list of names.`);
      }
    }
    // A dependency is fetched by name like a requested item, so it must be a name too; an
    // empty or malformed entry is a broken registry, not something to skip.
    for (const dependency of item.registryDependencies ?? []) {
      if (!ITEM_NAME.test(dependency)) {
        throw new Error(
          `Registry item "${name}" is malformed: registryDependencies entry ${JSON.stringify(dependency)} is not a component name. Nothing was written.`,
        );
      }
    }
    items.set(name, { ...item, name });
    queue.push(...(item.registryDependencies ?? []));
  }

  // Check everything before writing anything, so a refused registry leaves no partial copy.
  const dependencies = new Set();
  const plan = [];
  for (const item of items.values()) {
    for (const dependency of item.dependencies ?? []) {
      if (!DEPENDENCY.test(dependency)) {
        throw new Error(
          `Refusing registry item "${item.name}": dependency ${JSON.stringify(dependency)} is not an npm package name. Nothing was written.`,
        );
      }
      dependencies.add(dependency);
    }
    for (const file of item.files) plan.push({ file, target: targetFor(item, file) });
  }

  const counts = { written: 0, unchanged: 0, skipped: 0 };
  for (const { file, target } of plan) {
    const shown = path.relative(process.cwd(), target);
    if (existsSync(target)) {
      const current = await readFile(target, "utf8");
      if (current === file.content) {
        counts.unchanged++;
        continue;
      }
      if (!options.overwrite) {
        counts.skipped++;
        console.log(`  skipped  ${shown} (differs from the registry; use --overwrite to replace)`);
        continue;
      }
    }
    counts.written++;
    console.log(`  ${options["dry-run"] ? "would write" : "wrote"}    ${shown}`);
    if (!options["dry-run"]) {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, file.content);
    }
  }

  console.log(
    `\n${[...items.keys()].join(", ")}: ${counts.written} ${options["dry-run"] ? "to write" : "written"}, ${counts.unchanged} unchanged, ${counts.skipped} skipped.`,
  );
  if (dependencies.size > 0) {
    console.log(
      `\nInstall the dependencies:\n  npm install ${[...dependencies].sort().map(shellArgument).join(" ")}`,
    );
  }
  const styles = path.relative(process.cwd(), path.resolve(options.dir, "styles/index.css"));
  console.log(
    `\nImport the tokens once, before any component:\n  import "./${styles.split(path.sep).join("/")}";`,
  );
  const documented = [...items.keys()].filter((name) => name !== "tokens");
  console.log(
    `\nDocumentation as Markdown (props, options, examples, accessibility), for you or a coding agent:\n${documented
      .map((name) => `  npx macalicious docs ${name}`)
      .join(
        "\n",
      )}\n  AGENTS.md in the macalicious package explains theming, window state and where the rest is.`,
  );
}

/** Print a page of the generated Markdown documentation (dist/docs, built from the source). */
async function docs() {
  const [page] = names;
  if (page && !ITEM_NAME.test(page)) {
    throw new Error(`No documentation page "${page}". Run "macalicious docs" to see the index.`);
  }
  const candidates = !page
    ? ["llms.txt"]
    : page === "full"
      ? ["llms-full.txt"]
      : [`components/${page}.md`, `${page}.md`, `demos/${page}.md`];
  for (const candidate of candidates) {
    const file = path.join(options.docs, candidate);
    if (existsSync(file)) {
      process.stdout.write(await readFile(file, "utf8"));
      return;
    }
  }
  throw new Error(
    page
      ? `No documentation page "${page}". Run "macalicious docs" to see the index.`
      : `Cannot read the documentation at ${options.docs}.`,
  );
}

try {
  if (options.help || !command) usage();
  else if (command === "list") await list();
  else if (command === "add") await add();
  else if (command === "docs") await docs();
  else {
    usage();
    process.exit(2);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
