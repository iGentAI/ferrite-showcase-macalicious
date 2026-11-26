import { describe, expect, it } from "vitest";
import type { Reminder } from "./reminders-data";
import {
  closedAlert,
  readRemindersView,
  readTodayNotification,
  remindersPrintLines,
  sharedAlerts,
  TODAY_ALERT,
  todayAlert,
} from "./reminders-kept";

const reminder = (fields: Partial<Reminder>) =>
  ({ id: "r", listId: "l", title: "Pack", ...fields }) as Reminder;

describe("a view of Reminders printed", () => {
  it("marks what is done, with dates and notes under each", () => {
    expect(
      remindersPrintLines("Trips", [
        reminder({ completed: true }),
        reminder({ title: "Book", due: "2026-11-03", dueTime: "09:00", notes: "Ferry\nEarly" }),
      ]),
    ).toEqual([
      "Trips",
      "",
      "[x] Pack",
      "[ ] Book",
      "    2026-11-03 09:00",
      "    Ferry",
      "    Early",
    ]);
  });

  it("says so when the view is empty", () => {
    expect(remindersPrintLines("Today", [])).toEqual(["Today", "", "No Reminders"]);
  });
});

describe("the Today notification", () => {
  const on = { on: true, time: "09:00" };
  const due = [reminder({ title: "Pack", due: "2026-11-03" })];

  it("comes from its minute on, saying the one reminder due or how many", () => {
    expect(todayAlert(on, due, "2026-11-03", "08:59", 1)).toBeUndefined();
    expect(todayAlert(on, due, "2026-11-03", "09:00", 1)).toEqual({
      id: TODAY_ALERT,
      title: "Pack",
      at: 1,
    });
    expect(todayAlert(on, [...due, ...due], "2026-11-03", "15:00", 1)?.title).toBe(
      "2 reminders are due today",
    );
  });

  it("stays away when off, closed today, or with nothing due", () => {
    expect(todayAlert({ ...on, on: false }, due, "2026-11-03", "10:00", 1)).toBeUndefined();
    expect(
      todayAlert({ ...on, closedOn: "2026-11-03" }, due, "2026-11-03", "10:00", 1),
    ).toBeUndefined();
    expect(todayAlert(on, [], "2026-11-03", "10:00", 1)).toBeUndefined();
    expect(todayAlert({ ...on, closedOn: "2026-11-02" }, due, "2026-11-03", "10:00", 1)?.id).toBe(
      TODAY_ALERT,
    );
  });

  it("reads only what Preferences writes", () => {
    expect(readTodayNotification(on)).toEqual(on);
    expect(readTodayNotification({ on: true, time: "9" })).toBeUndefined();
    expect(readTodayNotification("on")).toBeUndefined();
  });
});

describe("a shared list's alerts", () => {
  const due = reminder({
    id: "sh/1",
    due: "2026-11-03",
    dueTime: "09:00",
    timeZone: "UTC",
  });
  const at = Date.UTC(2026, 10, 3, 9);

  it("come at the due instant, for a day, until closed or completed", () => {
    expect(sharedAlerts([due], {}, at - 1)).toEqual([]);
    expect(sharedAlerts([due], {}, at)).toEqual([{ id: "sh/1", title: "Pack", at }]);
    expect(sharedAlerts([due], {}, at + 86_400_001)).toEqual([]);
    expect(sharedAlerts([due], { "sh/1": at }, at)).toEqual([]);
    expect(sharedAlerts([{ ...due, completed: true }], {}, at)).toEqual([]);
  });

  it("are remembered closed within what one desktop value holds, the oldest dropped first", () => {
    let closed: Readonly<Record<string, number>> = {};
    for (let at = 0; at < 200; at += 1)
      closed = closedAlert(closed, `sh-${"x".repeat(40)}/${at}`, at);
    expect(new TextEncoder().encode(JSON.stringify(closed)).length).toBeLessThanOrEqual(4000);
    const key = `sh-${"x".repeat(40)}/199`;
    expect(closed[key]).toBe(199);
    expect(closed[`sh-${"x".repeat(40)}/0`]).toBeUndefined();
  });
});

describe("the kept view", () => {
  it("takes only what the window writes", () => {
    const view = { source: "today", sort: "due", showCompleted: true };
    expect(readRemindersView(view)).toEqual(view);
    expect(readRemindersView({ ...view, sort: "size" })).toBeUndefined();
    expect(readRemindersView(null)).toBeUndefined();
  });
});
