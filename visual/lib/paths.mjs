import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const referenceDir = path.join(repoRoot, "reference/screenshots");

/** Resolve a reference screenshot by file name (relative to reference/screenshots/). */
export function referencePath(name) {
  const file = path.isAbsolute(name) ? name : path.join(referenceDir, name);
  if (!existsSync(file)) {
    throw new Error(`Reference screenshot not found: ${file}`);
  }
  return file;
}
