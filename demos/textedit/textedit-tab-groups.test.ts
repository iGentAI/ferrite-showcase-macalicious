import { describe, expect, it } from "vitest";
import {
  groupOf,
  joinTabs,
  leaveTabs,
  mergeTabs,
  NO_TABS,
  neighbourTab,
  pruneTabs,
  readTabs,
  selectTab,
} from "./textedit-tab-groups";

const two = mergeTabs(NO_TABS, ["a", "b"], "b");

describe("the record of tab groups", () => {
  it("merges windows into one group, taking them out of any they were in", () => {
    expect(two.groups).toEqual([{ ids: ["a", "b"], selected: "b" }]);
    expect(mergeTabs(two, ["b", "c", "d"], "c").groups).toEqual([
      { ids: ["b", "c", "d"], selected: "c" },
    ]);
    expect(mergeTabs(NO_TABS, ["a"], "a")).toBe(NO_TABS);
  });

  it("puts a new tab after the one that asked, selected", () => {
    expect(joinTabs(NO_TABS, "a", "b").groups).toEqual([{ ids: ["a", "b"], selected: "b" }]);
    expect(joinTabs(mergeTabs(NO_TABS, ["a", "b"], "a"), "a", "c").groups).toEqual([
      { ids: ["a", "c", "b"], selected: "c" },
    ]);
  });

  it("selects the neighbour when the selected tab leaves, and a last tab is a window", () => {
    const three = mergeTabs(NO_TABS, ["a", "b", "c"], "b");
    expect(leaveTabs(three, "b").groups).toEqual([{ ids: ["a", "c"], selected: "c" }]);
    expect(leaveTabs(three, "a").groups).toEqual([{ ids: ["b", "c"], selected: "b" }]);
    expect(leaveTabs(two, "a").groups).toEqual([]);
    expect(leaveTabs(NO_TABS, "a")).toBe(NO_TABS);
  });

  it("goes round for the next and the previous tab", () => {
    expect(neighbourTab({ ids: ["a", "b"], selected: "b" }, 1)).toBe("a");
    expect(neighbourTab({ ids: ["a", "b"], selected: "a" }, -1)).toBe("b");
  });

  it("selects only a tab of a group, and changes nothing for one selected already", () => {
    expect(selectTab(two, "z")).toBe(two);
    expect(selectTab(two, "b")).toBe(two);
    expect(groupOf(selectTab(two, "a"), "b")?.selected).toBe("a");
  });

  it("drops the windows that are gone", () => {
    const record = { ...mergeTabs(NO_TABS, ["a", "b", "c"], "a"), bars: ["z", "b"] };
    expect(pruneTabs(record, new Set(["b", "c"]))).toEqual({
      groups: [{ ids: ["b", "c"], selected: "b" }],
      bars: ["b"],
    });
  });

  it("reads back what it wrote and refuses anything else", () => {
    expect(readTabs(JSON.parse(JSON.stringify(two)))).toEqual(two);
    expect(readTabs({ groups: [{ ids: ["a"], selected: "a" }], bars: [] })).toEqual(NO_TABS);
    expect(readTabs({ groups: [{ ids: ["a", "b"], selected: "c" }], bars: [] })).toEqual(NO_TABS);
    expect(readTabs("tabs")).toBeUndefined();
  });
});
