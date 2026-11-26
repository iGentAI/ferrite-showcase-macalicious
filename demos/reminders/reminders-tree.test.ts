import { describe, expect, it } from "vitest";
import type { Reminder, ReminderGroup, ReminderList } from "./reminders-data";
import {
  dropGroup,
  dropList,
  dropPlaceAt,
  dropReminders,
  indentReminders,
  moveToList,
  outdentReminders,
  outlineRows,
  scheduledRows,
  settleGroups,
  settleParents,
  sidebarEntries,
  standBefore,
} from "./reminders-tree";

const make = (id: string, parentId?: string, listId = "l"): Reminder => ({
  id,
  listId,
  title: id,
  ...(parentId ? { parentId } : {}),
});
const ids = (rows: readonly Reminder[]) => rows.map((each) => each.id);
const parents = (rows: readonly Reminder[]) =>
  Object.fromEntries(rows.flatMap((each) => (each.parentId ? [[each.id, each.parentId]] : [])));
const list = (id: string, groupId?: string): ReminderList => ({
  id,
  name: id,
  color: "blue",
  ...(groupId ? { groupId } : {}),
});

describe("the outline of reminders", () => {
  it("draws sub-reminders under their parent wherever the array has them, and hides them collapsed", () => {
    const reminders = [make("b", "a"), make("a"), make("c")];
    const open = outlineRows(reminders, new Set());
    expect(
      open.map((row) => (row.kind === "reminder" ? [row.reminder.id, row.depth] : row)),
    ).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 0],
    ]);
    const closed = outlineRows(reminders, new Set(["a"]));
    expect(closed).toHaveLength(2);
    expect(closed[0]).toMatchObject({ collapsed: true, children: 1 });
  });

  it("shows a sub-reminder on its own when its parent is not in the view", () => {
    expect(outlineRows([make("b", "a")], new Set())[0]).toMatchObject({ depth: 0 });
  });

  it("loses no row of a cycle or of a sub-reminder under a sub-reminder", () => {
    const shownIds = (reminders: Reminder[]) =>
      outlineRows(reminders, new Set()).flatMap((row) =>
        row.kind === "reminder" ? [[row.reminder.id, row.depth]] : [],
      );
    expect(shownIds([make("a", "b"), make("b", "a")])).toEqual([
      ["a", 0],
      ["b", 0],
    ]);
    expect(shownIds([make("self", "self")])).toEqual([["self", 0]]);
    expect(shownIds([make("top"), make("mid", "top"), make("low", "mid")])).toEqual([
      ["top", 0],
      ["mid", 1],
      ["low", 0],
    ]);
  });

  it("indents under the row above, or that row's parent, and a parent brings its own along", () => {
    const reminders = [make("a"), make("b"), make("b1", "b"), make("c")];
    const shown = ["a", "b", "b1", "c"];
    expect(parents(indentReminders(reminders, ["b"], shown))).toEqual({ b: "a", b1: "a" });
    expect(parents(indentReminders(reminders, ["c"], shown))).toEqual({ b1: "b", c: "b" });
    expect(parents(indentReminders(reminders, ["b", "c"], shown))).toEqual({
      b: "a",
      b1: "a",
      c: "a",
    });
  });

  it("indents nothing for the first row, and nothing across lists", () => {
    const reminders = [make("a"), make("z", undefined, "other")];
    expect(indentReminders(reminders, ["a"], ["a", "z"])).toBe(reminders);
    expect(indentReminders(reminders, ["z"], ["a", "z"])).toBe(reminders);
  });

  it("outdents to just after the old parent, keeping their order", () => {
    const reminders = [make("a"), make("a1", "a"), make("a2", "a"), make("b")];
    const out = outdentReminders(reminders, ["a1", "a2"]);
    expect(ids(out)).toEqual(["a", "a1", "a2", "b"]);
    expect(parents(out)).toEqual({});
    expect(outdentReminders(reminders, ["b"])).toBe(reminders);
  });

  it("reads the place of a drop from where on the row it is", () => {
    expect([dropPlaceAt(2, 34), dropPlaceAt(17, 34), dropPlaceAt(32, 34)]).toEqual([
      "before",
      "into",
      "after",
    ]);
  });

  it("drops into a row as its last sub-reminder, and beside a sub-reminder at its level", () => {
    const reminders = [make("a"), make("a1", "a"), make("b"), make("c")];
    const into = dropReminders(reminders, ["c"], "a", "into");
    expect(ids(into)).toEqual(["a", "a1", "c", "b"]);
    expect(parents(into)).toEqual({ a1: "a", c: "a" });
    const beside = dropReminders(reminders, ["b"], "a1", "before");
    expect(ids(beside)).toEqual(["a", "b", "a1", "c"]);
    expect(parents(beside)).toEqual({ a1: "a", b: "a" });
    const out = dropReminders(reminders, ["a1"], "c", "before");
    expect(ids(out)).toEqual(["a", "b", "a1", "c"]);
    expect(parents(out)).toEqual({});
  });

  it("changes nothing for a drop on what is dragged or under it, and goes last on no row", () => {
    const reminders = [make("a"), make("a1", "a"), make("b")];
    expect(dropReminders(reminders, ["a"], "a", "into")).toBe(reminders);
    expect(dropReminders(reminders, ["a"], "a1", "into")).toBe(reminders);
    expect(ids(dropReminders(reminders, ["a"], undefined, "after"))).toEqual(["b", "a", "a1"]);
    const other = make("o", undefined, "other");
    expect(dropReminders([...reminders, other], ["o"], "b", "into")).toEqual([...reminders, other]);
  });

  it("moves a parent and what is under it as one block, flat under the row it goes into", () => {
    const reminders = [make("a"), make("a1", "a"), make("b"), make("b1", "b")];
    const into = dropReminders(reminders, ["a"], "b", "into");
    expect(ids(into)).toEqual(["b", "b1", "a", "a1"]);
    expect(parents(into)).toEqual({ b1: "b", a: "b", a1: "b" });
    const beside = dropReminders(reminders, ["a"], "b", "after");
    expect(ids(beside)).toEqual(["b", "a", "a1", "b1"]);
    expect(parents(beside)).toEqual({ a1: "a", b1: "b" });
    const both = dropReminders(reminders, ["a", "a1"], "b", "after");
    expect(ids(both)).toEqual(["b", "a", "a1", "b1"]);
    expect(parents(both)).toEqual({ a1: "a", b1: "b" });
  });

  it("moves a parent's sub-reminders with it, and frees one moved alone", () => {
    const reminders = [make("a"), make("a1", "a"), make("b"), make("b1", "b")];
    const moved = moveToList(reminders, ["a", "b1"], "home");
    expect(moved.map((each) => each.listId)).toEqual(["home", "home", "l", "home"]);
    expect(parents(moved)).toEqual({ a1: "a" });
  });

  it("takes off a parent that no longer holds, and leaves the array when all do", () => {
    const good = [make("a"), make("a1", "a")];
    expect(settleParents(good)).toBe(good);
    expect(parents(settleParents([make("a1", "gone")]))).toEqual({});
    expect(parents(settleParents([make("a", undefined, "o"), make("a1", "a")]))).toEqual({});
    expect(parents(settleParents([make("a", "z"), make("z"), make("a1", "a")]))).toEqual({
      a: "z",
    });
  });
});

describe("Scheduled by day", () => {
  it("heads past days as one, then each day to come, with no date last", () => {
    const due = (id: string, day?: string): Reminder => ({
      ...make(id),
      ...(day ? { due: day } : {}),
    });
    const rows = scheduledRows(
      [
        due("later", "2026-11-12"),
        due("old", "2026-10-01"),
        due("none"),
        due("tomorrow", "2026-11-04"),
        due("today", "2026-11-03"),
      ],
      "2026-11-03",
    );
    expect(rows.map((row) => (row.kind === "day" ? row.label : row.reminder.id))).toEqual([
      "Past Due",
      "old",
      "Today",
      "today",
      "Tomorrow",
      "tomorrow",
      new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date("2026-11-12T00:00:00Z")),
      "later",
      "No Date",
      "none",
    ]);
  });
});

describe("the sidebar's groups", () => {
  const groups = [
    { id: "g", name: "G" },
    { id: "e", name: "Empty" },
  ];

  it("draws a group where its first list is, and groups with no list last", () => {
    const entries = sidebarEntries([list("a"), list("b", "g"), list("c"), list("d", "g")], groups);
    expect(
      entries.map((entry) =>
        entry.kind === "list"
          ? entry.list.id
          : [entry.group.id, entry.lists.map((each) => each.id)],
      ),
    ).toEqual(["a", ["g", ["b", "d"]], "c", ["e", []]]);
  });

  it("puts a dropped list into a group, beside a member, beside a list and last", () => {
    const lists = [list("a"), list("b", "g"), list("c")];
    const got = (each: readonly ReminderList[]) =>
      each.map((item) => `${item.id}${item.groupId ? `:${item.groupId}` : ""}`);
    expect(got(dropList(lists, "c", "g", "into"))).toEqual(["a", "b:g", "c:g"]);
    expect(got(dropList(lists, "c", "b", "before"))).toEqual(["a", "c:g", "b:g"]);
    expect(got(dropList(lists, "b", "a", "before"))).toEqual(["b", "a", "c"]);
    expect(got(dropList(lists, "b", undefined, "after"))).toEqual(["a", "c", "b"]);
    expect(got(dropList(lists, "a", "g", "after"))).toEqual(["b:g", "a", "c"]);
    expect(got(dropList(lists, "a", "e", "into"))).toEqual(["b:g", "c", "a:e"]);
  });

  it("moves a group's lists together", () => {
    const lists = [list("a"), list("b", "g"), list("c", "g"), list("d")];
    const moved = dropGroup(lists, groups, "g", "d", "after");
    expect(moved.lists.map((each) => each.id)).toEqual(["a", "d", "b", "c"]);
    const first = dropGroup(lists, groups, "g", "a", "before");
    expect(first.lists.map((each) => each.id)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves a group with no list among the rows, before the list it names", () => {
    const lists = [list("a"), list("b", "g"), list("c")];
    const order = (now: ReturnType<typeof dropGroup>) =>
      sidebarEntries(now.lists, now.groups).map((entry) =>
        entry.kind === "list" ? entry.list.id : entry.group.id,
      );
    const first = dropGroup(lists, groups, "e", "a", "before");
    expect(order(first)).toEqual(["e", "a", "g", "c"]);
    expect(first.lists).toBe(lists);
    expect(first.groups.find((each) => each.id === "e")?.before).toBe("a");
    expect(order(dropGroup(lists, groups, "e", "g", "after"))).toEqual(["a", "g", "e", "c"]);
    expect(order(dropGroup(lists, groups, "e", "g", "before"))).toEqual(["a", "e", "g", "c"]);
    expect(order(dropGroup(first.lists, first.groups, "e", undefined, "after"))).toEqual([
      "a",
      "g",
      "c",
      "e",
    ]);
    const two = [
      { id: "x", name: "X" },
      { id: "y", name: "Y" },
    ];
    const swapped = dropGroup([list("a")], two, "y", "x", "before");
    expect(order(swapped)).toEqual(["a", "y", "x"]);
  });

  it("puts rows beside a group with no list where it stands", () => {
    const placed = [{ id: "e", name: "Empty", before: "b" }];
    const lists = [list("a"), list("b"), list("c")];
    expect(dropList(lists, "c", "e", "into", placed).map((each) => each.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
    expect(dropList(lists, "c", "e", "into", placed)[1]?.groupId).toBe("e");
    const filled = dropGroup(lists, [...placed, { id: "g", name: "G" }], "e", "c", "after");
    expect(filled.groups.find((each) => each.id === "e")?.before).toBeUndefined();
  });

  it("keeps a row dropped after a group with no list behind that group", () => {
    const order = (now: readonly ReminderList[], held: readonly ReminderGroup[]) =>
      sidebarEntries(now, held).map((entry) =>
        entry.kind === "list" ? entry.list.id : entry.group.id,
      );
    const placed = [{ id: "e", name: "Empty", before: "b" }];
    const lists = [list("a"), list("b"), list("c")];
    const dropped = dropList(lists, "c", "e", "after", placed);
    expect(order(dropped, standBefore(placed, lists, "e", "after", "c"))).toEqual([
      "a",
      "e",
      "c",
      "b",
    ]);
    const last = [{ id: "e", name: "Empty" }];
    const atEnd = dropList(lists, "a", "e", "after", last);
    expect(order(atEnd, standBefore(last, lists, "e", "after", "a"))).toEqual(["b", "c", "e", "a"]);
    const members = [list("a"), list("m", "g"), list("n", "g"), list("b")];
    const both = [...placed, { id: "g", name: "G" }];
    const moved = dropGroup(members, both, "g", "e", "after");
    expect(order(moved.lists, moved.groups)).toEqual(["a", "e", "g", "b"]);
    expect(standBefore(placed, [list("z", "e")], "e", "after", "c")).toBe(placed);
    const pair = [
      { id: "x", name: "X", before: "b" },
      { id: "y", name: "Y", before: "b" },
    ];
    const dropAfter = (group: string) => {
      const now = dropList(lists, "c", group, "after", pair);
      return order(now, standBefore(pair, now, group, "after", "c"));
    };
    expect(dropAfter("y")).toEqual(["a", "x", "y", "c", "b"]);
    expect(dropAfter("x")).toEqual(["a", "x", "c", "y", "b"]);
    const only = [list("a", "g"), list("b")];
    const held = [{ id: "g", name: "G" }];
    const out = dropList(only, "a", "g", "after", held);
    expect(order(out, standBefore(held, out, "g", "after", "a"))).toEqual(["g", "a", "b"]);
  });

  it("frees lists whose group is gone", () => {
    const lists = [list("a", "gone"), list("b", "g")];
    expect(settleGroups(lists, groups).map((each) => each.groupId)).toEqual([undefined, "g"]);
    const fine = [list("b", "g")];
    expect(settleGroups(fine, groups)).toBe(fine);
  });
});
