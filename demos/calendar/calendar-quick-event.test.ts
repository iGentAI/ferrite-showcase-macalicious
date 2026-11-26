import { describe, expect, it } from "vitest";
import { parseQuickEvent, quickEventFits } from "./calendar-quick-event";

// Tuesday 5 November 2019, 9:40 AM.
const NOW = new Date(2019, 10, 5, 9, 40);
const read = (line: string) => parseQuickEvent(line, NOW);

describe("Quick Event", () => {
  it("fits what Calendar can keep, and no number reaches past it", () => {
    const fits = (line: string) => {
      const made = read(line);
      return made !== null && quickEventFits(made);
    };
    expect(fits("Trip in 400 days")).toBe(true);
    expect(fits("Lunch at noon for 2 hours")).toBe(true);
    expect(fits("Meeting in 999999999 days")).toBe(false);
    expect(fits("Meeting at noon for 999999999 hours")).toBe(false);
  });
  it("keeps a title and a place within the limit", () => {
    const made = read(`${"t".repeat(300)} tomorrow at ${"P".repeat(300)}`);
    expect(made?.title).toBe("t".repeat(200));
    expect(made?.location).toBe("P".repeat(200));
  });
  it("reads Lunch at noon tomorrow as an hour at noon the day after", () => {
    expect(read("Lunch at noon tomorrow")).toEqual({
      title: "Lunch",
      start: new Date(2019, 10, 6, 12),
      end: new Date(2019, 10, 6, 13),
      allDay: false,
    });
  });

  it("takes a time that has passed today to mean tomorrow, and one to come to mean today", () => {
    expect(read("Standup at 9am")?.start).toEqual(new Date(2019, 10, 6, 9));
    expect(read("Standup at 10am")?.start).toEqual(new Date(2019, 10, 5, 10));
  });

  it("makes a date without a time all-day, and neither the next full hour", () => {
    expect(read("Trip on Friday")).toEqual({
      title: "Trip",
      start: new Date(2019, 10, 8),
      end: new Date(2019, 10, 9),
      allDay: true,
    });
    expect(read("Call Bob")).toEqual({
      title: "Call Bob",
      start: new Date(2019, 10, 5, 10),
      end: new Date(2019, 10, 5, 11),
      allDay: false,
    });
  });

  it("reads dates by name, number and weekday", () => {
    expect(read("Review Oct 12 at 3pm")?.start).toEqual(new Date(2020, 9, 12, 15));
    expect(read("Review 12 December at 3pm")?.start).toEqual(new Date(2019, 11, 12, 15));
    expect(read("Review 11/20 at 3pm")?.start).toEqual(new Date(2019, 10, 20, 15));
    expect(read("Review next Friday at 3pm")?.start).toEqual(new Date(2019, 10, 15, 15));
    expect(read("Review next Monday at 3pm")?.start).toEqual(new Date(2019, 10, 11, 15));
    expect(read("Review in 3 days at 3pm")?.start).toEqual(new Date(2019, 10, 8, 15));
    expect(read("Review next week at 3pm")?.start).toEqual(new Date(2019, 10, 12, 15));
  });

  it("reads ranges and lengths", () => {
    const range = read("Review 2-4pm tomorrow");
    expect(range?.title).toBe("Review");
    expect(range?.start).toEqual(new Date(2019, 10, 6, 14));
    expect(range?.end).toEqual(new Date(2019, 10, 6, 16));
    const midnight = read("Maintenance 12-1am tomorrow");
    expect(midnight?.title).toBe("Maintenance");
    expect(midnight?.start).toEqual(new Date(2019, 10, 6, 0));
    expect(midnight?.end).toEqual(new Date(2019, 10, 6, 1));
    const noon = read("Lunch 12-1pm tomorrow");
    expect(noon?.start).toEqual(new Date(2019, 10, 6, 12));
    expect(noon?.end).toEqual(new Date(2019, 10, 6, 13));
    const overnight = read("Shift 11-1am tomorrow");
    expect(overnight?.start).toEqual(new Date(2019, 10, 6, 23));
    expect(overnight?.end).toEqual(new Date(2019, 10, 7, 1));
    const working = read("Work 9-5pm tomorrow");
    expect(working?.start).toEqual(new Date(2019, 10, 6, 9));
    expect(working?.end).toEqual(new Date(2019, 10, 6, 17));
    const lasting = read("Dentist Friday 3:30pm for 45 minutes");
    expect(lasting?.title).toBe("Dentist");
    expect(lasting?.end).toEqual(new Date(2019, 10, 8, 16, 15));
    expect(read("Workshop tomorrow at 1pm for 2 hours")?.end).toEqual(new Date(2019, 10, 6, 15));
  });

  it("puts a plain hour in the half of the day people mean", () => {
    expect(read("Call at 3 tomorrow")?.start).toEqual(new Date(2019, 10, 6, 15));
    expect(read("Run at 8 tomorrow")?.start).toEqual(new Date(2019, 10, 6, 8));
    expect(read("Dinner at 8 tomorrow")?.start).toEqual(new Date(2019, 10, 6, 20));
    expect(read("Train at 17:45 tomorrow")?.start).toEqual(new Date(2019, 10, 6, 17, 45));
  });

  it("takes at before a capital for the place, and leaves other words in the title", () => {
    expect(read("Dinner at Luigi's at 7pm tomorrow")).toMatchObject({
      title: "Dinner",
      location: "Luigi's",
    });
    expect(read("Look at the slides tomorrow at 2pm")).toMatchObject({
      title: "Look at the slides",
    });
  });

  it("has nothing to make of an empty line, and names one without words", () => {
    expect(read("   ")).toBeNull();
    expect(read("tomorrow at noon")?.title).toBe("New Event");
  });

  it("finds 29 February in the next leap year, and never rolls it into March", () => {
    const lastLeap = new Date(2021, 2, 1, 9);
    expect(parseQuickEvent("Party Feb 29", lastLeap)).toMatchObject({
      title: "Party",
      start: new Date(2024, 1, 29),
    });
    expect(parseQuickEvent("Party Feb 29 2021", lastLeap)?.title).toBe("Party Feb 29 2021");
  });

  it("leaves in the title what reads as a date or a time and is none", () => {
    expect(read("Review 13/40")).toMatchObject({ title: "Review 13/40", allDay: false });
    expect(read("Review Feb 30")).toMatchObject({ title: "Review Feb 30", allDay: false });
    expect(read("Review 2/30 at 3pm")).toMatchObject({
      title: "Review 2/30",
      start: new Date(2019, 10, 5, 15),
    });
    expect(read("Review 25pm")).toMatchObject({ title: "Review 25pm" });
  });

  it("does not take a word holding a month or a weekday for a date", () => {
    expect(read("Monument visit")).toMatchObject({ title: "Monument visit", allDay: false });
  });
});
