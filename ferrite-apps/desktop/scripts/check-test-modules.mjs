import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const directory = new URL("../tests/", import.meta.url);
const expected = readdirSync(directory)
  .filter(
    (name) =>
      (name.endsWith(".rs") && name !== "contracts.rs") ||
      existsSync(new URL(`${name}/mod.rs`, directory)),
  )
  .map((name) => (name.endsWith(".rs") ? name.slice(0, -3) : name))
  .sort();
const source = readFileSync(new URL("contracts.rs", directory), "utf8");
const actual = [...source.matchAll(/^mod ([a-z_0-9]+);$/gm)].map((match) => match[1]).sort();
assert.deepEqual(actual, expected, "Every integration test file must be included in contracts.rs");
console.log(`All ${expected.length} integration test modules are included.`);
