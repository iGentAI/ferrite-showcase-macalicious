#!/usr/bin/env node
// Check the built package the way a project that installs it would meet it. Run by
// `npm run build` last, so a build that passes ships a package that works.
//
//   exports       every target named in package.json "exports" exists, for every component
//                 and helper; no published JavaScript imports a stylesheet
//   declarations  every relative import in dist/**/*.d.ts names a file that has declarations
//   types         a file that imports every entry point type-checks, with library checking
//                 on, under moduleResolution "bundler" and "nodenext"
//   client        every built file that holds a module marked "use client" opens with the
//                 directive, so a server component can import the package
//                 (scripts/lib/use-client.mjs; the files' source maps say what they hold, and
//                 a file with code and no source map, or with a map that names a source file
//                 that does not exist, fails the check)
//
// The type check imports the package by its own name ("macalicious/push-button"), which
// resolves through "exports" exactly as it does from a project's node_modules.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clientDirectiveReport } from "./lib/use-client.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const problems = [];

const names = async (dir, extension) =>
  existsSync(dir)
    ? (await readdir(dir))
        .filter((file) => file.endsWith(extension) && !file.endsWith(`.d${extension}`))
        .map((file) => file.slice(0, -extension.length))
        .sort()
    : [];
const components = await names(path.join(dist, "components"), ".js");
const helpers = await names(path.join(dist, "lib"), ".js");
if (components.length === 0) problems.push("dist/components holds no component; run the build");

// exports
const need = (target, why) => {
  if (!existsSync(path.join(root, target))) problems.push(`${target} is missing (${why})`);
};
for (const [key, value] of Object.entries(pkg.exports)) {
  for (const target of typeof value === "string" ? [value] : Object.values(value)) {
    if (!target.includes("*")) need(target, `exports["${key}"]`);
    else {
      for (const name of key.startsWith("./lib/") ? helpers : components) {
        need(target.replace("*", name), `exports["${key}"] for ${name}`);
      }
    }
  }
}
for (const target of Object.values(pkg.bin ?? {})) need(target, "bin");
for (const name of components) {
  const code = await readFile(path.join(dist, "components", `${name}.js`), "utf8");
  if (/\.css["']/.test(code)) problems.push(`dist/components/${name}.js imports a stylesheet`);
}

// declarations
for (const entry of await readdir(dist, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".d.ts")) continue;
  const file = path.join(entry.parentPath, entry.name);
  const text = await readFile(file, "utf8");
  for (const match of text.matchAll(
    /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["'](\.{1,2}\/[^"']*)["']/g,
  )) {
    const specifier = match[1];
    const target = path.resolve(path.dirname(file), specifier);
    if (!/\.js$/.test(specifier) || !existsSync(target.replace(/\.js$/, ".d.ts"))) {
      problems.push(
        `${path.relative(root, file)}: import "${specifier}" does not name a file with declarations`,
      );
    }
  }
}

// client
const client = existsSync(dist)
  ? clientDirectiveReport(dist)
  : { missing: [], marked: 0, unreadable: [] };
for (const { reason } of client.unreadable) problems.push(reason);
for (const { file, source } of client.missing) {
  problems.push(
    `${path.relative(root, file)} holds ${path.relative(root, source)}, which is marked "use client", and does not open with the directive: a server component that imports it would run its hooks on the server`,
  );
}

// types
if (problems.length === 0) {
  const work = path.join(root, "node_modules/.cache/macalicious-package-check");
  await rm(work, { recursive: true, force: true });
  const entries = [
    pkg.name,
    ...components.map((name) => `${pkg.name}/${name}`),
    ...helpers.map((name) => `${pkg.name}/lib/${name}`),
  ];
  const source = `${entries.map((entry, i) => `import * as m${i} from ${JSON.stringify(entry)};`).join("\n")}\nexport const all = [${entries.map((_, i) => `m${i}`).join(", ")}];\n`;
  // The compiler's command, from its package.json "bin" (its "exports" do not list it).
  const require = createRequire(import.meta.url);
  const tsPackage = require.resolve("typescript/package.json");
  const tsc = path.resolve(path.dirname(tsPackage), require(tsPackage).bin.tsc);
  for (const [mode, module] of [
    ["bundler", "esnext"],
    ["nodenext", "nodenext"],
  ]) {
    const dir = path.join(work, mode);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "entries.ts"), source);
    await writeFile(
      path.join(dir, "tsconfig.json"),
      `${JSON.stringify(
        {
          compilerOptions: {
            target: "es2022",
            lib: ["es2023", "dom", "dom.iterable"],
            module,
            moduleResolution: mode,
            jsx: "react-jsx",
            strict: true,
            noEmit: true,
            skipLibCheck: false,
            types: [],
          },
          files: ["entries.ts"],
        },
        null,
        2,
      )}\n`,
    );
    const run = spawnSync(process.execPath, [tsc, "-p", dir], { cwd: root, encoding: "utf8" });
    if (run.status !== 0) {
      const output = `${run.stdout}${run.stderr}`.trim().split("\n");
      problems.push(
        `a consumer with moduleResolution "${mode}" does not type-check (${output.length} lines):\n      ${output.slice(0, 12).join("\n      ")}`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error(`package check failed (${problems.length}):\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(
  `package: ${components.length} components and ${helpers.length} helpers resolve and type-check from "exports" (bundler, nodenext); ${client.marked} built file(s) open with "use client"`,
);
