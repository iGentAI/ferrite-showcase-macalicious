import { describe, expect, it } from "vitest";
import {
  type CalendarGroup,
  groupShown,
  moveCalendarToGroup,
  readCalendarGroups,
} from "./calendar-groups";

const family: CalendarGroup = { id: "g1", name: "Family", calendars: ["home", "kids"] };
const job: CalendarGroup = { id: "g2", name: "Job", calendars: [] };

describe("calendar groups", () => {
  it("moves a calendar out of the group it was in, so it is in one at most", () => {
    expect(moveCalendarToGroup([family, job], "home", "g2")).toEqual([
      { ...family, calendars: ["kids"] },
      { ...job, calendars: ["home"], closed: undefined },
    ]);
  });

  it("takes a calendar out of every group when moved to none", () => {
    expect(moveCalendarToGroup([family, job], "kids", null)).toEqual([
      { ...family, calendars: ["home"] },
      job,
    ]);
  });

  it("opens the group a calendar moves into", () => {
    const [moved] = moveCalendarToGroup([{ ...job, closed: true }], "home", "g2");
    expect(moved?.closed).toBeUndefined();
  });

  it.each([
    [[], "all"],
    [["home"], "some"],
    [["home", "kids"], "none"],
  ] as const)("with %j hidden, says the group shows %s", (hidden, shown) => {
    expect(groupShown(family, hidden)).toBe(shown);
  });

  it("reads anything but a list of groups as none", () => {
    expect(readCalendarGroups("nope")).toEqual([]);
    expect(readCalendarGroups([{ id: "g1" }])).toEqual([]);
    expect(readCalendarGroups([family])).toEqual([family]);
  });
});
