import { describe, expect, it } from "vitest";
import type { FinderEntry } from "../finder/finder-data";
import { arrivals, stackOf, stacksOf } from "./desktop-drive-items";

const NOW = new Date(2026, 10, 3, 12, 0);
const entry = (id: string, created?: string, tags?: string[]): FinderEntry =>
  ({
    path: `/Users/me/Desktop/${id}`,
    node: { id, name: id, kind: "document", created, modified: created, tags },
  }) as FinderEntry;

describe("when an item got to the desktop", () => {
  it("counts from when it was made the first time, with nothing kept", () => {
    expect(arrivals(undefined, [entry("a", "2026-01-02 03:04")], NOW.getTime())).toEqual({
      a: new Date(2026, 0, 2, 3, 4).getTime(),
    });
  });

  it("counts from now for one not seen before, and keeps the others", () => {
    const items = [entry("a", "2026-01-02 03:04"), entry("b", "2020-01-01 00:00")];
    expect(arrivals({ a: 5 }, items, NOW.getTime())).toEqual({ a: 5, b: NOW.getTime() });
  });

  it("forgets one that left, so it arrives again if it comes back", () => {
    expect(arrivals({ a: 5, gone: 6 }, [entry("a")], NOW.getTime())).toEqual({ a: 5 });
  });

  it("answers the same record when nothing changed", () => {
    const kept = { a: 5 };
    expect(arrivals(kept, [entry("a")], NOW.getTime())).toBe(kept);
  });
});

describe("Group Stacks By", () => {
  it("names the stack of a date as seen from now", () => {
    const on = (stamp: string) => stackOf(entry("a", stamp), "created", NOW);
    expect(on("2026-11-03 01:00")).toBe("Today");
    expect(on("2026-11-02 23:00")).toBe("Yesterday");
    expect(on("2026-10-29 12:00")).toBe("Previous 7 Days");
    expect(on("2026-10-10 12:00")).toBe("Previous 30 Days");
    expect(on("2026-01-01 12:00")).toBe("Earlier");
  });

  it("puts an old file that just arrived under Today for Date Added only", () => {
    const old = entry("a", "2020-01-01 00:00");
    const added = { a: NOW.getTime() };
    expect(stackOf(old, "added", NOW, added)).toBe("Today");
    expect(stackOf(old, "created", NOW, added)).toBe("Earlier");
  });

  it("orders dates in time and leaves untagged items last", () => {
    const items = [entry("old", "2020-01-01 00:00"), entry("new", "2026-11-03 09:00")];
    expect(stacksOf(items, "created", NOW).map(([name]) => name)).toEqual(["Today", "Earlier"]);
    const tagged = [entry("plain"), entry("red", undefined, ["Red"])];
    expect(stacksOf(tagged, "tags", NOW).map(([name]) => name)).toEqual(["Red", "No Tags"]);
  });
});
