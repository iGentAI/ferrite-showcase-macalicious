#!/usr/bin/env node
// Print the shipped size of the library after a build, and fail when a budget is exceeded.
//
// For each component: its own JavaScript (its entry plus the local chunks and helpers its own
// code brings in, unminified, gzipped), its stylesheet (gzipped), the helpers counted once
// that it relies on, and what its entry loads in total. For each helper counted once: its size
// and who uses it. Then what the whole library loads, each file once.
//
// The budget, stated in CONTRIBUTING.md ("Performance rules"), applies to a component's own
// JavaScript, to its stylesheet, and to each helper that is counted once. How code is assigned
// is in scripts/lib/size.mjs; which helpers are counted once, and why, is in
// scripts/lib/shared-helpers.mjs. "loads" is not held to a budget: it is there so that nobody
// reads a component's own figure as what a page pays for it.
//
// ENFORCE_COMPONENTS=label,text-field: only those components can fail the build; the others
// are still measured and an overrun is printed as "over budget, not enforced". A helper that
// is counted once can fail the build when one of its users is enforced; a listed helper that is
// not counted once in this build has no budget of its own, because its code is charged to the
// components that use it. The convention check and the docs build
// read the same variable. Unset, everything is enforced.
//
//   node scripts/report-size.mjs [--root <dir>] [--with <name>,<name>]
//
//   --root <dir>    the folder that holds dist/ and src/ (default: this repository)
//   --with a,b      also print what a page that imports components a and b loads, each file
//                   once
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";
import { measureSizes } from "./lib/size.mjs";

const { values: options } = parseArgs({
  options: { root: { type: "string" }, with: { type: "string" } },
});
const root = path.resolve(
  options.root ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".."),
);
const dist = path.join(root, "dist/components");

/** Gzipped bytes. For JavaScript: of a component's own code, and of a helper counted once. */
const BUDGET = { js: 3072, css: 3072 };
const enforced = (process.env.ENFORCE_COMPONENTS ?? "").split(/[\s,]+/).filter(Boolean);
const isEnforced = (name) => enforced.length === 0 || enforced.includes(name);

const gzip = async (file) => (existsSync(file) ? gzipSync(await readFile(file)).length : 0);
const bytes = (size) => `${String(size).padStart(5)} B`;
const helperName = (file) => path.basename(file).replace(/\.[^.]+$/, "");

let measured;
try {
  measured = measureSizes(root);
} catch (error) {
  console.error(`size report failed: ${error.message}`);
  process.exit(1);
}

let failed = false;
let notEnforced = 0;
console.log("size (gzip, own code):");
for (const { name, js, uses, shared, sharedSize, loaded } of measured.components) {
  const css = await gzip(path.join(dist, `${name}.css`));
  const over = js > BUDGET.js || css > BUDGET.css;
  if (over && isEnforced(name)) failed = true;
  if (over && !isEnforced(name)) notEnforced++;
  console.log(
    [
      `  ${name.padEnd(28)} js ${bytes(js)}   css ${bytes(css)}`,
      over ? (isEnforced(name) ? "OVER BUDGET" : "over budget, not enforced") : "",
      shared.length > 0 ? `shared ${sharedSize} B (${shared.map(helperName).join(", ")})` : "",
      `loads ${loaded} B`,
      uses.length > 0 ? `uses ${uses.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("   "),
  );
}
const tokens = await gzip(path.join(root, "dist/tokens.css"));
console.log(`  ${"(tokens.css)".padEnd(28)} ${" ".repeat(11)}  css ${bytes(tokens)}`);

const present = measured.helpers.filter((helper) => helper.built);
if (present.length > 0) {
  console.log("helpers counted once (scripts/lib/shared-helpers.mjs):");
  for (const { file, size, users, shared, bundled } of present) {
    // Only a helper that is counted once has a budget of its own. Any other is charged to the
    // components that use it, and is held to the budget there.
    const over = shared && size > BUDGET.js;
    const helperEnforced = enforced.length === 0 || users.some(isEnforced);
    if (over && helperEnforced) failed = true;
    if (over && !helperEnforced) notEnforced++;
    const state = shared
      ? `used by ${users.length}: ${users.join(", ")}`
      : bundled
        ? "bundled with a component's code: not counted once"
        : users.length === 1
          ? `used by ${users[0]} alone: not shared, charged to it`
          : users.length === 0
            ? "used by no component for certain: not counted once"
            : `used by ${users.length}: ${users.join(", ")}`;
    console.log(
      [
        `  ${file.padEnd(28)} js ${bytes(size)}`,
        over ? (helperEnforced ? "OVER BUDGET" : "over budget, not enforced") : "",
        state,
      ]
        .filter(Boolean)
        .join("   "),
    );
  }
}

const all = measured.components.map((component) => component.name);
console.log("loaded together (gzip, every file once):");
console.log(
  `  ${`all ${all.length} components`.padEnd(28)} js ${bytes(measured.loadedTogether(all))}`,
);
if (options.with) {
  const together = options.with.split(/[\s,]+/).filter(Boolean);
  const unknown = together.filter((name) => !all.includes(name));
  if (unknown.length > 0) {
    console.error(`--with: not a component in this build: ${unknown.join(", ")}`);
    process.exit(2);
  }
  console.log(
    `  ${together.join(" + ").padEnd(28)} js ${bytes(measured.loadedTogether(together))}`,
  );
}

if (notEnforced > 0) {
  console.error(
    `\nSize budget, not enforced (${notEnforced}): ENFORCE_COMPONENTS=${enforced.join(",")} leaves these out. They fail the build without it.`,
  );
}
if (failed) {
  console.error(
    `\nA component's own code, or a helper that is counted once, is over the budget of ${BUDGET.js} B JavaScript / ${BUDGET.css} B CSS (gzip). The components a component is built from are not counted, and neither are the helpers listed in scripts/lib/shared-helpers.mjs that two components or more use. Split it, or raise the budget in scripts/report-size.mjs with a reason in the pull request.`,
  );
  process.exit(1);
}
