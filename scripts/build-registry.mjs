#!/usr/bin/env node
// Generate the copy-in registry from the source tree into dist/registry/. The work is in
// scripts/lib/registry.mjs; this is the command `npm run build` calls.
//
//   node scripts/build-registry.mjs [--root <package folder>]
//
// --root builds the registry of another tree (the tests use it on small fixture packages).
// The output is always <root>/dist/registry, which is replaced as a whole.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { buildRegistry } from "./lib/registry.mjs";

const { values: options } = parseArgs({
  options: {
    root: {
      type: "string",
      default: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    },
  },
});

const root = path.resolve(options.root);
const out = path.join(root, "dist/registry");

try {
  const names = await buildRegistry({ root, out });
  console.log(
    `registry: ${names.length} items in ${path.relative(root, out)}/ (${names.join(", ")})`,
  );
} catch (error) {
  console.error(`registry: ${error.message}`);
  process.exit(1);
}
