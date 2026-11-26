import { describe, expect, it } from "vitest";
import type { FinderEntry, FinderNode } from "./finder-data";
import { groupEntries } from "./finder-groups";

const entry = (node: Partial<FinderNode> & { name: string }): FinderEntry => ({
  path: `/${node.name}`,
  node: { kind: "document", ...node } as FinderNode,
});
const NOW = new Date(2026, 10, 15, 12, 0);
const shape = (groups: ReturnType<typeof groupEntries>) =>
  groups.map(({ label, entries }) => [label, entries.map((each) => each.node.name)]);

describe("groupEntries", () => {
  it("puts dates in Finder's sections, nearest first", () => {
    const items = [
      entry({ name: "old", modified: "2024-03-01 09:00" }),
      entry({ name: "march", modified: "2026-03-01 09:00" }),
      entry({ name: "month", modified: "2026-10-20 09:00" }),
      entry({ name: "week", modified: "2026-11-10 09:00" }),
      entry({ name: "yesterday", modified: "2026-11-14 09:00" }),
      entry({ name: "today", modified: "2026-11-15 09:00" }),
      entry({ name: "never" }),
    ];
    expect(shape(groupEntries(items, "modified", NOW))).toEqual([
      ["Today", ["today"]],
      ["Yesterday", ["yesterday"]],
      ["Previous 7 Days", ["week"]],
      ["Previous 30 Days", ["month"]],
      ["March", ["march"]],
      ["2024", ["old"]],
      ["Unknown", ["never"]],
    ]);
  });

  it("puts sizes largest first with folders last, and keeps the order given", () => {
    const items = [
      entry({ name: "b", size: 2_000_000 }),
      entry({ name: "small", size: 10 }),
      entry({ name: "a", size: 3_000_000 }),
      entry({ name: "huge", size: 2_000_000_000 }),
      entry({ name: "folder", children: [] }),
    ];
    expect(shape(groupEntries(items, "size", NOW))).toEqual([
      ["Larger than 1 GB", ["huge"]],
      ["1 MB to 100 MB", ["b", "a"]],
      ["Less than 100 KB", ["small"]],
      ["Folders", ["folder"]],
    ]);
  });

  it("groups by kind, tag and first letter", () => {
    const items = [
      entry({ name: "apple", kindLabel: "Plain Text", tags: ["Red"] }),
      entry({ name: "Pear", kindLabel: "PDF document" }),
      entry({ name: "Avocado", children: [] }),
      entry({ name: "7 up", kindLabel: "Plain Text" }),
    ];
    expect(shape(groupEntries(items, "kind", NOW))).toEqual([
      ["Folders", ["Avocado"]],
      ["PDF document", ["Pear"]],
      ["Plain Text", ["apple", "7 up"]],
    ]);
    expect(
      shape(groupEntries([entry({ name: "both", tags: ["Red", "Blue"] }), ...items], "tags", NOW)),
    ).toEqual([
      ["Blue", ["both"]],
      ["Red", ["both", "apple"]],
      ["No Tags", ["Pear", "Avocado", "7 up"]],
    ]);
    expect(shape(groupEntries(items, "tags", NOW))).toEqual([
      ["Red", ["apple"]],
      ["No Tags", ["Pear", "Avocado", "7 up"]],
    ]);
    expect(shape(groupEntries(items, "name", NOW))).toEqual([
      ["#", ["7 up"]],
      ["A", ["apple", "Avocado"]],
      ["P", ["Pear"]],
    ]);
  });
});
