import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
function check(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) check(file);
    else if (entry.name.endsWith(".rs")) {
      for (const match of readFileSync(file, "utf8")
        .replace(/^\s*\/\/.*$/gm, "")
        .matchAll(/include_(?:str|bytes)!\s*\(\s*"([^"\n]+)"/g)) {
        const target = path.resolve(path.dirname(file), match[1]);
        const relative = path.relative(root, target);
        assert(
          relative !== "ferrite.json" && !relative.startsWith(".ferrite/"),
          `${file}: ${match[1]} is removed from deployment source`,
        );
      }
    }
  }
}
check(path.join(root, "src"));
console.log("Source includes do not depend on deployment-only metadata.");
