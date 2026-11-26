import { describe, expect, it } from "vitest";
import { densityLevel, eventsPerDay, TRAVEL_BLOCK, withTravelBlocks } from "./calendar-fields";

describe("the year view's density", () => {
  it("counts an event on each day it covers, and not the day it ends at midnight", () => {
    const counts = eventsPerDay([
      { start: new Date(2019, 9, 3, 14), end: new Date(2019, 9, 3, 15) },
      { start: new Date(2019, 9, 3), end: new Date(2019, 9, 5) },
    ]);
    expect([...counts]).toEqual([
      ["2019-10-3", 2],
      ["2019-10-4", 1],
    ]);
  });

  it("grows with the count", () => {
    expect([0, 1, 2, 3, 4, 5, 40].map(densityLevel)).toEqual([0, 1, 2, 3, 3, 4, 4]);
  });
});

describe("travel time in the grid", () => {
  it("draws a block of that length before a timed event, and none for an all-day one", () => {
    const start = new Date(2019, 9, 3, 14);
    const end = new Date(2019, 9, 3, 15);
    const timed = { id: "a", title: "A", start, end, travelTime: 30, color: "red" };
    const allDay = { id: "b", title: "B", start, end, allDay: true, travelTime: 30 };
    expect(withTravelBlocks([timed, allDay])).toEqual([
      {
        id: `${TRAVEL_BLOCK}a`,
        title: "Travel time",
        start: new Date(2019, 9, 3, 13, 30),
        end: start,
        color: "red",
      },
      timed,
      allDay,
    ]);
  });
});
