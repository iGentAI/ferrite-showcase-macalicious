import { describe, expect, it } from "vitest";
import { type Reminder, sortReminders } from "./reminders-data";

const make = (title: string, fields: Partial<Reminder> = {}): Reminder =>
  ({ id: title, listId: "l", title, ...fields }) as Reminder;
const titles = (list: readonly Reminder[]) => list.map((each) => each.title);

const LIST = [
  make("mango", { due: "2026-02-01", priority: "low" }),
  make("Apple"),
  make("zebra", { due: "2026-01-01", dueTime: "09:00", priority: "high" }),
  make("kiwi", { due: "2026-01-01" }),
];

describe("sortReminders", () => {
  it("keeps one being typed last in every order, where its new row is brought into view", () => {
    const typing = [make("", { id: "new" } as Partial<Reminder>), ...LIST];
    for (const sort of ["title", "due", "priority", "created"] as const) {
      expect(titles(sortReminders(typing, sort)).at(-1)).toBe("");
    }
  });
  it("sorts by Creation Date, oldest first, one that does not know it before them, ties kept", () => {
    const made = [
      make("late", { createdAt: 300 }),
      make("early", { createdAt: 100 }),
      make("unknown"),
      make("same a", { createdAt: 200 }),
      make("same b", { createdAt: 200 }),
    ];
    expect(titles(sortReminders(made, "created"))).toEqual([
      "unknown",
      "early",
      "same a",
      "same b",
      "late",
    ]);
  });

  it("keeps the made order for Manual and leaves the given list alone", () => {
    expect(titles(sortReminders(LIST, "manual"))).toEqual(["mango", "Apple", "zebra", "kiwi"]);
    sortReminders(LIST, "title");
    expect(titles(LIST)).toEqual(["mango", "Apple", "zebra", "kiwi"]);
  });

  it("orders by title whatever the letters' case", () => {
    expect(titles(sortReminders(LIST, "title"))).toEqual(["Apple", "kiwi", "mango", "zebra"]);
  });

  it("orders by date, a day's untimed one first and the undated last", () => {
    expect(titles(sortReminders(LIST, "due"))).toEqual(["kiwi", "zebra", "mango", "Apple"]);
  });

  it("orders by priority, keeping the order of those with none", () => {
    expect(titles(sortReminders(LIST, "priority"))).toEqual(["zebra", "mango", "Apple", "kiwi"]);
  });
});
