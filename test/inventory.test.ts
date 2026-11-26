import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * The component inventory (reference/spec/inventory.json) is the checklist of what the library
 * has to build. Every row says what implements it; these tests hold that to the tree, so that
 * a row cannot be left open, or keep pointing at something that was moved, without a failure.
 * A new component folder without a row is reported by `reference/spec/tools/build.py check`.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface Row {
  id: string;
  status: string;
  batch: string | null;
  implementation: string[];
}

const inventory = JSON.parse(
  readFileSync(path.join(root, "reference/spec/inventory.json"), "utf8"),
) as { components: Row[]; components_total: number; components_implemented: number };

describe("component inventory", () => {
  it("has no open row: every row names what implements it", () => {
    const open = inventory.components.filter((row) => row.implementation.length === 0);
    expect(open.map((row) => row.id)).toEqual([]);
    expect(inventory.components_implemented).toBe(inventory.components_total);
  });

  it("names implementations that exist", () => {
    const missing = inventory.components.flatMap((row) =>
      row.implementation
        .filter((file) => !existsSync(path.join(root, file)))
        .map((file) => `${row.id}: ${file}`),
    );
    expect(missing).toEqual([]);
  });

  it("implements a row with the component folder of the same name when there is one", () => {
    const components = path.join(root, "src/components");
    const folders = new Set(
      readdirSync(components).filter((name) => statSync(path.join(components, name)).isDirectory()),
    );
    const stale = inventory.components
      .filter((row) => folders.has(row.id))
      .filter((row) => row.implementation.join() !== `src/components/${row.id}/`)
      .map((row) => row.id);
    expect(stale).toEqual([]);
  });
});
