import { describe, expect, it } from "vitest";
import { findCategory, type SystemInformationItem } from "./system-information-data";
import { readOutlineLayout } from "./system-information-desktop";

const item = (id: string, name: string, text: string, children?: SystemInformationItem[]) =>
  ({
    id,
    name,
    report: { kind: "empty", message: text },
    children,
  }) as unknown as SystemInformationItem;

const items = [
  item("a", "Hardware", "nothing", [item("a1", "Memory", "sixteen")]),
  item("b", "Network", "nothing"),
];

describe("System Information's Find", () => {
  it("finds by name, any letter case, going round from the category shown", () => {
    expect(findCategory(items, "MEMORY", "b")?.id).toBe("a1");
    expect(findCategory(items, "network", "a")?.id).toBe("b");
    expect(findCategory(items, "hardware", "a")?.id).toBe("a");
  });

  it("finds nothing for empty or absent words", () => {
    expect(findCategory(items, "  ", "a")).toBeUndefined();
    expect(findCategory(items, "nowhere", "a")).toBeUndefined();
  });
});

describe("System Information's kept outline", () => {
  it("takes only what the outline can use", () => {
    expect(readOutlineLayout({ expanded: ["a", 3], size: 200 })).toEqual({
      expanded: ["a"],
      size: 200,
    });
    expect(readOutlineLayout({ size: 9000 })).toEqual({});
    expect(readOutlineLayout("no")).toBeUndefined();
  });
});
