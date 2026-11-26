import { describe, expect, it } from "vitest";
import type { CalendarEntry } from "./calendar-data";
import { eventsToIcs, parseIcs } from "./calendar-ics";
import { occurrences, seriesStartFor } from "./calendar-recurrence";
import { documentFromServer, documentToServer } from "./calendar-server";
import { changeOfZone, FLOATING, fromPopover, onWindowClock } from "./calendar-window-zone";

/*
 * A repeating event repeats in its own IANA zone, wherever it is seen. These tests run in UTC
 * (vitest's TZ), so an event of New York or Berlin is one of another zone than the browser's:
 * the case of a person who opens their calendar while away.
 */

const NEW_YORK = "America/New_York";
const DAY = 86_400_000;

/** A weekly 8:00 New York meeting from Wednesday 21 October 2026 (EDT, UTC-4). */
const standup: CalendarEntry = {
  id: "standup",
  title: "Standup",
  start: new Date(Date.UTC(2026, 9, 21, 12)),
  end: new Date(Date.UTC(2026, 9, 21, 12, 30)),
  calendar: "work",
  repeat: { freq: "weekly" },
  timeZone: NEW_YORK,
};

const startsIn = (entry: CalendarEntry, from: Date, to: Date) =>
  occurrences(entry, from, to).map((each) => each.start.toISOString());

describe("the window on another zone's clock", () => {
  const NY = "America/New_York";
  const noon: CalendarEntry = {
    id: "noon",
    title: "Noon UTC",
    start: new Date(Date.UTC(2026, 9, 21, 12)),
    end: new Date(Date.UTC(2026, 9, 21, 13)),
    calendar: "work",
  };

  it("draws a timed event on that clock, and leaves all-day and floating ones", () => {
    expect(onWindowClock(noon, NY).start.toISOString()).toBe("2026-10-21T08:00:00.000Z");
    expect(onWindowClock(noon, null)).toBe(noon);
    const allDay = { ...noon, allDay: true };
    expect(onWindowClock(allDay, NY).start).toEqual(noon.start);
    const floating = { ...noon, floating: true };
    expect(onWindowClock(floating, NY).start).toEqual(noon.start);
  });

  it("reads a date typed in the popover as that clock's", () => {
    const typed = new Date(Date.UTC(2026, 9, 21, 9));
    const change = fromPopover(noon, { start: typed }, NY);
    expect(change.start?.toISOString()).toBe("2026-10-21T13:00:00.000Z");
    expect(fromPopover(noon, { start: typed }, null).start).toBe(typed);
    expect(fromPopover(noon, { allDay: true, start: typed }, NY).start).toBe(typed);
  });

  it("works a change of zone out from the event's own dates, not what is drawn", () => {
    const drawn = onWindowClock(noon, "Asia/Tokyo");
    const change = fromPopover(noon, changeOfZone(drawn, NY), "Asia/Tokyo");
    expect(change.timeZone).toBe(NY);
    expect(change.start?.toISOString()).toBe("2026-10-21T16:00:00.000Z");
  });
});

describe("a floating event", () => {
  it("keeps its reading in a browser of another zone", () => {
    // Written at 9:00 on a Tokyo clock (00:00 UTC): this browser, in UTC, reads 9:00 too.
    const read = documentFromServer({
      events: [
        {
          id: "f",
          title: "Vitamins",
          start: Date.UTC(2026, 9, 21, 0),
          end: Date.UTC(2026, 9, 21, 1),
          calendar: "work",
          floating: true,
          timeZone: "Asia/Tokyo",
        },
      ],
    });
    const [entry] = read?.events ?? [];
    expect(entry?.floating).toBe(true);
    expect(entry?.timeZone).toBeUndefined();
    expect(entry?.start.toISOString()).toBe("2026-10-21T09:00:00.000Z");
  });

  it("is stored with the zone it was written in, and leaves a zone it had", () => {
    const entry: CalendarEntry = {
      id: "f",
      title: "Vitamins",
      start: new Date(Date.UTC(2026, 9, 21, 9)),
      end: new Date(Date.UTC(2026, 9, 21, 10)),
      calendar: "work",
      timeZone: "Asia/Tokyo",
    };
    const made = { ...entry, ...changeOfZone(entry, FLOATING) };
    // 9:00 UTC reads 18:00 in Tokyo: floating keeps that reading on this browser's clock.
    expect(made.start.toISOString()).toBe("2026-10-21T18:00:00.000Z");
    const [stored] = documentToServer([made], []).events;
    expect(stored).toMatchObject({ floating: true, timeZone: "UTC" });
  });
});

describe("a repeating event in its own zone", () => {
  it("keeps its time of day there across that zone's change of the clocks", () => {
    // 1 November 2026: New York goes from EDT (UTC-4) to EST (UTC-5).
    expect(
      startsIn(standup, new Date(Date.UTC(2026, 9, 26)), new Date(Date.UTC(2026, 10, 9))),
    ).toEqual(["2026-10-28T12:00:00.000Z", "2026-11-04T13:00:00.000Z"]);
    // Without a zone it repeats on the viewer's clock (UTC here): an hour early in New York.
    const { timeZone: _zone, ...floating } = standup;
    expect(
      startsIn(floating, new Date(Date.UTC(2026, 10, 2)), new Date(Date.UTC(2026, 10, 9))),
    ).toEqual(["2026-11-04T12:00:00.000Z"]);
  });

  it("takes the first instant of a time the clocks repeat, as a browser in that zone does", () => {
    // 27 October 2024, Berlin: 02:30 happens twice (CEST, then CET). The first is 00:30 UTC.
    const night: CalendarEntry = {
      id: "night",
      title: "Night",
      start: new Date(Date.UTC(2024, 9, 25, 0, 30)),
      end: new Date(Date.UTC(2024, 9, 25, 1)),
      calendar: "work",
      repeat: { freq: "daily" },
      timeZone: "Europe/Berlin",
    };
    expect(
      startsIn(night, new Date(Date.UTC(2024, 9, 26, 12)), new Date(Date.UTC(2024, 9, 28, 12))),
    ).toEqual(["2024-10-27T00:30:00.000Z", "2024-10-28T01:30:00.000Z"]);
  });

  it("has no occurrence at a time the clocks skip", () => {
    // 8 March 2026, New York: 2:00 to 3:00 does not happen.
    const early: CalendarEntry = {
      id: "early",
      title: "Early",
      start: new Date(Date.UTC(2026, 2, 7, 7, 30)),
      end: new Date(Date.UTC(2026, 2, 7, 8)),
      calendar: "work",
      repeat: { freq: "daily" },
      timeZone: NEW_YORK,
    };
    expect(
      startsIn(early, new Date(Date.UTC(2026, 2, 7)), new Date(Date.UTC(2026, 2, 10))),
    ).toEqual(["2026-03-07T07:30:00.000Z", "2026-03-09T06:30:00.000Z"]);
  });

  it("moves the series on its own clock when one occurrence is moved", () => {
    // The 4 November occurrence (8:00 EST) moved to Thursday 5 November 8:00 EST: the series
    // starts on Thursday 22 October at 8:00 EDT.
    expect(
      seriesStartFor(
        standup,
        new Date(Date.UTC(2026, 10, 4, 13)),
        new Date(Date.UTC(2026, 10, 5, 13)),
      )?.toISOString(),
    ).toBe("2026-10-22T12:00:00.000Z");
  });
});

describe("the zone in Calendar's document", () => {
  it("is kept for a timed repeat, given the browser's when it has none, and written on an all-day event", () => {
    const { timeZone: _zone, ...unzoned } = standup;
    const single: CalendarEntry = { ...unzoned, id: "single", repeat: undefined };
    const holiday: CalendarEntry = {
      ...standup,
      id: "holiday",
      allDay: true,
      start: new Date(Date.UTC(2026, 9, 21)),
      end: new Date(Date.UTC(2026, 9, 22)),
    };
    const body = documentToServer([standup, { ...unzoned, id: "unzoned" }, single, holiday], []);
    expect(body.events.map((event) => [event.id, event.timeZone])).toEqual([
      ["standup", NEW_YORK],
      ["unzoned", "UTC"],
      ["single", undefined],
      ["holiday", "UTC"],
    ]);
    const read = documentFromServer({ events: body.events })?.events;
    expect(read?.find((event) => event.id === "standup")?.timeZone).toBe(NEW_YORK);
    expect(read?.find((event) => event.id === "holiday")?.timeZone).toBeUndefined();
  });

  it("shows an all-day event on the days it was written for, wherever it is read", () => {
    // Midnight in Tokyo on November 4 is the afternoon of November 3 in this browser's zone.
    const start = Date.UTC(2026, 10, 3, 15);
    const end = Date.UTC(2026, 10, 4, 15);
    const read = documentFromServer({
      events: [
        {
          id: "fair",
          title: "Fair",
          start,
          end,
          allDay: true,
          calendar: "home",
          timeZone: "Asia/Tokyo",
          repeat: { freq: "weekly" },
          exdates: [Date.UTC(2026, 10, 10, 15)],
        },
      ],
    })?.events?.[0];
    expect(read?.start).toEqual(new Date(2026, 10, 4));
    expect(read?.end).toEqual(new Date(2026, 10, 5));
    expect(read?.exdates).toEqual([new Date(2026, 10, 11).getTime()]);
  });

  it("reads an all-day event saved with no zone at its instant, as it always did", () => {
    const start = Date.UTC(2026, 10, 3, 15);
    const read = documentFromServer({
      events: [
        { id: "old", title: "Old", start, end: start + 86_400_000, allDay: true, calendar: "home" },
      ],
    })?.events?.[0];
    expect(read?.start).toEqual(new Date(start));
  });
});

describe("the zone in iCalendar files", () => {
  it("is read from the TZID of a repeat, or UTC for a UTC start", () => {
    const file = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:a",
      "DTSTART;TZID=America/New_York:20261021T080000",
      "DTEND;TZID=America/New_York:20261021T083000",
      "RRULE:FREQ=WEEKLY",
      "SUMMARY:Standup",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:b",
      "DTSTART:20261021T120000Z",
      "RRULE:FREQ=DAILY;COUNT=3",
      "SUMMARY:UTC",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const read = parseIcs(file).events;
    expect(read.map((event) => [event.title, event.timeZone])).toEqual([
      ["Standup", NEW_YORK],
      ["UTC", "UTC"],
    ]);
  });

  it("writes a repeat in its own zone, and reads it back the same, across the change of the clocks", () => {
    const text = eventsToIcs([standup], { now: new Date(Date.UTC(2026, 9, 21)) });
    expect(text).toContain("BEGIN:VTIMEZONE\r\nTZID:America/New_York\r\n");
    expect(text).toContain("DTSTART;TZID=America/New_York:20261021T080000\r\n");
    const [again] = parseIcs(text).events;
    expect(again?.timeZone).toBe(NEW_YORK);
    expect(again?.start.getTime()).toBe(standup.start.getTime());
    const back = { ...standup, ...again, id: "back", calendar: "work" } as CalendarEntry;
    expect(
      startsIn(back, new Date(Date.UTC(2026, 10, 2)), new Date(Date.UTC(2026, 10, 2) + 7 * DAY)),
    ).toEqual(["2026-11-04T13:00:00.000Z"]);
  });
});
