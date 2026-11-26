import { describe, expect, it } from "vitest";
import { eventsOnDay, monthGridDays, rowsOfDay } from "./calendar-month-grid";

describe("the month grid's days", () => {
  it("starts on the week's first day and ends with the last whole week", () => {
    const days = monthGridDays(new Date(2019, 9, 15), 0);
    expect(days).toHaveLength(35);
    expect(days[0]).toEqual(new Date(2019, 8, 29));
    expect(days[34]).toEqual(new Date(2019, 10, 2));
  });

  it("has four weeks for a February that fits them and six when the month spreads", () => {
    expect(monthGridDays(new Date(2026, 1, 10), 0)).toHaveLength(28);
    expect(monthGridDays(new Date(2026, 7, 10), 0)).toHaveLength(42);
  });

  it("follows the first day of the week", () => {
    expect(monthGridDays(new Date(2019, 9, 15), 1)[0]).toEqual(new Date(2019, 8, 30));
  });
});

describe("the rows of a crowded day", () => {
  const day = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const ids = (fits: number, selected: string | null) =>
    rowsOfDay(day, fits, selected).map((entry) => entry.id);

  it("draws them all when they fit", () => {
    expect(ids(4, null)).toEqual(["a", "b", "c", "d"]);
  });

  it("leaves a row for more, and none for events when only one row fits", () => {
    expect(ids(3, null)).toEqual(["a", "b"]);
    expect(ids(1, null)).toEqual([]);
  });

  it("keeps a drawn event in its place when it is selected", () => {
    expect(ids(3, "b")).toEqual(["a", "b"]);
  });

  it("puts a selected event that would be hidden in the last row", () => {
    expect(ids(3, "d")).toEqual(["a", "d"]);
  });
});

describe("the events on a day", () => {
  const at = (day: number, hour = 0) => new Date(2019, 9, day, hour);

  it("puts all-day events first and leaves out one that ends as the day begins", () => {
    const timed = { start: at(2, 9), end: at(2, 10) };
    const later = { start: at(2, 14), end: at(2, 15) };
    const allDay = { start: at(2), end: at(3), allDay: true };
    const before = { start: at(1), end: at(2), allDay: true };
    expect(eventsOnDay([later, timed, before, allDay], at(2))).toEqual([allDay, timed, later]);
  });

  it("keeps an event with no length on its day", () => {
    const moment = { start: at(2, 9), end: at(2, 9) };
    expect(eventsOnDay([moment], at(2))).toEqual([moment]);
    expect(eventsOnDay([moment], at(3))).toEqual([]);
  });
});
