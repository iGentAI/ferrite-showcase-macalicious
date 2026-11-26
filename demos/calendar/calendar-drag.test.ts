import { describe, expect, it } from "vitest";
import { draggedTimes, dragModeAt, dragShift, movesWhole, SNAP_MINUTES } from "./calendar-drag";

/* What a drag in the week grid does to an event's times (calendar-drag.ts). */

const meeting = {
  start: new Date(2019, 9, 3, 14),
  end: new Date(2019, 9, 3, 16, 45),
};
const at = (day: number, hours: number, minutes = 0) => new Date(2019, 9, day, hours, minutes);

describe("a drag in the week grid", () => {
  it("moves an event by days and minutes, keeping how long it lasts", () => {
    expect(draggedTimes(meeting, "move", 1, 60)).toEqual({ start: at(4, 15), end: at(4, 17, 45) });
    expect(draggedTimes(meeting, "move", -2, -15)).toEqual({
      start: at(1, 13, 45),
      end: at(1, 16, 30),
    });
  });

  it("changes its end or its start alone, never closer than a step to the other", () => {
    expect(draggedTimes(meeting, "end", 3, 30)).toEqual({ start: at(3, 14), end: at(3, 17, 15) });
    expect(draggedTimes(meeting, "end", 0, -600)).toEqual({
      start: at(3, 14),
      end: at(3, 14, SNAP_MINUTES),
    });
    expect(draggedTimes(meeting, "start", 0, -60)).toEqual({
      start: at(3, 13),
      end: at(3, 16, 45),
    });
    expect(draggedTimes(meeting, "start", 0, 600)).toEqual({
      start: at(3, 16, 30),
      end: at(3, 16, 45),
    });
  });

  it("moves an all-day event by whole days, keeping its number of days", () => {
    const trip = { start: new Date(2019, 9, 3), end: new Date(2019, 9, 5), allDay: true };
    expect(draggedTimes(trip, "move", 2, 0)).toEqual({
      start: new Date(2019, 9, 5),
      end: new Date(2019, 9, 7),
    });
  });

  it("keeps the time of day on the wall clock across a change of the clocks", () => {
    const zone = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      // Saturday 7 March 2026, 9:00, moved a day on: Sunday 8 March at 9:00 EDT, an hour less
      // apart in elapsed time.
      const before = { start: new Date(2026, 2, 7, 9), end: new Date(2026, 2, 7, 10) };
      const { start, end } = draggedTimes(before, "move", 1, 0);
      expect(start.toISOString()).toBe("2026-03-08T13:00:00.000Z");
      expect(end.toISOString()).toBe("2026-03-08T14:00:00.000Z");
    } finally {
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    }
  });

  it("counts an all-day event moved onto or off a day of 23 or 25 hours as a move", () => {
    const zone = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      const allDay = (month: number, date: number) => ({
        start: new Date(2026, month, date),
        end: new Date(2026, month, date + 1),
        allDay: true,
      });
      const onto = allDay(2, 7);
      const moved = draggedTimes(onto, "move", 1, 0);
      expect(moved.end.getTime() - moved.start.getTime()).toBe(23 * 36e5);
      expect(movesWhole(onto, moved)).toBe(true);
      expect(dragShift(onto, moved)).toEqual({ days: 1, minutes: 0 });

      const off = allDay(10, 1);
      expect(off.end.getTime() - off.start.getTime()).toBe(25 * 36e5);
      const back = draggedTimes(off, "move", -1, 0);
      expect(movesWhole(off, back)).toBe(true);
      expect(dragShift(off, back)).toEqual({ days: -1, minutes: 0 });

      // The other selected event goes by the same shift, a day of its own later.
      const other = allDay(2, 9);
      expect(draggedTimes(other, "move", 1, 0)).toEqual({
        start: new Date(2026, 2, 10),
        end: new Date(2026, 2, 11),
      });
    } finally {
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    }
  });

  it("counts a changed start or end, or a changed number of days, as no move", () => {
    const timed = { start: at(2, 10), end: at(2, 11) };
    expect(movesWhole(timed, draggedTimes(timed, "move", 2, 30))).toBe(true);
    expect(movesWhole(timed, draggedTimes(timed, "end", 0, 30))).toBe(false);
    expect(movesWhole(timed, draggedTimes(timed, "start", 0, 15))).toBe(false);
    const trip = { start: at(2, 0), end: at(4, 0), allDay: true };
    expect(movesWhole(trip, { start: at(3, 0), end: at(4, 0) })).toBe(false);
  });

  it("changes an edge's time when pressed on it, and moves the event between them", () => {
    const block = {
      getBoundingClientRect: () => ({ top: 100, bottom: 200, height: 100 }) as DOMRect,
    } as Element;
    expect(dragModeAt(block, meeting, 198)).toBe("end");
    expect(dragModeAt(block, meeting, 102)).toBe("start");
    expect(dragModeAt(block, meeting, 150)).toBe("move");
    // An all-day event, and one that reaches another day, move whole.
    expect(dragModeAt(block, { ...meeting, allDay: true }, 198)).toBe("move");
    expect(dragModeAt(block, { ...meeting, end: at(4, 1) }, 198)).toBe("move");
  });
});
