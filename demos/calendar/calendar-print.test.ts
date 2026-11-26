import { expect, it, describe as suite } from "vitest";
import type { CalendarEntry } from "./calendar-data";
import { agendaLines } from "./calendar-print";

const entry = (title: string, hour: number, more: Partial<CalendarEntry> = {}): CalendarEntry =>
  ({
    id: title,
    title,
    calendar: "home",
    start: new Date(2026, 10, 3, hour),
    end: new Date(2026, 10, 3, hour + 1),
    ...more,
  }) as CalendarEntry;

suite("the agenda File > Print hands the browser", () => {
  const day = new Date(2026, 10, 3);
  const next = new Date(2026, 10, 4);

  it("lists the events soonest first, with where and what", () => {
    const lines = agendaLines(
      [entry("Later", 15), entry("Sooner", 9, { location: "Pier", notes: "Bring\nrope" })],
      day,
      next,
    );
    expect(lines[0]).toBe("November 3, 2026");
    expect(lines.filter((line) => ["Later", "Sooner"].includes(line))).toEqual(["Sooner", "Later"]);
    expect(lines).toContain("Pier");
    expect(lines).toContain("rope");
  });

  it("names the whole span and says when nothing falls in it", () => {
    expect(agendaLines([], day, new Date(2026, 10, 10))).toEqual([
      "November 3, 2026 to November 9, 2026",
      "",
      "No events.",
    ]);
  });
});
