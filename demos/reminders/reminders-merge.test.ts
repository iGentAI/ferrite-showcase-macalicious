import { describe, expect, it } from "vitest";
import type { Reminder, ReminderList } from "./reminders-data";
import { mergeItems, mergeReminders } from "./reminders-merge";

/*
 * A window takes in another copy of the person's reminders by making its own changes since the
 * copy it last took in again on the new one: field by field, adding what either side added, and
 * letting a removal on either side win.
 */

const list = (id: string, name = id): ReminderList => ({ id, name, color: "blue" });
const reminder = (id: string, extra: Partial<Reminder> = {}): Reminder => ({
  id,
  listId: "home",
  title: id,
  ...extra,
});

describe("taking in another copy of the person's reminders", () => {
  it("keeps the window's changes and the other side's, field by field", () => {
    const base = [reminder("a"), reminder("b")];
    const mine = [reminder("a", { completed: true }), reminder("b")];
    const theirs = [reminder("a", { title: "A renamed" }), reminder("b", { flagged: true })];
    expect(mergeItems(base, mine, theirs)).toEqual([
      reminder("a", { title: "A renamed", completed: true }),
      reminder("b", { flagged: true }),
    ]);
  });

  it("adds what either side added, and is the incoming copy itself when nothing of the window's applies", () => {
    const base = [reminder("a")];
    const theirs = [reminder("a"), reminder("b")];
    expect(mergeItems(base, base, theirs)).toBe(theirs);
    expect(mergeItems(base, [reminder("a"), reminder("c")], theirs)).toEqual([
      reminder("a"),
      reminder("b"),
      reminder("c"),
    ]);
  });

  it("lets a removal on either side win over an edit on the other, so nothing removed comes back", () => {
    const base = [reminder("a"), reminder("b")];
    // Removed elsewhere, edited here.
    expect(
      mergeItems(base, [reminder("a", { completed: true }), reminder("b")], [reminder("b")]),
    ).toEqual([reminder("b")]);
    // Removed here, edited elsewhere.
    expect(
      mergeItems(base, [reminder("b")], [reminder("a", { flagged: true }), reminder("b")]),
    ).toEqual([reminder("b")]);
  });

  it("takes a field the window cleared as cleared", () => {
    const base = [reminder("a", { due: "2026-10-21", timeZone: "UTC" })];
    const theirs = [reminder("a", { due: "2026-10-21", timeZone: "UTC", flagged: true })];
    expect(mergeItems(base, [reminder("a")], theirs)).toEqual([reminder("a", { flagged: true })]);
  });

  it("drops the reminders of a list removed on either side, and keeps a list's own changes", () => {
    const work = (id: string) => reminder(id, { listId: "work" });
    const base = { lists: [list("home"), list("work")], reminders: [reminder("a"), work("w")] };
    const mine = {
      lists: [list("home", "House"), list("work")],
      reminders: [reminder("a"), work("w"), work("w2")],
    };
    const theirs = { lists: [list("home")], reminders: [reminder("a")] };
    expect(mergeReminders(base, mine, theirs)).toEqual({
      lists: [list("home", "House")],
      groups: [],
      reminders: [reminder("a")],
    });
  });

  it("leaves one level of sub-reminders when two windows each indent", () => {
    const a = reminder("a");
    const b = reminder("b");
    const c = reminder("c");
    const base = { lists: [list("home")], reminders: [a, b, c] };
    const mine = {
      lists: [list("home")],
      reminders: [a, { ...b, parentId: "a" }, c],
    };
    const theirs = {
      lists: [list("home")],
      reminders: [{ ...a, parentId: "c" }, b, c],
    };
    const merged = mergeReminders(base, mine, theirs).reminders;
    expect(merged.find((each) => each.id === "a")?.parentId).toBe("c");
    expect(merged.find((each) => each.id === "b")?.parentId).toBeUndefined();
  });
});
