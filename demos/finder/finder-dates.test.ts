import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatDate, relativeDate } from "./finder-data";
import { stampOf } from "./finder-drive";

describe.each(["Pacific/Auckland", "America/Los_Angeles"])("relative dates in %s", (zone) => {
  const before = process.env.TZ;
  beforeEach(() => {
    process.env.TZ = zone;
  });
  afterEach(() => {
    process.env.TZ = before;
  });

  it("says Today and Yesterday by the day the list shows, across local midnight", () => {
    const now = new Date(2026, 2, 3, 0, 30);
    const justAfter = stampOf(new Date(2026, 2, 3, 0, 5).getTime());
    const justBefore = stampOf(new Date(2026, 2, 2, 23, 55).getTime());
    expect(justAfter).toBe("2026-03-03 00:05");
    expect(justBefore).toBe("2026-03-02 23:55");
    expect(relativeDate(justAfter, now)).toBe("Today, 12:05 AM");
    expect(relativeDate(justBefore, now)).toBe("Yesterday, 11:55 PM");
  });

  it("shows an older day as the list always does", () => {
    const older = stampOf(new Date(2026, 2, 1, 12, 0).getTime());
    expect(relativeDate(older, new Date(2026, 2, 3, 0, 30))).toBe(formatDate(older));
  });

  it("does not call a stamp in another form Today", () => {
    expect(relativeDate("2026-03-03T00:05:00Z", new Date(2026, 2, 3, 0, 30))).toBe("--");
    expect(relativeDate(undefined, new Date(2026, 2, 3, 0, 30))).toBe("--");
  });
});
